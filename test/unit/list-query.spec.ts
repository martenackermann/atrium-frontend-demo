import { describe, expect, it } from 'vitest'
import {
  nextSort,
  parseListQuery,
  serializeListQuery,
  sortDirection,
  toApiQuery,
  type ListQueryOptions,
} from '~/lib/list-query'

const options: ListQueryOptions = {
  filters: ['status', 'kind'],
  multi: ['status'],
  defaultSort: '-createdAt',
}

describe('DataTable query state', () => {
  it('parses page, perPage, sort, search and filters from the URL', () => {
    const state = parseListQuery(
      {
        page: '3',
        perPage: '50',
        sort: 'title',
        q: 'excel',
        status: 'to_book,booked',
        kind: 'car',
        other: 'x',
      },
      options,
    )
    expect(state).toEqual({
      page: 3,
      perPage: 50,
      sort: 'title',
      q: 'excel',
      filters: { status: ['to_book', 'booked'], kind: 'car' },
    })
  })

  it('falls back to defaults for missing or invalid values and caps perPage at 100', () => {
    const state = parseListQuery({ page: '-2', perPage: '500' }, options)
    expect(state.page).toBe(1)
    expect(state.perPage).toBe(100)
    expect(state.sort).toBe('-createdAt')
    expect(state.filters).toEqual({})
  })

  it('writes only non-default values and keeps unrelated keys', () => {
    const query = serializeListQuery(
      {
        page: 1,
        perPage: 25,
        sort: '-createdAt',
        q: ' ',
        filters: { status: ['to_book'], kind: '' },
      },
      options,
      { selected: 'abc' },
    )
    expect(query).toEqual({ selected: 'abc', status: 'to_book' })
  })

  it('round-trips through the URL', () => {
    const state = parseListQuery({ page: '2', sort: 'title', status: 'a,b' }, options)
    const again = parseListQuery(
      serializeListQuery(state, options) as Record<string, string>,
      options,
    )
    expect(again).toEqual(state)
  })

  it('builds API params with comma-joined lists', () => {
    const state = parseListQuery({ status: 'to_book,booked', q: ' anna ' }, options)
    expect(toApiQuery(state)).toEqual({
      page: 1,
      perPage: 25,
      sort: '-createdAt',
      q: 'anna',
      status: 'to_book,booked',
    })
  })

  it('cycles header sort field → -field → default', () => {
    expect(nextSort(null, 'title')).toBe('title')
    expect(nextSort('title', 'title')).toBe('-title')
    expect(nextSort('-title', 'title')).toBeNull()
    expect(nextSort('-createdAt', 'title')).toBe('title')
    expect(sortDirection('-title', 'title')).toBe('desc')
    expect(sortDirection('cost', 'title')).toBeNull()
  })
})
