/**
 * Attachments for mocks (API.md §3.4, SPEC §4.1, D11): staged upload → link by id → 5-minute signed
 * download URL → `/files/{token}`. Metadata lives in the mock database; uploaded bytes are kept in
 * memory for the session. Seeded or reloaded files are served as a generated one-page PDF.
 */
import type { AttachmentDto, AttachmentPurpose, RoleName } from '~/types/api'
import type { MockDb } from '../db'
import { userRefById } from './org'
import type { MockAttachment } from './types'

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024

const DOCUMENTS = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/** Allowed MIME types by purpose (SPEC §4.1). */
export const ALLOWED_MIME_TYPES: Record<AttachmentPurpose, string[]> = {
  training_document: DOCUMENTS,
  training_booking_document: DOCUMENTS,
  travel_booking_confirmation: ['application/pdf'],
  news_cover: ['image/png', 'image/jpeg', 'image/webp'],
  people_document: DOCUMENTS,
}

/** Who may upload for a purpose (API.md §3.4). null = anyone. */
export const UPLOAD_ROLES: Record<AttachmentPurpose, RoleName[] | null> = {
  training_document: null,
  training_booking_document: ['training_office', 'it_admin'],
  travel_booking_confirmation: ['travel_desk', 'it_admin'],
  news_cover: ['news_editor', 'it_admin'],
  people_document: null,
}

const blobs = new Map<string, Blob>()

export function storeBlob(attachmentId: string, blob: Blob) {
  blobs.set(attachmentId, blob)
}

export function toAttachmentDto(db: MockDb, row: MockAttachment): AttachmentDto {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    purpose: row.purpose,
    uploadedBy: userRefById(db, row.uploadedById) ?? {
      id: row.uploadedById,
      displayName: 'Atrium',
      email: 'no-reply@example.com',
      jobTitle: null,
      initials: 'AT',
    },
    createdAt: row.createdAt,
  }
}

/**
 * Link staged attachments to an entity (slices call this in create/action handlers). Returns the
 * DTOs; ids that are not staged uploads of `uploaderId` are ignored.
 */
export function linkAttachments(
  db: MockDb,
  ids: readonly string[] | undefined | null,
  target: {
    entityType: string
    entityId: string
    uploaderId?: string
    purpose?: AttachmentPurpose
  },
): AttachmentDto[] {
  const linked: AttachmentDto[] = []
  for (const id of ids ?? []) {
    const row = db.attachments.find(id)
    if (!row || row.entityId) continue
    if (target.uploaderId && row.uploadedById !== target.uploaderId) continue
    if (target.purpose && row.purpose !== target.purpose) continue
    const updated = db.attachments.update(id, {
      entityType: target.entityType,
      entityId: target.entityId,
      linkedAt: new Date().toISOString(),
    })!
    linked.push(toAttachmentDto(db, updated))
  }
  return linked
}

export function attachmentsOf(db: MockDb, entityType: string, entityId: string): AttachmentDto[] {
  return db.attachments
    .where((row) => row.entityType === entityType && row.entityId === entityId)
    .map((row) => toAttachmentDto(db, row))
}

/** Seed helper: an already linked attachment (served as a generated PDF). */
export function seedAttachment(
  db: MockDb,
  input: Omit<MockAttachment, 'id' | 'linkedAt' | 'mimeType' | 'sizeBytes'> & {
    id?: string
    mimeType?: string
    sizeBytes?: number
  },
): MockAttachment {
  return db.attachments.insert({
    mimeType: 'application/pdf',
    sizeBytes: 18_432,
    linkedAt: input.entityId ? input.createdAt : null,
    ...input,
  })
}

// Signed tokens: base64url("<attachmentId>.<expiresMs>.<userId>") — opaque to the client.
const encode = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = (token: string) => {
  try {
    return atob(token.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return ''
  }
}

export function signDownload(
  attachmentId: string,
  userId: string,
  disposition: 'attachment' | 'inline' = 'attachment',
  ttlMs = 5 * 60_000,
) {
  const expiresAt = Date.now() + ttlMs
  return {
    token: encode(`${attachmentId}.${expiresAt}.${userId}.${disposition}`),
    expiresAt: new Date(expiresAt),
  }
}

export function verifyDownload(
  token: string,
): { attachmentId: string; disposition: 'attachment' | 'inline' } | null {
  const [attachmentId, expires, , disposition] = decode(token).split('.')
  if (!attachmentId || !expires || Number(expires) < Date.now()) return null
  return { attachmentId, disposition: disposition === 'inline' ? 'inline' : 'attachment' }
}

/** The stored bytes, or a one-page PDF naming the file (seeded / reloaded files). */
export function fileBody(row: MockAttachment): Blob {
  const stored = blobs.get(row.id)
  if (stored) return stored
  if (row.mimeType.startsWith('image/')) return placeholderPng()
  return placeholderPdf(row.originalName)
}

function placeholderPdf(title: string): Blob {
  const safe = title.replace(/[()\\]/g, '').slice(0, 80)
  const text = `BT /F1 20 Tf 72 720 Td (Demo document) Tj 0 -32 Td /F1 12 Tf (${safe}) Tj 0 -20 Td (Generated by the Atrium offline demo.) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Blob([body], { type: 'application/pdf' })
}

function placeholderPng(): Blob {
  // 1×1 warm paper pixel.
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8+/fvfwAJkAPx3b6bJQAAAABJRU5ErkJggg=='
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}
