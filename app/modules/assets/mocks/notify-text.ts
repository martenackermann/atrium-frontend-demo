/**
 * In-app notification texts of the assets module (SPEC §7) — same subject/body/link as the backend
 * templates (src/modules/assets/mail/*.notification.ts). Pure helpers for seed and handlers.
 */
export interface NotificationText {
  templateId: string
  title: string
  body: string
  link: string | null
}

export function assignmentPendingText(c: {
  deviceType: string
  model: string
  assetTag: string
  serialNumber: string
  assignedBy: string
  dueDate: string
  assetId: string
}): NotificationText {
  return {
    templateId: 'assets.assignment_pending',
    title: `Confirm your new ${c.deviceType}`,
    body: `${c.assignedBy} assigned ${c.model} (${c.assetTag}, serial ${c.serialNumber}) to you. Accept or decline it by ${c.dueDate}.`,
    link: `/assets/${c.assetId}`,
  }
}

export function acceptanceReminderText(c: {
  deviceType: string
  model: string
  assetTag: string
  assignedOn: string
  reminder: number
  reminderMax: number
  assetId: string
}): NotificationText {
  return {
    templateId: 'assets.acceptance_reminder',
    title: `Reminder: confirm your ${c.deviceType}`,
    body: `${c.model} (${c.assetTag}) was assigned to you on ${c.assignedOn} and is still waiting for your confirmation. Reminder ${c.reminder} of ${c.reminderMax}.`,
    link: `/assets/${c.assetId}`,
  }
}

export function returnedText(c: {
  model: string
  assetTag: string
  condition: 'ok' | 'damaged'
}): NotificationText {
  return {
    templateId: 'assets.returned',
    title: `Return confirmed: ${c.assetTag}`,
    body: `IT support has ${c.model} (${c.assetTag}) back${c.condition === 'damaged' ? '. It was damaged and goes to repair' : ' in good condition'}. It is no longer assigned to you.`,
    link: '/assets',
  }
}
