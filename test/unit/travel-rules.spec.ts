import { describe, expect, it } from 'vitest'
import {
  buildRoute,
  evaluateApprovalReasons,
  isAdultOn,
  isHighPriority,
  specialEquipmentReasonRequired,
  travelReference,
} from '~/modules/travel/lib/rules'
import { approvalChip, requestTitle } from '~/modules/travel/lib/present'
import { toFormErrors } from '~/modules/travel/lib/stepper'

/** The client-side port of the backend travel rules (SPEC §6.3, resolutions #9, #11). */
describe('travel approval rules', () => {
  it('finds both reasons of S-V1 (automatic required + foreign travel) in SPEC order', () => {
    expect(
      evaluateApprovalReasons({
        kind: 'car',
        car: {
          classIsDefault: true,
          equipment: { foreignTravel: true, automaticRequired: true, automaticPreferred: true },
        },
      }),
    ).toEqual(['car_automatic_required', 'car_foreign_travel'])
  })

  it('needs no approval for the standard class with a manual gearbox from a branch', () => {
    expect(
      evaluateApprovalReasons({
        kind: 'car',
        car: { classIsDefault: true, equipment: {}, handoverMode: 'branch', dropOffMode: 'same' },
      }),
    ).toEqual([])
  })

  it('flags class upgrades, delivery and collection', () => {
    expect(
      evaluateApprovalReasons({
        kind: 'car',
        car: { classIsDefault: false, handoverMode: 'delivery', dropOffMode: 'collection' },
      }),
    ).toEqual(['vehicle_class_upgrade', 'car_delivery', 'car_collection'])
  })

  it('treats partial input leniently (preview while typing)', () => {
    expect(evaluateApprovalReasons({ kind: 'car', car: null })).toEqual([])
    expect(evaluateApprovalReasons({ kind: 'train', train: { fareType: null } })).toEqual([])
    expect(evaluateApprovalReasons({ kind: 'flight' })).toEqual(['flight'])
  })

  it('train saver fares and separate tickets need approval', () => {
    expect(
      evaluateApprovalReasons({
        kind: 'train',
        train: { fareType: 'saver', separateTickets: true },
      }),
    ).toEqual(['train_saver_fare', 'train_separate_tickets'])
  })

  it('asks for a special-equipment reason only for car reasons', () => {
    expect(specialEquipmentReasonRequired(['car_diesel'])).toBe(true)
    expect(specialEquipmentReasonRequired(['train_saver_fare', 'flight'])).toBe(false)
  })
})

describe('travel routes, priority and references', () => {
  it('builds the route per kind (resolution #9)', () => {
    expect(
      buildRoute({
        kind: 'car',
        car: { handoverMode: 'branch', handoverBranch: 'Riverton', destination: 'Westbay' },
      }),
    ).toBe('Riverton → Westbay')
    expect(
      buildRoute({
        kind: 'car',
        car: { handoverMode: 'delivery', handoverCity: 'Hillford', destination: 'Eastgate' },
      }),
    ).toBe('Hillford → Eastgate')
    expect(
      buildRoute({
        kind: 'train',
        train: { fromStation: 'Riverton Central', viaStation: ' ', toStation: 'Hillford Central' },
      }),
    ).toBe('Riverton Central → Hillford Central')
  })

  it('marks future starts within three days as high priority (resolution #11)', () => {
    const now = new Date('2026-10-13T08:00:00Z')
    expect(isHighPriority('to_book', '2026-10-15T08:00:00Z', now)).toBe(true)
    expect(isHighPriority('pending_approval', '2026-10-17T08:00:00Z', now)).toBe(false)
    expect(isHighPriority('to_book', '2026-10-12T08:00:00Z', now)).toBe(false)
    expect(isHighPriority('booked', '2026-10-14T08:00:00Z', now)).toBe(false)
  })

  it('checks the driver age on the pickup day', () => {
    expect(isAdultOn('2008-10-14', '2026-10-13')).toBe(false)
    expect(isAdultOn('2008-10-13', '2026-10-13')).toBe(true)
  })

  it('formats references and titles', () => {
    expect(travelReference(7)).toBe('TRV-000007')
    expect(requestTitle({ kind: 'car', route: 'Riverton → Westbay' })).toBe('Car rental to Westbay')
  })

  it('says "Approved" on the chip once the request has been decided', () => {
    const reasons = [{ code: 'flight' as const, label: 'Flights always need approval' }]
    const base = { needsApproval: true, approvalReasons: reasons, approvalExemption: null }
    expect(approvalChip({ ...base, status: 'pending_approval' }).label).toBe(
      'Needs approval · 1 reason',
    )
    expect(approvalChip({ ...base, status: 'to_book' }).label).toBe('Approved · 1 reason')
    expect(
      approvalChip({ needsApproval: false, approvalReasons: [], approvalExemption: null }).label,
    ).toBe('No approval needed')
  })
})

describe('stepper error mapping', () => {
  it('maps API dot paths onto the form fields', () => {
    expect(
      toFormErrors(
        {
          'car.destination': ['Where are you driving to?'],
          travellerId: ['Pick a traveller.'],
          'recharge.projectNumber': ['Add the project number.'],
          'car.equipment.automaticRequired': ['Choose one.'],
        },
        'car',
      ),
    ).toEqual({
      destination: 'Where are you driving to?',
      traveller: 'Pick a traveller.',
      rechargeProjectNumber: 'Add the project number.',
      gearbox: 'Choose one.',
    })
    expect(toFormErrors({ 'train.companionIds.2': ['Not found.'] }, 'train')).toEqual({
      companions: 'Not found.',
    })
  })
})
