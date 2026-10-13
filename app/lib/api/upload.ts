import type { AttachmentDto, AttachmentPurpose } from '~/types/api'
import { ApiError, toApiError, toNetworkError } from './errors'
import { newIdempotencyKey } from './http'

export interface UploadOptions {
  baseUrl: string
  token: string | null | undefined
  file: File
  purpose: AttachmentPurpose
  /** 0–1 */
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/**
 * Staged upload (API.md §1 "Uploads"): `POST /attachments` (multipart `file` + `purpose`) →
 * AttachmentDto. Link it afterwards by id via `attachmentIds` in a JSON body.
 * Uses XMLHttpRequest because fetch has no upload progress.
 */
export function uploadAttachment(options: UploadOptions): Promise<AttachmentDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${options.baseUrl.replace(/\/+$/, '')}/attachments`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.setRequestHeader('Idempotency-Key', newIdempotencyKey())
    if (options.token) xhr.setRequestHeader('Authorization', `Bearer ${options.token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
    }
    xhr.onerror = () => reject(toNetworkError(new TypeError('Upload failed')))
    xhr.onabort = () => reject(toNetworkError(new DOMException('Upload cancelled', 'AbortError')))
    xhr.onload = () => {
      let body: unknown = xhr.responseText
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // keep text
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1)
        resolve(body as AttachmentDto)
      } else {
        reject(
          toApiError(
            { status: xhr.status, statusText: xhr.statusText, headers: new Headers() },
            body,
          ),
        )
      }
    }

    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })

    const form = new FormData()
    form.append('file', options.file)
    form.append('purpose', options.purpose)
    xhr.send(form)
  })
}

export function isUploadError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
