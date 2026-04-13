import { describe, it, expect } from 'vitest'
import * as pkg from '../../src/index.js'
import * as locate from '../../src/locate/index.js'

describe('public index', () => {
  it('exports the Reflection facade and reflection classes', () => {
    expect(pkg.Reflection).toBeDefined()
    expect(pkg.StepReflection).toBeDefined()
    expect(pkg.TestReflection).toBeDefined()
    expect(pkg.SuiteReflection).toBeDefined()
    expect(pkg.Edit).toBeDefined()
    expect(pkg.Batch).toBeDefined()
  })

  it('exports the full error hierarchy', () => {
    expect(pkg.ReflectionError).toBeDefined()
    expect(pkg.UnsupportedSourceError).toBeDefined()
    expect(pkg.MissingPeerError).toBeDefined()
    expect(pkg.LocateError).toBeDefined()
    expect(pkg.NotFoundError).toBeDefined()
    expect(pkg.AmbiguousLocateError).toBeDefined()
    expect(pkg.StaleEditError).toBeDefined()
    expect(pkg.OverlappingEditError).toBeDefined()
  })

  it('locate/index re-exports the locate functions', () => {
    expect(locate.locateStepByPosition).toBeDefined()
    expect(locate.locateTestByTitle).toBeDefined()
    expect(locate.locateSuiteByTitle).toBeDefined()
  })
})
