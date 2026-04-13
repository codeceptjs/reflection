import { createStep } from './fake-framework.js'

export const captured = {}

export function runScenario() {
  captured.first = createStep()
  captured.second = createStep()
}

export function runWithMetaStep() {
  captured.po = createStep({ metaStep: { name: 'loginPage.login' } })
}
