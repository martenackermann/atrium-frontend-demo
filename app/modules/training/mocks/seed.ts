import type { ActingAs, AutoApproval } from '~/types/api'
import { defineMockSeed, type SeedContext } from '~/mocks/define'
import { recordAudit } from '~/mocks/core/audit'
import { seedAttachment } from '~/mocks/core/files'
import { canDecide } from '~/mocks/core/org'
import { USER_IDS } from '~/mocks/core/seed'
import type { MockUser } from '~/mocks/core/types'
import type { AttendeeStatus } from '../api/types'
import {
  addDays,
  directManager,
  localDay,
  planEntry,
  reference,
  startOfDayIso,
  summaryOf,
  TRAINING_CONFIG,
} from './rules'
import { type At, TRAINING_STORY, TRAINING_STORY_NOTIFICATIONS } from './story'
import type { TrainingAttendeeRecord, TrainingRatingRecord } from './types'

/**
 * Training demo data (SPEC §10.2): the 30 requests / 42 attendees of the backend story plan
 * (./story.ts, identical values), replayed step by step so states, decisions, rating loops,
 * documents and the audit trail are coherent; then the persona notifications of these records.
 */

const euros = (cents: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)

/** "21–22 Oct" style range for notification bodies (en-GB, like the backend templates). */
function formatRange(start: string, end: string): string {
  const fmt = (iso: string, parts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', parts).format(new Date(`${iso}T12:00:00`)).replace(',', '')
  if (start === end) return fmt(start, { weekday: 'short', day: 'numeric', month: 'short' })
  const [a, b] = [new Date(`${start}T12:00:00`), new Date(`${end}T12:00:00`)]
  if (a.getMonth() === b.getMonth())
    return `${a.getDate()}–${fmt(end, { day: 'numeric', month: 'short' })}`
  return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`
}

interface AuditArgs {
  entityType: string
  entityId: string
  label: string
  action: string
  actor: MockUser | null
  actingAs: ActingAs
  occurredAt: string
  fromState?: string | null
  toState?: string | null
  reason?: string | null
  changes?: { field: string; label: string; from: unknown; to: unknown }[]
}

function seedTraining(ctx: SeedContext) {
  const { db } = ctx
  const user = (handle: string): MockUser => {
    const id = USER_IDS[handle]
    const found = id ? db.users.find(id) : undefined
    if (!found) throw new Error(`[training seed] unknown user ${handle}`)
    return found
  }
  const at = ([day, hh, mm]: At) => ctx.at(day, hh, mm)
  const plus = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString()
  const isWeekend = (iso: string) => [0, 6].includes(new Date(`${iso}T12:00:00`).getDay())
  /** 07:15 on the first weekday from `day` up to yesterday (else the day itself), like the backend. */
  const remindAt = (day: number) => {
    for (let d = day; d <= -1; d++) if (!isWeekend(ctx.d(d))) return ctx.at(d, 7, 15)
    return ctx.at(day, 7, 15)
  }
  const audit = (input: AuditArgs) =>
    recordAudit(db, {
      module: 'training',
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.label,
      action: input.action,
      actorId: input.actor?.id ?? null,
      actingAs: input.actingAs,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      reason: input.reason ?? null,
      changes: input.changes ?? null,
      summary: summaryOf(
        input.entityType,
        input.action,
        input.actor?.displayName ?? null,
        input.actingAs,
      ),
      occurredAt: input.occurredAt,
      correlationId: 'seed',
    })

  const seeded = new Map<
    number,
    { requestId: string; attendees: Map<string, TrainingAttendeeRecord> }
  >()
  const tina = user('tina')

  for (const spec of TRAINING_STORY) {
    const createdAt = at(spec.created)
    const requester = user(spec.requester)
    const label = reference(spec.number)
    const executive = spec.executive ? user(spec.executive) : null
    const startsOn = ctx.d(spec.startsOn)
    const endsOn = ctx.d(spec.endsOn)
    const request = db.trainingRequests.insert({
      id: ctx.uuid(),
      number: spec.number,
      topic: spec.topic,
      provider: spec.provider,
      format: spec.format,
      location: spec.location,
      registrationUrl: spec.registrationUrl ?? null,
      registrationDetails: spec.registrationDetails ?? null,
      startsOn,
      endsOn,
      costCents: spec.costCents,
      costCenterId: requester.costCenterId,
      executiveApproverId: executive?.id ?? null,
      certificateExpected: spec.certificateExpected ?? false,
      reimbursementAgreement: spec.reimbursementAgreement ?? false,
      requesterComment: spec.comment ?? null,
      requesterId: requester.id,
      backOfficeComment: null,
      billingStatus: 'open',
      actualCostCents: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    })
    const backOfficeRequester = spec.requester === 'tina'
    audit({
      entityType: 'training_request',
      entityId: request.id,
      label,
      action: 'create',
      actor: requester,
      actingAs: backOfficeRequester ? 'back_office' : 'requester',
      occurredAt: createdAt,
    })
    if (spec.agenda) {
      seedAttachment(db, {
        originalName: spec.agenda,
        purpose: 'training_document',
        uploadedById: requester.id,
        entityType: 'training_request',
        entityId: request.id,
        createdAt: plus(createdAt, 60_000),
      })
    }

    const attendees = new Map<string, TrainingAttendeeRecord>()
    let lastActivity = createdAt
    spec.attendees.forEach((a, index) => {
      const person = user(a.user)
      const created = plus(createdAt, (index + 1) * 1000)
      const plan = planEntry(db, person, requester, executive?.id ?? null)
      if (
        plan.resolution.approver.id !== user(a.approver).id ||
        plan.managerAuto !== (a.auto ?? null)
      ) {
        throw new Error(`[training seed] ${label} ${a.user}: routing differs from the story plan`)
      }
      const id = ctx.uuid()
      const row: TrainingAttendeeRecord = {
        id,
        requestId: request.id,
        userId: person.id,
        costCenterId: person.costCenterId,
        status: plan.initialState,
        statusBeforeCancellation: null,
        approverId: plan.resolution.approver.id,
        approverReason: plan.resolution.reason,
        escalatedFromId: a.escalatedFrom ? user(a.escalatedFrom).id : null,
        executiveApproverId: executive?.id ?? null,
        hotelNeeded: Boolean(a.hotel),
        hotelCheckInOn: a.hotel ? ctx.d(a.hotel.checkIn) : null,
        hotelCheckOutOn: a.hotel ? ctx.d(a.hotel.checkOut) : null,
        hotelCostCents: a.hotel?.costCents ?? null,
        goal1: null,
        goal2: null,
        goalsUpdatedAt: null,
        goalsRemindedAt: null,
        bookingReference: null,
        managerDecisionAt: null,
        managerDecisionById: null,
        managerDecisionAs: null,
        managerDecisionComment: null,
        managerAutoApproval: null,
        executiveDecisionAt: null,
        executiveDecisionById: null,
        executiveDecisionAs: null,
        executiveDecisionComment: null,
        executiveAutoApproval: null,
        declineReason: null,
        bookingImpossibleReason: null,
        cancellationReason: null,
        bookedAt: null,
        bookedById: null,
        cancellationRequestedAt: null,
        cancelledAt: null,
        version: 1,
        createdAt: created,
        updatedAt: created,
      }
      const name = person.displayName
      const attendeeAudit = (input: Omit<AuditArgs, 'entityType' | 'entityId' | 'label'>) =>
        audit({ ...input, entityType: 'training_attendee', entityId: id, label: name })
      const autoBy = (auto: AutoApproval, approverId: string | null) =>
        auto === 'executive_self' ? person.id : approverId
      attendeeAudit({
        action: 'create',
        actor: requester,
        actingAs:
          person.id === requester.id ? 'self' : backOfficeRequester ? 'back_office' : 'requester',
        occurredAt: created,
        toState: 'pending_manager_approval',
      })
      if (plan.managerAuto) {
        Object.assign(row, {
          managerDecisionAt: created,
          managerDecisionById: autoBy(plan.managerAuto, plan.resolution.approver.id),
          managerDecisionAs: 'system',
          managerAutoApproval: plan.managerAuto,
        })
        attendeeAudit({
          action: 'auto_approve',
          actor: null,
          actingAs: 'system',
          occurredAt: plus(created, 1),
          fromState: 'pending_manager_approval',
          toState: plan.initialState,
          reason: plan.managerAuto,
        })
      }
      if (plan.executiveAuto) {
        Object.assign(row, {
          executiveDecisionAt: created,
          executiveDecisionById: autoBy(plan.executiveAuto, executive?.id ?? null),
          executiveDecisionAs: 'system',
          executiveAutoApproval: plan.executiveAuto,
        })
        attendeeAudit({
          action: 'auto_approve',
          actor: null,
          actingAs: 'system',
          occurredAt: plus(created, 2),
          fromState: 'pending_executive_approval',
          toState: 'to_book',
          reason: plan.executiveAuto,
        })
      }

      let status: AttendeeStatus = plan.initialState
      const ratings = new Map<number, TrainingRatingRecord>()
      const move = (
        action: string,
        when: string,
        actor: MockUser | null,
        actingAs: ActingAs,
        to: AttendeeStatus,
        reason: string | null = null,
      ) => {
        attendeeAudit({
          action,
          actor,
          actingAs,
          occurredAt: when,
          fromState: status,
          toState: to,
          reason,
        })
        status = to
        row.version++
        row.updatedAt = when
      }
      const openRating = (loop: 1 | 2 | 3, rater: MockUser, when: string, dueOn: string) => {
        const rating: TrainingRatingRecord = {
          id: ctx.uuid(),
          attendeeId: id,
          loop,
          raterId: rater.id,
          dueAt: startOfDayIso(dueOn),
          submittedAt: null,
          lastRemindedAt: null,
          reminderCount: 0,
          participated: null,
          overallGrade: null,
          trainerGrade: null,
          expectationsGrade: null,
          appliesLearned: null,
          supervisorSupported: null,
          worthwhileForOrganization: null,
          improvementObserved: null,
          certificationGained: null,
          certificationComment: null,
          comment: null,
          createdAt: when,
        }
        ratings.set(loop, rating)
        audit({
          entityType: 'training_rating',
          entityId: rating.id,
          label: `Feedback round ${loop}`,
          action: 'create',
          actor: null,
          actingAs: 'system',
          occurredAt: plus(when, 5),
        })
      }
      const selfOrRequester = (by: string): ActingAs =>
        user(by).id === person.id ? 'self' : 'requester'
      const submitAudit = (rating: TrainingRatingRecord, actor: MockUser | null, when: string) =>
        audit({
          entityType: 'training_rating',
          entityId: rating.id,
          label: `Feedback round ${rating.loop} · ${name}`,
          action: 'submit',
          actor,
          actingAs: 'self',
          occurredAt: when,
        })

      for (const step of a.steps) {
        if (step.kind === 'remind') {
          const rating = ratings.get(step.loop)!
          rating.reminderCount++
          rating.lastRemindedAt = remindAt(step.day)
          audit({
            entityType: 'training_rating',
            entityId: rating.id,
            label: `Feedback round ${step.loop} · ${name}`,
            action: 'remind',
            actor: null,
            actingAs: 'system',
            occurredAt: rating.lastRemindedAt,
          })
          continue
        }
        const when = at(step.at)
        if (when > lastActivity) lastActivity = when
        switch (step.kind) {
          case 'approve':
          case 'decline': {
            const exec = status === 'pending_executive_approval'
            const by = user(step.by)
            const right = canDecide(
              db,
              by,
              {
                approverId: exec ? row.executiveApproverId : row.approverId,
                kind: exec ? 'executive' : 'manager',
              },
              person.id,
              localDay(when),
            )
            if (!right) throw new Error(`[training seed] ${label}: ${step.by} may not decide`)
            const actingAs: ActingAs = exec && right === 'approver' ? 'executive' : right
            const comment = step.kind === 'approve' ? (step.comment ?? null) : step.reason
            const prefix = exec ? 'executive' : 'manager'
            Object.assign(row, {
              [`${prefix}DecisionAt`]: when,
              [`${prefix}DecisionById`]: by.id,
              [`${prefix}DecisionAs`]: actingAs,
              [`${prefix}DecisionComment`]: comment,
            })
            if (step.kind === 'decline') {
              row.declineReason = step.reason
              move('decline', when, by, actingAs, 'declined', step.reason)
              break
            }
            const execFollows =
              !exec &&
              row.executiveApproverId !== null &&
              row.executiveApproverId !== by.id &&
              row.executiveApproverId !== requester.id
            move(
              'approve',
              when,
              by,
              actingAs,
              execFollows ? 'pending_executive_approval' : 'to_book',
            )
            break
          }
          case 'withdraw':
            Object.assign(row, { cancelledAt: when, cancellationReason: step.reason ?? null })
            move(
              'withdraw',
              when,
              user(step.by),
              selfOrRequester(step.by),
              'cancelled',
              step.reason ?? null,
            )
            break
          case 'book': {
            Object.assign(row, {
              bookedAt: when,
              bookedById: user(step.by).id,
              bookingReference: step.reference,
            })
            move('book', when, user(step.by), 'back_office', 'booked')
            openRating(1, person, when, addDays(endsOn, TRAINING_CONFIG.loop1DelayDays))
            if (step.document) {
              seedAttachment(db, {
                originalName: `Booking-${step.reference}.pdf`,
                purpose: 'training_booking_document',
                uploadedById: user(step.by).id,
                entityType: 'training_attendee',
                entityId: id,
                createdAt: plus(when, -60_000),
              })
            }
            break
          }
          case 'mark_booking_impossible':
            row.bookingImpossibleReason = step.reason
            move(
              'mark_booking_impossible',
              when,
              user(step.by),
              'back_office',
              'booking_impossible',
              step.reason,
            )
            break
          case 'request_cancellation':
            Object.assign(row, {
              statusBeforeCancellation: status,
              cancellationRequestedAt: when,
              cancellationReason: step.reason,
            })
            move(
              'request_cancellation',
              when,
              user(step.by),
              selfOrRequester(step.by),
              'cancellation_requested',
              step.reason,
            )
            break
          case 'confirm_cancellation': {
            row.cancelledAt = when
            move('confirm_cancellation', when, user(step.by), 'back_office', 'cancelled')
            const loop1 = ratings.get(1)
            if (loop1 && !loop1.submittedAt) ratings.delete(1)
            break
          }
          case 'rate1': {
            const rating = ratings.get(1)!
            const { participated, grades, comment } = step.answers
            Object.assign(rating, {
              submittedAt: when,
              participated,
              overallGrade: participated ? grades![0] : null,
              trainerGrade: participated ? grades![1] : null,
              expectationsGrade: participated ? grades![2] : null,
              comment: comment ?? null,
            })
            submitAudit(rating, person, when)
            move(
              'submit_rating_1',
              plus(when, 1),
              person,
              'self',
              participated ? 'attended' : 'not_attended',
            )
            if (participated)
              openRating(2, person, when, addDays(localDay(when), TRAINING_CONFIG.loop2DelayDays))
            break
          }
          case 'rate2': {
            const rating = ratings.get(2)!
            const [applies, supported, worthwhile] = step.answers.answers
            Object.assign(rating, {
              submittedAt: when,
              appliesLearned: applies,
              supervisorSupported: supported,
              worthwhileForOrganization: worthwhile,
              comment: step.answers.comment ?? null,
            })
            submitAudit(rating, person, when)
            const manager = directManager(db, person.id)
            if (manager)
              openRating(3, manager, when, addDays(localDay(when), TRAINING_CONFIG.loop3DelayDays))
            break
          }
          case 'rate3': {
            const rating = ratings.get(3)!
            Object.assign(rating, {
              submittedAt: when,
              improvementObserved: step.answers.improvement,
              certificationGained: step.answers.certification,
              certificationComment: step.answers.certificationComment ?? null,
              comment: step.answers.comment ?? null,
            })
            submitAudit(rating, db.users.find(rating.raterId) ?? null, when)
            break
          }
        }
      }

      if (a.goals) {
        const goalsAt = plus(row.bookedAt ?? created, 2 * 3_600_000)
        Object.assign(row, { goal1: a.goals[0], goal2: a.goals[1], goalsUpdatedAt: goalsAt })
        attendeeAudit({
          action: 'update_goals',
          actor: person,
          actingAs: 'self',
          occurredAt: goalsAt,
          changes: [
            { field: 'goal1', label: 'Goal 1', from: null, to: a.goals[0] },
            ...(a.goals[1]
              ? [{ field: 'goal2', label: 'Goal 2', from: null, to: a.goals[1] }]
              : []),
          ],
        })
      }
      row.status = status
      db.trainingAttendees.insert(row)
      for (const rating of ratings.values()) db.trainingRatings.insert(rating)
      attendees.set(a.user, row)
    })

    if (spec.billing && spec.billing.status !== 'open') {
      const billable = [...attendees.values()].filter(
        (a) => a.bookingReference && a.status !== 'cancelled',
      ).length
      const actual =
        spec.billing.status === 'free_of_charge'
          ? 0
          : Math.round(spec.costCents * billable * (spec.billing.actualFactor ?? 1))
      let billedAt = plus(lastActivity, 3 * 86_400_000)
      if (billedAt > ctx.at(0, 6, 0)) billedAt = ctx.at(-1, 16, 0)
      db.trainingRequests.update(request.id, {
        billingStatus: spec.billing.status,
        actualCostCents: actual,
        backOfficeComment: spec.billing.comment ?? null,
        version: 2,
        updatedAt: billedAt,
      })
      audit({
        entityType: 'training_request',
        entityId: request.id,
        label,
        action: 'update_back_office',
        actor: tina,
        actingAs: 'back_office',
        occurredAt: billedAt,
        changes: [
          {
            field: 'billingStatus',
            label: 'Billing status',
            from: 'open',
            to: spec.billing.status,
          },
          { field: 'actualCostCents', label: 'Actual cost', from: null, to: actual },
        ],
      })
    }
    seeded.set(spec.number, { requestId: request.id, attendees })
  }

  // Persona notifications of the story records (SPEC_RESOLUTIONS #7), same texts as the templates.
  for (const n of TRAINING_STORY_NOTIFICATIONS) {
    const spec = TRAINING_STORY.find((r) => r.number === n.request)!
    const row = seeded.get(n.request)!.attendees.get(n.attendee)!
    const plan = spec.attendees.find((a) => a.user === n.attendee)!
    const attendee = user(n.attendee).displayName
    const approver = user(plan.approver).displayName
    const range = formatRange(ctx.d(spec.startsOn), ctx.d(spec.endsOn))
    const ref = reference(spec.number)
    const decider = row.managerDecisionById
      ? (db.users.find(row.managerDecisionById)?.displayName ?? approver)
      : approver
    const texts: Record<string, { title: string; body: string; link: string }> = {
      'training.participation_created': {
        title: `You're registered for ${spec.topic}`,
        body: `${ref} · ${range} · ${spec.provider}. ${plan.auto ? 'Approved automatically. The training office books it next.' : `${approver} decides next.`}`,
        link: `/training/participations/${row.id}`,
      },
      'training.participation_booked': {
        title: `Booked: ${spec.topic}`,
        body: `${spec.topic} on ${range} is booked${row.bookingReference ? ` (${row.bookingReference})` : ''}. Set two learning goals before it starts.`,
        link: `/training/participations/${row.id}#goals`,
      },
      'training.participation_declined': {
        title: `Declined: ${spec.topic}`,
        body: `${decider} declined: ${row.declineReason ?? ''}`,
        link: `/training/participations/${row.id}`,
      },
      'training.approval_requested': {
        title: `Approval needed: ${attendee} – ${spec.topic}`,
        body: `${attendee} asks to attend ${spec.topic} (${range}, ${euros(spec.costCents)}).${plan.escalatedFrom ? ` Escalated to you because ${user(plan.escalatedFrom).displayName} is a site manager.` : ''}`,
        link: `/training/approvals?tab=approvals&selected=${row.id}`,
      },
      'training.executive_approval_requested': {
        title: `Executive approval needed (≥ ${euros(TRAINING_CONFIG.thresholdCents)}): ${spec.topic}`,
        body: `${attendee} · ${range} · ${euros(spec.costCents)}. Approved by ${decider}.`,
        link: `/training/approvals?tab=executive&selected=${row.id}`,
      },
    }
    const text = texts[n.template]!
    const createdAt = at(n.at)
    db.notifications.insert({
      id: ctx.uuid(),
      userId: user(n.to).id,
      templateId: n.template,
      module: 'training',
      title: text.title,
      body: text.body,
      link: text.link,
      priority: 'normal',
      readAt: n.read ? plus(createdAt, 3 * 3_600_000) : null,
      createdAt,
    })
  }
}

export default defineMockSeed({ order: 100, run: seedTraining })
