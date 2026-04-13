import { StepReflection } from './step.js'
import { TestReflection } from './test.js'
import { SuiteReflection } from './suite.js'
import { PageObjectReflection } from './pageobject.js'
import { Batch } from './batch.js'
import { configure as configureSourcePath } from './source-path.js'
import { clearCache } from './parser.js'

export const Reflection = {
  forStep(step, opts = {}) {
    return new StepReflection(step, opts)
  },

  forTest(test) {
    return new TestReflection(test)
  },

  forSuite(suite) {
    return new SuiteReflection(suite)
  },

  forPageObject(filePath, opts = {}) {
    return new PageObjectReflection(filePath, opts)
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
