import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SuiteReflection } from '../../src/suite.js'
import { clearCache } from '../../src/parser.js'
import { NotFoundError, AmbiguousLocateError, ReflectionError } from '../../src/errors.js'
import { mockSuite } from '../helpers/mock-suite.js'

function tmp(contents) {
  const p = path.join(os.tmpdir(), `reflection-hook-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  fs.writeFileSync(p, contents)
  return p
}

describe('SuiteReflection.hooks listing', () => {
  beforeEach(() => clearCache())

  it('lists hooks in source order, tagged by kind', () => {
    const file = tmp(
      `Feature('Auth')

BeforeSuite(async ({ I }) => { I.amOnPage('/') })
Before(async ({ I }) => { I.clearCookie() })

Scenario('x', async ({ I }) => { I.see('Welcome') })

After(async ({ I }) => { I.saveScreenshot('after.png') })
AfterSuite(async () => {})
`,
    )
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
      expect(sur.hooks.map(h => h.kind)).toEqual(['BeforeSuite', 'Before', 'After', 'AfterSuite'])
      for (const h of sur.hooks) {
        expect(h.line).toBeGreaterThan(0)
        expect(h.range.start).toBeLessThan(h.range.end)
      }
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('returns an empty list when the suite has no hooks', () => {
    const file = tmp(`Feature('X')\n\nScenario('a', async ({ I }) => {})\n`)
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'X', file }))
      expect(sur.hooks).toEqual([])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('scoped to this suite only — does not leak into the next Feature', () => {
    const file = tmp(
      `Feature('First')

BeforeSuite(async () => {})

Scenario('a', async ({ I }) => {})

Feature('Second')

Before(async () => {})

Scenario('b', async ({ I }) => {})
`,
    )
    try {
      const first = new SuiteReflection(mockSuite({ title: 'First', file }))
      const second = new SuiteReflection(mockSuite({ title: 'Second', file }))
      expect(first.hooks.map(h => h.kind)).toEqual(['BeforeSuite'])
      expect(second.hooks.map(h => h.kind)).toEqual(['Before'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('findHook filters to a specific kind', () => {
    const file = tmp(
      `Feature('X')

Before(async () => { /* one */ })
Before(async () => { /* two */ })

Scenario('a', async () => {})
`,
    )
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'X', file }))
      expect(sur.findHook('Before')).toHaveLength(2)
      expect(sur.findHook('After')).toEqual([])
    } finally {
      fs.unlinkSync(file)
    }
  })
})

describe('SuiteReflection.addHook', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

Scenario('signs in', async ({ I }) => {
  I.amOnPage('/')
})
`,
    )
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('inserts a hook right after the Feature call when the suite has none', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur.addHook('BeforeSuite', `BeforeSuite(async ({ I }) => { I.amOnPage('/seed') })`).apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain('BeforeSuite')
    // BeforeSuite should land before Scenario('signs in')
    expect(after.indexOf('BeforeSuite')).toBeLessThan(after.indexOf("Scenario('signs in'"))
    clearCache()
    const sur2 = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(sur2.hooks.map(h => h.kind)).toEqual(['BeforeSuite'])
  })

  it('appends after existing hooks by default', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur.addHook('BeforeSuite', `BeforeSuite(async () => {})`).apply()
    clearCache()
    const sur2 = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur2.addHook('Before', `Before(async () => {})`).apply()
    clearCache()
    const sur3 = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(sur3.hooks.map(h => h.kind)).toEqual(['BeforeSuite', 'Before'])
  })

  it('rejects unknown hook kinds', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(() => sur.addHook('BeforeEach', `x()`)).toThrow(ReflectionError)
  })

  it('inserts within the current suite only, never past the next Feature', () => {
    const multi = tmp(
      `Feature('First')

Scenario('a', async () => {})

Feature('Second')

Scenario('b', async () => {})
`,
    )
    try {
      const first = new SuiteReflection(mockSuite({ title: 'First', file: multi }))
      first.addHook('BeforeSuite', `BeforeSuite(async () => { /* first only */ })`).apply()
      const after = fs.readFileSync(multi, 'utf8')
      const hookPos = after.indexOf('BeforeSuite')
      const secondFeaturePos = after.indexOf("Feature('Second')")
      expect(hookPos).toBeGreaterThan(0)
      expect(hookPos).toBeLessThan(secondFeaturePos)
    } finally {
      fs.unlinkSync(multi)
    }
  })
})

describe('SuiteReflection.removeHook', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

BeforeSuite(async ({ I }) => { I.amOnPage('/seed') })
Before(async ({ I }) => { I.clearCookie() })

Scenario('a', async ({ I }) => {})
`,
    )
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('removes a single matching hook', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur.removeHook('BeforeSuite').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).not.toContain('BeforeSuite')
    expect(after).toContain('Before(async') // Before still there
    expect(after).toContain("Scenario('a'") // scenario still there
  })

  it('throws NotFoundError when no hook of that kind exists', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(() => sur.removeHook('AfterSuite')).toThrow(NotFoundError)
  })

  it('throws AmbiguousLocateError when multiple hooks match and no index given', () => {
    const multi = tmp(
      `Feature('X')

Before(async () => { /* one */ })
Before(async () => { /* two */ })

Scenario('a', async () => {})
`,
    )
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'X', file: multi }))
      expect(() => sur.removeHook('Before')).toThrow(AmbiguousLocateError)
    } finally {
      fs.unlinkSync(multi)
    }
  })

  it('disambiguates multiple hooks with { index }', () => {
    const multi = tmp(
      `Feature('X')

Before(async () => { /* one */ })
Before(async () => { /* two */ })

Scenario('a', async () => {})
`,
    )
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'X', file: multi }))
      sur.removeHook('Before', { index: 0 }).apply()
      const after = fs.readFileSync(multi, 'utf8')
      expect(after).toContain('/* two */')
      expect(after).not.toContain('/* one */')
    } finally {
      fs.unlinkSync(multi)
    }
  })

  it('throws NotFoundError on out-of-range index', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(() => sur.removeHook('BeforeSuite', { index: 5 })).toThrow(NotFoundError)
  })
})

describe('SuiteReflection.replaceHook', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

Before(async ({ I }) => { I.clearCookie() })

Scenario('a', async ({ I }) => {})
`,
    )
  })
  afterEach(() => { try { fs.unlinkSync(file) } catch {} })

  it('replaces an existing hook body', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur
      .replaceHook('Before', `Before(async ({ I }) => { I.amOnPage('/login') })`)
      .apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("I.amOnPage('/login')")
    expect(after).not.toContain('I.clearCookie')
  })

  it('throws NotFoundError when no hook exists to replace', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(() => sur.replaceHook('AfterSuite', `AfterSuite(async () => {})`)).toThrow(NotFoundError)
  })
})
