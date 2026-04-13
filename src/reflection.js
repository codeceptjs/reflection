import { StepReflection } from './step.js'
import { TestReflection } from './test.js'
import { SuiteReflection } from './suite.js'
import { PageObjectReflection } from './pageobject.js'
import { ProjectReflection } from './project.js'
import { Batch } from './batch.js'
import { parseFile } from './parser.js'
import { scanFile as scanParsedFile } from './locate/file-scan.js'
import { resolveSourceFile, configure as configureSourcePath } from './source-path.js'
import { clearCache } from './parser.js'

export const Reflection = {
  forStep(step, opts = {}) {
    return new StepReflection(step, opts)
  },

  forTest(test) {
    return new TestReflection(test)
  },

  forSuite(suite) {
    if (typeof suite === 'string') {
      return new SuiteReflection({ file: suite })
    }
    return new SuiteReflection(suite)
  },

  scanFile(filePath) {
    const parsed = parseFile(resolveSourceFile(filePath))
    const scanned = scanParsedFile(parsed)
    const suites = scanned.features.map(f => ({
      title: f.title,
      file: parsed.filePath,
      line: f.line,
      range: f.range,
    }))
    // Assign each scenario to its parent suite by source order
    const tests = []
    for (const sc of scanned.scenarios) {
      let parent = null
      for (const f of scanned.features) {
        if (f.range.start < sc.range.start) parent = f
        else break
      }
      tests.push({
        title: sc.title,
        suite: parent?.title || null,
        file: parsed.filePath,
        line: sc.line,
        range: sc.range,
      })
    }
    return { suites, tests }
  },

  forPageObject(filePath, opts = {}) {
    return new PageObjectReflection(filePath, opts)
  },

  project(opts) {
    if (typeof opts === 'string' || (opts && opts.configPath && !opts.config)) {
      return ProjectReflection.load(opts)
    }
    return new ProjectReflection(opts)
  },

  batch(filePath) {
    return new Batch(filePath)
  },

  configure(opts = {}) {
    configureSourcePath(opts)
  },

  clearCache() {
    clearCache()
  },
}
