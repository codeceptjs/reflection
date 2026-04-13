import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Reflection } from '../../src/index.js'
import { clearCache } from '../../src/parser.js'

function tmpFile(contents) {
  const p = path.join(os.tmpdir(), `reflection-batch-int-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  fs.writeFileSync(p, contents)
  return p
}

describe('multi-edit batch — heal multiple steps in one file', () => {
  let file

  beforeEach(() => {
    clearCache()
    file = tmpFile(
      `Feature('Login')

Scenario('flow 1', async ({ I }) => {
  I.amOnPage('/')
  I.click('#a')
  I.click('#b')
  I.click('#c')
})
`,
    )
  })

  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  function stepAt(line, column) {
    const fakeStack =
      `Error\n` +
      `    at Step.setTrace (/irrelevant/codeceptjs/lib/step/base.js:84:15)\n` +
      `    at Proxy.click (/irrelevant/codeceptjs/lib/container.js:500:12)\n` +
      `    at Context.<anonymous> (${file}:${line}:${column})\n`
    return { stack: fakeStack, metaStep: null, args: [], toCode: () => '' }
  }

  it('applies three replacements in one write', () => {
    const sr1 = Reflection.forStep(stepAt(5, 3))
    const sr2 = Reflection.forStep(stepAt(6, 3))
    const sr3 = Reflection.forStep(stepAt(7, 3))
    expect(sr1.read()).toBe("I.click('#a')")
    expect(sr2.read()).toBe("I.click('#b')")
    expect(sr3.read()).toBe("I.click('#c')")

    const batch = Reflection.batch(file)
    batch.add(sr1.replace("I.click('#A')"))
    batch.add(sr2.replace("I.click('#B')"))
    batch.add(sr3.replace("I.click('#C')"))
    const result = batch.apply()
    expect(result.applied).toBe(3)

    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("I.click('#A')")
    expect(after).toContain("I.click('#B')")
    expect(after).toContain("I.click('#C')")
    expect(after).not.toContain("I.click('#a')")
    expect(after).not.toContain("I.click('#b')")
    expect(after).not.toContain("I.click('#c')")
    expect(after).toContain("Feature('Login')")
  })
})
