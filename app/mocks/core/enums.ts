/**
 * Core enums for GET /meta/enums (API.md §3.6). Module enums come from each module's
 * mocks/providers.ts. Tones are DESIGN tones (SPEC_RESOLUTIONS #8).
 */
import type { EnumOption } from '~/types/api'

const option = (value: string, label: string, description: string | null = null): EnumOption => ({
  value,
  label,
  tone: null,
  description,
})

export const CORE_ENUMS: Record<string, EnumOption[]> = {
  role: [
    option('employee', 'Employee'),
    option('manager', 'Manager', 'Derived: has active direct reports'),
    option('executive', 'Executive'),
    option('training_office', 'Training office'),
    option('travel_desk', 'Travel desk'),
    option('asset_admin', 'Asset admin'),
    option('people_ops', 'People ops'),
    option('news_editor', 'News editor'),
    option('it_admin', 'IT admin'),
  ],
  actingAs: [
    option('self', 'Self'),
    option('requester', 'Requester'),
    option('approver', 'Approver'),
    option('deputy', 'Deputy'),
    option('manager_chain', 'Manager chain'),
    option('executive', 'Executive'),
    option('back_office', 'Back office'),
    option('admin', 'Admin'),
    option('system', 'System'),
  ],
  approverReason: [
    option('direct_manager', 'Direct manager'),
    option('site_manager_escalation', 'Escalated past site manager'),
    option('manager_unavailable', 'Manager unavailable'),
    option('executive_self', 'Executive self-approval'),
    option('fallback', 'Fallback approver'),
  ],
  autoApproval: [
    option('executive_self', 'Approved automatically (executive)'),
    option('requester_is_approver', 'Approved automatically (requested by approver)'),
    option('same_approver', 'Approved automatically (same approver)'),
  ],
}
