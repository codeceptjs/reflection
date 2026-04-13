import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SuiteReflection } from '../../src/suite.js'
import { clearCache } from '../../src/parser.js'
import { NotFoundError } from '../../src/errors.js'
import { mockSuite } from '../helpers/mock-suite.js'

function tmp(contents) {
  const p = path.join(os.tmpdir(), `reflection-suite-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  fs.writeFileSync(p, contents)
  return p
}

describe('SuiteReflection.tests', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

Scenario('a', async ({ I }) => {
  I.amOnPage('/a')
})

Scenario('b', async ({ I, loginPage }) => {
  loginPage.login('u', 'p')
})
`,
    )
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  it('lists tests in the suite', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(sur.tests).toHaveLength(2)
    expect(sur.tests.map(t => t.title)).toEqual(['a', 'b'])
  })

  it('includes the range of each test', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    const t = sur.tests[0]
    expect(t.range.start).toBeLessThan(t.range.end)
    const source = fs.readFileSync(file, 'utf8')
    expect(source.slice(t.range.start, t.range.end)).toContain("Scenario('a'")
  })
})

describe('SuiteReflection.dependencies', () => {
  beforeEach(() => clearCache())

  it('returns unique deps across all tests in the suite', () => {
    const file = tmp(
      `Feature('X')

Scenario('a', async ({ I }) => {
  I.amOnPage('/')
})

Scenario('b', async ({ I, loginPage }) => {
  loginPage.login()
})
`,
    )
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'X', file }))
      expect(sur.dependencies.sort()).toEqual(['I', 'loginPage'])
    } finally {
      fs.unlinkSync(file)
    }
  })

  it('scoped to this suite only (does not bleed into next Feature)', () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname)
    const fix = path.resolve(__dirname, '../fixtures/js/multi-suite.scenario.js')
    const first = new SuiteReflection(mockSuite({ title: 'First', file: fix }))
    const second = new SuiteReflection(mockSuite({ title: 'Second', file: fix }))
    expect(first.tests.map(t => t.title)).toEqual(['a1', 'a2'])
    expect(second.tests.map(t => t.title)).toEqual(['b1'])
    expect(first.dependencies.sort()).toEqual(['I', 'loginPage'])
    expect(second.dependencies.sort()).toEqual(['I', 'dashboardPage'].sort())
  })
})

describe('SuiteReflection.addTest', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

Scenario('existing', async ({ I }) => {
  I.amOnPage('/')
})
`,
    )
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  it('inserts a new test at the end and returns an Edit', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    const edit = sur.addTest(
      `Scenario('new', async ({ I }) => {
  I.amOnPage('/new')
})`,
    )
    const preview = edit.preview()
    // Preserves existing content
    expect(preview).toContain("Scenario('existing'")
    // Adds new content after existing
    expect(preview).toContain("Scenario('new'")
    expect(preview.indexOf("Scenario('existing'")).toBeLessThan(preview.indexOf("Scenario('new'"))
  })

  it('apply() writes the new test to disk', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur
      .addTest(
        `Scenario('added', async ({ I }) => {
  I.amOnPage('/added')
})`,
      )
      .apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("Scenario('added'")
    expect(after).toContain("Scenario('existing'")
  })

  it('inserts into an empty suite (no existing Scenarios)', () => {
    const empty = tmp(`Feature('Empty')\n`)
    try {
      const sur = new SuiteReflection(mockSuite({ title: 'Empty', file: empty }))
      const preview = sur
        .addTest(`Scenario('first', async ({ I }) => { I.amOnPage('/') })`)
        .preview()
      expect(preview).toContain("Scenario('first'")
      expect(preview).toContain("Feature('Empty')")
    } finally {
      fs.unlinkSync(empty)
    }
  })

  it('scopes insertion to the correct suite in a multi-suite file', () => {
    const multi = tmp(
      `Feature('First')

Scenario('a1', async ({ I }) => {})

Feature('Second')

Scenario('b1', async ({ I }) => {})
`,
    )
    try {
      const first = new SuiteReflection(mockSuite({ title: 'First', file: multi }))
      const preview = first
        .addTest(`Scenario('a2', async ({ I }) => { I.amOnPage('/a2') })`)
        .preview()
      // The new scenario should land BEFORE Feature('Second')
      const newPos = preview.indexOf("Scenario('a2'")
      const secondFeaturePos = preview.indexOf("Feature('Second')")
      expect(newPos).toBeGreaterThan(0)
      expect(newPos).toBeLessThan(secondFeaturePos)
    } finally {
      fs.unlinkSync(multi)
    }
  })
})

describe('SuiteReflection on TypeScript files', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = path.join(os.tmpdir(), `reflection-suite-ts-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`)
    fs.writeFileSync(
      file,
      `Feature('TS')

Scenario('t1', async ({ I }: { I: CodeceptJS.I }) => {
  I.amOnPage('/t1')
})

Scenario('t2', async ({ I, loginPage }: { I: CodeceptJS.I; loginPage: any }) => {
  loginPage.login()
})
`,
    )
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  it('lists tests in a TS suite', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'TS', file }))
    expect(sur.tests.map(t => t.title)).toEqual(['t1', 't2'])
  })

  it('aggregates dependencies across a TS suite', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'TS', file }))
    expect(sur.dependencies.sort()).toEqual(['I', 'loginPage'])
  })

  it('addTest inserts a new TS scenario into the suite', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'TS', file }))
    const edit = sur.addTest(
      `Scenario('t3', async ({ I }: { I: CodeceptJS.I }) => {
  I.amOnPage('/t3')
})`,
    )
    edit.apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("Scenario('t3'")
    expect(after).toContain("Scenario('t1'")
  })

  it('removeTest deletes a TS scenario', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'TS', file }))
    sur.removeTest('t1').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).not.toContain("'t1'")
    expect(after).toContain("'t2'")
  })
})

describe('SuiteReflection.removeTest', () => {
  let file
  beforeEach(() => {
    clearCache()
    file = tmp(
      `Feature('Auth')

Scenario('keep me', async ({ I }) => {
  I.amOnPage('/keep')
})

Scenario('delete me', async ({ I }) => {
  I.amOnPage('/delete')
})

Scenario('also keep', async ({ I }) => {
  I.amOnPage('/also')
})
`,
    )
  })
  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  it('removes a test by title and returns an Edit', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    const edit = sur.removeTest('delete me')
    const preview = edit.preview()
    expect(preview).not.toContain("'/delete'")
    expect(preview).not.toContain("'delete me'")
    expect(preview).toContain("'keep me'")
    expect(preview).toContain("'also keep'")
  })

  it('apply() writes a valid file that still parses', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    sur.removeTest('delete me').apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).not.toContain('delete me')
    // Should still be parseable as a fresh SuiteReflection
    clearCache()
    const sur2 = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(sur2.tests.map(t => t.title)).toEqual(['keep me', 'also keep'])
  })

  it('throws NotFoundError when title does not exist', () => {
    const sur = new SuiteReflection(mockSuite({ title: 'Auth', file }))
    expect(() => sur.removeTest('nope')).toThrow(NotFoundError)
  })

  it('scoped to this suite — will not remove same-titled test in another suite', () => {
    const multi = tmp(
      `Feature('A')

Scenario('same', async ({ I }) => { I.amOnPage('/a') })

Feature('B')

Scenario('same', async ({ I }) => { I.amOnPage('/b') })
`,
    )
    try {
      const a = new SuiteReflection(mockSuite({ title: 'A', file: multi }))
      a.removeTest('same').apply()
      const after = fs.readFileSync(multi, 'utf8')
      // B's scenario survives
      expect(after).toContain("'/b'")
      expect(after).not.toContain("'/a'")
    } finally {
      fs.unlinkSync(multi)
    }
  })
})
