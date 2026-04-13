import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Reflection } from '../../src/index.js'
import { clearCache } from '../../src/parser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(__dirname, '../fixtures/runtime/self-capturing.scenario.js')

// Pattern that matches our fake-framework.js so StepReflection skips those frames
const frameworkPatterns = [/test[/\\]fixtures[/\\]runtime[/\\]fake-framework\.js/]

describe('StepReflection on real V8 stacks (runtime)', () => {
  beforeEach(() => clearCache())

  it('resolves the source of a step constructed in a running scenario', async () => {
    const mod = await import('../fixtures/runtime/self-capturing.scenario.js')
    mod.runScenario()

    const sr = Reflection.forStep(mod.captured.first, { extraFrameworkPatterns: frameworkPatterns })
    expect(sr.fileName).toBe(path.normalize(fixturePath))
    expect(sr.line).toBeGreaterThan(0)
    const code = sr.read()
    expect(code).toBe('createStep()')
  })

  it('reports different lines for two sequential steps', async () => {
    const mod = await import('../fixtures/runtime/self-capturing.scenario.js')
    mod.runScenario()
    const first = Reflection.forStep(mod.captured.first, { extraFrameworkPatterns: frameworkPatterns })
    const second = Reflection.forStep(mod.captured.second, { extraFrameworkPatterns: frameworkPatterns })
    expect(first.line).not.toBe(second.line)
  })

  it('readFunction returns the enclosing runScenario body', async () => {
    const mod = await import('../fixtures/runtime/self-capturing.scenario.js')
    mod.runScenario()
    const sr = Reflection.forStep(mod.captured.first, { extraFrameworkPatterns: frameworkPatterns })
    const fn = sr.readFunction()
    expect(fn).toContain('captured.first = createStep()')
    expect(fn).toContain('captured.second = createStep()')
  })

  it('isSupportObject becomes true when metaStep is set', async () => {
    const mod = await import('../fixtures/runtime/self-capturing.scenario.js')
    mod.runWithMetaStep()
    const sr = Reflection.forStep(mod.captured.po, { extraFrameworkPatterns: frameworkPatterns })
    expect(sr.isSupportObject).toBe(true)
  })

  it('replace+preview produces a new source with the step swapped', async () => {
    const mod = await import('../fixtures/runtime/self-capturing.scenario.js')
    mod.runScenario()
    const sr = Reflection.forStep(mod.captured.first, { extraFrameworkPatterns: frameworkPatterns })
    const edit = sr.replace("createStep({ tag: 'replaced' })")
    const preview = edit.preview()
    expect(preview).toContain("createStep({ tag: 'replaced' })")
    expect(preview).toContain('captured.second = createStep()')
  })
})
