import { describe, it, expect } from 'vitest'
import {
  ReflectionError,
  UnsupportedSourceError,
  MissingPeerError,
  LocateError,
  NotFoundError,
  AmbiguousLocateError,
  StaleEditError,
  OverlappingEditError,
} from '../../src/errors.js'

describe('errors', () => {
  it('ReflectionError carries code and filePath', () => {
    const e = new ReflectionError('boom', { filePath: '/x.js' })
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('REFLECTION_ERROR')
    expect(e.filePath).toBe('/x.js')
    expect(e.message).toBe('boom')
  })

  it('UnsupportedSourceError inherits from ReflectionError', () => {
    const e = new UnsupportedSourceError('nope', { filePath: '/x.feature' })
    expect(e).toBeInstanceOf(ReflectionError)
    expect(e.code).toBe('UNSUPPORTED_SOURCE')
  })

  it('MissingPeerError inherits from ReflectionError', () => {
    const e = new MissingPeerError('no ts')
    expect(e).toBeInstanceOf(ReflectionError)
    expect(e.code).toBe('MISSING_PEER')
  })

  it('NotFoundError inherits from LocateError and ReflectionError', () => {
    const e = new NotFoundError('nope')
    expect(e).toBeInstanceOf(LocateError)
    expect(e).toBeInstanceOf(ReflectionError)
    expect(e.code).toBe('NOT_FOUND')
  })

  it('AmbiguousLocateError carries candidates', () => {
    const e = new AmbiguousLocateError('multi', {
      candidates: [{ start: 0, end: 1 }, { start: 2, end: 3 }],
    })
    expect(e).toBeInstanceOf(LocateError)
    expect(e.code).toBe('AMBIGUOUS_LOCATE')
    expect(e.candidates).toHaveLength(2)
  })

  it('StaleEditError and OverlappingEditError have distinct codes', () => {
    expect(new StaleEditError('x').code).toBe('STALE_EDIT')
    expect(new OverlappingEditError('x').code).toBe('OVERLAPPING_EDIT')
  })

  it('preserves cause when provided', () => {
    const inner = new Error('inner')
    const e = new ReflectionError('outer', { cause: inner })
    expect(e.cause).toBe(inner)
  })
})
