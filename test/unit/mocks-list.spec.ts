import { describe, expect, it } from 'vitest'
import { listResult } from '~/mocks/list'

interface Row {
  id: string
  title: string
  status: 'open' | 'booked' | 'declined'
  cost: number | null
  tags: string[]
}

const rows: Row[] = [
  { id: '1', title: 'Excel advanced', status: 'open', cost: 400, tags: ['office'] },
  { id: '2', title: 'Project management basics', status: 'booked', cost: 1200, tags: ['pm'] },
  { id: '3', title: 'Excel basics', status: 'booked', cost: null, tags: ['office', 'intro'] },
  { id: '4', title: 'Leadership workshop', status: 'declined', cost: 5200, tags: [] },
]

const query = (params: Record<string, string>) =>
  new URL(`http://localhost/api/v1/items?${new URLSearchParams(params)}`)

const options = {
  search: ['title'] as Array<keyof Row & string>,
  filters: { status: 'status', tag: 'tags' } as const,
  sort: ['title', 'cost'] as Array<keyof Row & string>,
  defaultSort: 'title',
}

describe('listResult', () => {
  it('paginates with meta', () => {
    const result = listResult(rows, query({ perPage: '3', page: '2' }), options)
    expect(result.meta).toEqual({ page: 2, perPage: 3, total: 4, totalPages: 2 })
    expect(result.data.map((row) => row.id)).toEqual(['2'])
  })

  it('filters by exact value, comma-separated values and array fields', () => {
    expect(listResult(rows, query({ status: 'booked' }), options).meta.total).toBe(2)
    expect(listResult(rows, query({ status: 'open,declined' }), options).meta.total).toBe(2)
    expect(listResult(rows, query({ tag: 'intro' }), options).data.map((r) => r.id)).toEqual(['3'])
  })

  it('searches every term case-insensitively', () => {
    const result = listResult(rows, query({ q: 'EXCEL bas' }), options)
    expect(result.data.map((row) => row.id)).toEqual(['3'])
  })

  it('sorts descending with nulls last', () => {
    const result = listResult(rows, query({ sort: '-cost' }), options)
    expect(result.data.map((row) => row.id)).toEqual(['4', '2', '1', '3'])
  })

  it('rejects unsupported sort fields with a 422 problem (errors.sort)', () => {
    let thrown: unknown
    try {
      listResult(rows, query({ sort: 'secret' }), options)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(422)
    expect((thrown as Response).headers.get('Content-Type')).toBe('application/problem+json')
  })
})
