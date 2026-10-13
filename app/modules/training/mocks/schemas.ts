/**
 * Request bodies of the training API (API.md §4.3) as zod schemas — strict objects with the same
 * limits and messages as the backend DTOs, so the mocks answer 422 with the same dot paths.
 */
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-21.')
const uuid = z.string().min(1)
const money = z.strictObject({
  amountCents: z.number().int().min(0).max(100_000_000),
  currency: z.literal('EUR'),
})
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)
const httpsUrl = optionalText(500).refine(
  (value) => value === null || /^https:\/\/\S+$/i.test(value),
  {
    message: 'Use a link that starts with https://',
  },
)
const format = z.enum(['in_person', 'online', 'hybrid'])

const attendee = z.strictObject({
  userId: uuid,
  costCenterId: uuid.nullish().transform((value) => value ?? null),
  hotel: z
    .strictObject({
      checkInOn: isoDate,
      checkOutOn: isoDate,
      cost: money.nullish().transform((value) => value ?? null),
    })
    .nullish()
    .transform((value) => value ?? null),
})

const create = z
  .strictObject({
    topic: z.string().trim().min(3, 'Name the training (at least 3 characters).').max(200),
    provider: z.string().trim().min(2, 'Name the provider.').max(120),
    format,
    location: optionalText(200),
    registrationUrl: httpsUrl,
    registrationDetails: optionalText(2000),
    startsOn: isoDate,
    endsOn: isoDate,
    cost: money,
    costCenterId: uuid.nullish().transform((value) => value ?? null),
    executiveApproverId: uuid.nullish().transform((value) => value ?? null),
    certificateExpected: z.boolean(),
    reimbursementAgreement: z.boolean(),
    requesterComment: optionalText(2000),
    attendees: z.array(attendee).min(1, 'Add at least one attendee.').max(20),
    attachmentIds: z
      .array(uuid)
      .max(10)
      .nullish()
      .transform((value) => value ?? []),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>()
    body.attendees.forEach((a, index) => {
      if (seen.has(a.userId))
        ctx.addIssue({
          code: 'custom',
          path: ['attendees', index, 'userId'],
          message: 'This person is already listed.',
        })
      seen.add(a.userId)
    })
  })

const maybe = <T extends z.ZodType>(schema: T) => schema.optional()

const update = z.strictObject({
  topic: maybe(z.string().trim().min(3).max(200)),
  provider: maybe(z.string().trim().min(2).max(120)),
  format: maybe(format),
  location: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  registrationUrl: httpsUrl.optional(),
  registrationDetails: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  startsOn: maybe(isoDate),
  endsOn: maybe(isoDate),
  cost: maybe(money),
  costCenterId: uuid.nullish(),
  executiveApproverId: uuid.nullish(),
  certificateExpected: maybe(z.boolean()),
  reimbursementAgreement: maybe(z.boolean()),
  requesterComment: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  version: maybe(z.number().int().min(1)),
})

const backOffice = z.strictObject({
  billingStatus: maybe(z.enum(['open', 'invoice_received', 'free_of_charge'])),
  actualCost: money.nullish(),
  backOfficeComment: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
  version: maybe(z.number().int().min(1)),
})

const preview = z.strictObject({
  cost: money.nullish().transform((value) => value ?? null),
  executiveApproverId: uuid.nullish().transform((value) => value ?? null),
  attendees: z
    .array(z.strictObject({ userId: uuid }))
    .max(20)
    .default([]),
})

const goal = z
  .string()
  .trim()
  .max(500, 'Keep each goal under 500 characters.')
  .nullable()
  .transform((value) => value || null)
const goals = z.strictObject({ goal1: goal, goal2: goal })

const grade = z
  .number()
  .int()
  .min(1)
  .max(6)
  .nullish()
  .transform((value) => value ?? null)
const likert = z.enum(['A', 'B', 'C', 'D'])
const LOOP_FIELDS: Record<1 | 2 | 3, readonly string[]> = {
  1: ['participated', 'overallGrade', 'trainerGrade', 'expectationsGrade'],
  2: ['appliesLearned', 'supervisorSupported', 'worthwhileForOrganization'],
  3: ['improvementObserved', 'certificationGained', 'certificationComment'],
}

/** `RatingSubmission` as one flat object, `loop` selects the answer set (backend DTO). */
const rating = z
  .strictObject({
    loop: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    participated: z.boolean().optional(),
    overallGrade: grade.optional(),
    trainerGrade: grade.optional(),
    expectationsGrade: grade.optional(),
    appliesLearned: likert.optional(),
    supervisorSupported: likert.optional(),
    worthwhileForOrganization: likert.optional(),
    improvementObserved: z.number().int().min(1).max(4).optional(),
    certificationGained: z.boolean().optional(),
    certificationComment: optionalText(1000).optional(),
    comment: optionalText(2000).optional(),
  })
  .superRefine((body, ctx) => {
    const values = body as Record<string, unknown>
    for (const [loop, fields] of Object.entries(LOOP_FIELDS)) {
      if (Number(loop) === body.loop) continue
      for (const field of fields)
        if (values[field] !== undefined && !LOOP_FIELDS[body.loop].includes(field))
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `Not part of feedback round ${body.loop}.`,
          })
    }
    const required = (field: string, message: string) => {
      if (values[field] === undefined || values[field] === null)
        ctx.addIssue({ code: 'custom', path: [field], message })
    }
    if (body.loop === 1) {
      required('participated', 'Say whether you took part.')
      for (const field of ['overallGrade', 'trainerGrade', 'expectationsGrade'] as const) {
        const value = body[field] ?? null
        if (body.participated === true && value === null)
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Pick a grade from 1 (excellent) to 6 (insufficient).',
          })
        if (body.participated === false && value !== null)
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Leave the grades empty if you did not take part.',
          })
      }
    } else if (body.loop === 2) {
      for (const field of LOOP_FIELDS[2]) required(field, 'Pick one of the four options.')
    } else {
      required('improvementObserved', 'Pick how visible the improvement is.')
      required('certificationGained', 'Say whether a certification was gained.')
    }
  })

export const schemas = {
  attendee,
  create,
  update,
  backOffice,
  preview,
  goals,
  rating,
  attachments: z.strictObject({ attachmentIds: z.array(uuid).min(1).max(10) }),
}
