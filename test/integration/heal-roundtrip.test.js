import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Reflection } from '../../src/index.js'
import { clearCache } from '../../src/parser.js'

function tmpScenarioFile(contents) {
  const p = path.join(os.tmpdir(), `reflection-heal-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  fs.writeFileSync(p, contents)
  return p
}

describe('heal roundtrip — StepReflection replaces a step and re-runs', () => {
  let file

  beforeEach(() => {
    clearCache()
    file = tmpScenarioFile(
      `Feature('Broken')

Scenario('needs healing', async ({ I }) => {
  I.amOnPage('/')
  I.click('#broken-selector')
  I.see('Healed')
})
`,
    )
  })

  afterEach(() => {
    try { fs.unlinkSync(file) } catch {}
  })

  it('replaces a failing step using StepReflection and writes the file', async () => {
    // Simulate what the heal plugin would do: it has a failing step with a
    // stack pointing to the source line, plus a suggested replacement snippet.
    const source = fs.readFileSync(file, 'utf8')
    const lineNum = source.split('\n').findIndex(l => l.includes("click('#broken-selector')")) + 1

    // Construct a mock step whose stack points at our tmp file
    const fakeStack =
      `Error\n` +
      `    at Step.setTrace (/irrelevant/codeceptjs/lib/step/base.js:84:15)\n` +
      `    at Proxy.click (/irrelevant/codeceptjs/lib/container.js:500:12)\n` +
      `    at Context.<anonymous> (${file}:${lineNum}:3)\n`
    const step = { stack: fakeStack, metaStep: null, args: [], toCode: () => '' }
    const test = { title: 'needs healing', file, opts: {}, meta: {}, parent: { title: 'Broken' } }

    const sr = Reflection.forStep(step, { test })
    expect(sr.read()).toContain("I.click('#broken-selector')")

    const edit = sr.replace("I.click('#fixed-selector')")
    expect(edit.preview()).toContain("I.click('#fixed-selector')")

    edit.apply()
    const after = fs.readFileSync(file, 'utf8')
    expect(after).toContain("I.click('#fixed-selector')")
    expect(after).not.toContain('#broken-selector')
    // rest of file is preserved byte-for-byte outside the edit
    expect(after).toContain("Feature('Broken')")
    expect(after).toContain("I.see('Healed')")
  })
})
