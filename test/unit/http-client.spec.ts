import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, toSearchParams } from '~/lib/api/http'
import { isApiError } from '~/lib/api'

interface Call {
  url: string
  method: string
  headers: Headers
  body: string | undefined
}

function fakeFetch(response: () => Response) {
  const calls: Call[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    return response()
  })
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch }
}

const json = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } })

describe('HTTP client', () => {
  it('serialises queries: lists comma-joined, empty values dropped', () => {
    expect(
      toSearchParams({ status: ['to_book', 'booked'], q: '', page: 2, high: true, x: null }),
    ).toBe('?status=to_book%2Cbooked&page=2&high=true')
    expect(toSearchParams({})).toBe('')
  })

  it('sends the bearer token and an Idempotency-Key on POST only', async () => {
    const { calls, fetch } = fakeFetch(() => json({ ok: true }))
    const api = createHttpClient({
      baseUrl: 'http://api.test/api/v1/',
      getToken: () => 't1',
      fetch,
    })
    await api.get('/me')
    await api.post('/me/deputies', { deputyId: 'u1' })
    await api.post('/me/deputies', {}, { idempotencyKey: 'stable-key' })

    expect(calls[0]!.url).toBe('http://api.test/api/v1/me')
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer t1')
    expect(calls[0]!.headers.has('Idempotency-Key')).toBe(false)
    expect(calls[1]!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
    expect(calls[1]!.body).toBe('{"deputyId":"u1"}')
    expect(calls[2]!.headers.get('Idempotency-Key')).toBe('stable-key')
  })

  it('posts workflow actions to <resource>/actions/<action>', async () => {
    const { calls, fetch } = fakeFetch(() => json({ id: 'r1' }))
    const api = createHttpClient({ baseUrl: 'http://api.test/api/v1', getToken: () => null, fetch })
    await api.action('/travel/requests/r1/', 'decline', { reason: 'Budget' })
    expect(calls[0]).toMatchObject({
      url: 'http://api.test/api/v1/travel/requests/r1/actions/decline',
      method: 'POST',
      body: '{"reason":"Budget"}',
    })
  })

  it('turns problem+json into ApiError with field errors', async () => {
    const { fetch } = fakeFetch(() =>
      json(
        {
          type: 'about:blank',
          title: 'Validation failed',
          status: 422,
          code: 'validation_failed',
          traceId: 'abc',
          errors: { 'legs.0.date': ['Choose a date.'] },
        },
        422,
        'application/problem+json',
      ),
    )
    const api = createHttpClient({ baseUrl: 'http://api.test', getToken: () => 't', fetch })
    const error = await api.post('/travel/requests', {}).catch((caught: unknown) => caught)
    expect(isApiError(error)).toBe(true)
    if (!isApiError(error)) return
    expect(error.status).toBe(422)
    expect(error.code).toBe('validation_failed')
    expect(error.isValidationError).toBe(true)
    expect(error.fieldError('legs[0].date')).toBe('Choose a date.')
  })

  it('calls onUnauthorized for a 401 on an authenticated request', async () => {
    const onUnauthorized = vi.fn()
    const { fetch } = fakeFetch(() =>
      json(
        { title: 'Unauthenticated', status: 401, code: 'unauthenticated' },
        401,
        'application/problem+json',
      ),
    )
    const signedIn = createHttpClient({
      baseUrl: 'http://api.test',
      getToken: () => 't',
      fetch,
      onUnauthorized,
    })
    await signedIn.get('/me').catch(() => undefined)
    const anonymous = createHttpClient({
      baseUrl: 'http://api.test',
      getToken: () => null,
      fetch,
      onUnauthorized,
    })
    await anonymous.post('/auth/login', {}).catch(() => undefined)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for 204', async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 204 }))
    const api = createHttpClient({ baseUrl: 'http://api.test', getToken: () => 't', fetch })
    await expect(api.delete('/me/deputies/1')).resolves.toBeUndefined()
  })

  it('rejects a 2xx that is not JSON (e.g. an SPA fallback page) instead of returning it', async () => {
    const html = '<!DOCTYPE html><html><head><title>Atrium</title></head></html>'
    const { fetch } = fakeFetch(
      () => new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    const api = createHttpClient({ baseUrl: 'http://api.test', getToken: () => 't', fetch })
    const error = await api.post('/travel/requests/preview', {}).catch((e: unknown) => e)
    expect(isApiError(error) && error.code).toBe('invalid_response')
    // Explicit text and blob reads stay untouched.
    await expect(api.get('/x', undefined, { parse: 'text' })).resolves.toBe(html)
  })
})
