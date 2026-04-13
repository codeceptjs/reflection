import {
  forEachCallExpressionJS,
  calleeNameJS,
  firstStringArgJS,
  forEachCallExpressionTS,
  calleeNameTS,
  firstStringArgTS,
} from './walk.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const FEATURE_DIRECT = new Set(['Feature', 'Feature.only', 'Feature.skip', 'xFeature'])
const SCENARIO_DIRECT = new Set([
  'Scenario',
  'Scenario.only',
  'Scenario.skip',
  'Scenario.todo',
  'xScenario',
])

function isScenario(name) {
  if (!name) return false
  if (SCENARIO_DIRECT.has(name)) return true
  if (name === 'Data.Scenario' || name === 'Data.Scenario.only' || name === 'Data.Scenario.skip') {
    return true
  }
  return false
}

/**
 * Walk a parsed file and return its Features and Scenarios in source order.
 * @returns {{ features: Array<{ title, node, range, line }>, scenarios: Array<{ title, node, range, line }> }}
 */
export function scanFile(parsed) {
  if (parsed.engine === 'acorn') return scanJS(parsed)
  return scanTS(parsed)
}

function scanJS(parsed) {
  const features = []
  const scenarios = []
  forEachCallExpressionJS(parsed.ast, node => {
    const name = calleeNameJS(node)
    if (!name) return
    if (FEATURE_DIRECT.has(name)) {
      features.push({
        title: firstStringArgJS(node),
        node,
        range: { start: node.start, end: node.end },
        line: node.loc.start.line,
      })
      return
    }
    if (isScenario(name)) {
      scenarios.push({
        title: firstStringArgJS(node),
        node,
        range: { start: node.start, end: node.end },
        line: node.loc.start.line,
      })
    }
  })
  return { features, scenarios }
}

function scanTS(parsed) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const features = []
  const scenarios = []
  forEachCallExpressionTS(ts, sourceFile, node => {
    const name = calleeNameTS(ts, node)
    if (!name) return
    const start = node.getStart(sourceFile)
    const end = node.getEnd()
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1
    if (FEATURE_DIRECT.has(name)) {
      features.push({
        title: firstStringArgTS(ts, node),
        node,
        range: { start, end },
        line,
      })
      return
    }
    if (isScenario(name)) {
      scenarios.push({
        title: firstStringArgTS(ts, node),
        node,
        range: { start, end },
        line,
      })
    }
  })
  return { features, scenarios }
}
