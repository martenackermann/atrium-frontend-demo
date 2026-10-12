import { describe, expect, it } from 'vitest'
import { ApiError, toApiError, toFieldPath, toNetworkError, unwrap } from '~/lib/api'

const response = (status: number, statusText = '') => ({ status, statusText })

describe('problem+json normalisation', () => {
  it('maps RFC 9457 problems with field errors', () => {
    const error = toApiError(response(422), {
      type: 'https://atrium.example.com/problems/validation',
      title: 'Validation failed',
      status: 422,
      detail: 'Please check the highlighted fields.',
      errors: [
        { field: 'title', message: 'Required' },
        { pointer: '/attendees/0/email', message: 'Invalid email' },
      ],
    })
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.isValidationError).toBe(true)
    expect(error.fieldErrors).toEqual({
      title: ['Required'],
      'attendees[0].email': ['Invalid email'],
    })
  })

  it('accepts object-style and invalid-params field errors', () => {
    expect(toApiError(response(400), { fieldErrors: { name: 'Too short' } }).fieldErrors).toEqual({
      name: ['Too short'],
    })
    expect(
      toApiError(response(400), { 'invalid-params': [{ name: 'age', reason: 'Too low' }] })
        .fieldErrors,
    ).toEqual({ age: ['Too low'] })
  })

  it('falls back to NestJS error bodies and status texts', () => {
    const nest = toApiError(response(403), { statusCode: 403, message: 'Nope', error: 'Forbidden' })
    expect([nest.title, nest.detail]).toEqual(['Forbidden', 'Nope'])
    expect(toApiError(response(500), undefined).title).toBe('Server error')
  })

  it('normalises field paths', () => {
    expect(toFieldPath('attendees.1.goals.0')).toBe('attendees[1].goals[0]')
    expect(toFieldPath(['hotel', 'checkIn'])).toBe('hotel.checkIn')
    expect(toFieldPath('')).toBeUndefined()
  })

  it('unwrap returns data or throws ApiError (network errors -> status 0)', async () => {
    const ok = { data: { id: '1' }, response: new Response(null, { status: 200 }) }
    await expect(unwrap(Promise.resolve(ok))).resolves.toEqual({ id: '1' })

    const failed = {
      error: { title: 'Not found', status: 404 },
      response: new Response(null, { status: 404 }),
    }
    await expect(unwrap(Promise.resolve(failed))).rejects.toMatchObject({ status: 404 })

    await expect(unwrap(Promise.reject(new TypeError('fetch failed')))).rejects.toMatchObject({
      status: 0,
      title: 'Network error',
    })
    expect(toNetworkError(new DOMException('aborted', 'AbortError')).title).toBe(
      'Request cancelled',
    )
  })
})
