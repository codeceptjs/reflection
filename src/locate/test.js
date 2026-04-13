import {
  forEachCallExpressionJS,
  calleeNameJS,
  firstStringArgJS,
  forEachCallExpressionTS,
  calleeNameTS,
  firstStringArgTS,
} from './walk.js'
import { NotFoundError, AmbiguousLocateError } from '../errors.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const DIRECT_NAMES = new Set([
  'Scenario',
  'Scenario.only',
  'Scenario.skip',
  'Scenario.todo',
  'xScenario',
])

function isScenarioCallee(name) {
  if (!name) return false
  if (DIRECT_NAMES.has(name)) return true
  // Data([...]).Scenario(...) appears as 'Data.Scenario'
  if (name === 'Data.Scenario' || name === 'Data.Scenario.only' || name === 'Data.Scenario.skip') {
    return true
  }
  return false
}

function stripDataTitle(title) {
  return title.replace(/\s*\|\s*\{[\s\S]*\}\s*$/, '')
}

export function locateTestByTitle(parsed, { title, lineHint }) {
  const normalized = stripDataTitle(title)
  if (parsed.engine === 'acorn') return locateTestJS(parsed, normalized, lineHint)
  return locateTestTS(parsed, normalized, lineHint)
}

function locateTestJS(parsed, title, lineHint) {
  const { ast } = parsed
  const matches = []
  forEachCallExpressionJS(ast, node => {
    const name = calleeNameJS(node)
    if (!name || !isScenarioCallee(name)) return
    const strArg = firstStringArgJS(node)
    if (strArg !== title) return
    matches.push(node)
  })
  if (matches.length === 0) {
    throw new NotFoundError(`No Scenario titled "${title}" found in ${parsed.filePath}`, {
      filePath: parsed.filePath,
    })
  }

  let pick = matches
  if (lineHint != null && matches.length > 1) {
    const byLine = matches.filter(m => m.loc.start.line === lineHint)
    if (byLine.length === 1) pick = byLine
    else {
      const closest = matches
        .map(m => ({ m, d: Math.abs(m.loc.start.line - lineHint) }))
        .sort((a, b) => a.d - b.d)
      if (closest[0].d !== closest[1]?.d) pick = [closest[0].m]
    }
  }

  if (pick.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple Scenarios titled "${title}" in ${parsed.filePath}`,
      {
        filePath: parsed.filePath,
        candidates: pick.map(m => ({ start: m.start, end: m.end, line: m.loc.start.line })),
      },
    )
  }

  const scenarioNode = pick[0]
  return buildResultJS(parsed, scenarioNode)
}

function buildResultJS(parsed, scenarioNode) {
  // If this is a Data(...).Scenario(...) form, scenarioNode IS the inner Scenario call
  // (we walked the AST looking for Scenario as the callee property). The inner "scenario range"
  // should cover just the .Scenario(...) call. The dataBlockRange is the whole chain.
  let innerStart = scenarioNode.start
  let innerEnd = scenarioNode.end
  let dataBlockRange = null

  if (scenarioNode.callee?.type === 'MemberExpression' && scenarioNode.callee.property?.name === 'Scenario') {
    // Full range covers Data(...).Scenario(...); inner should be just the Scenario call
    // But .Scenario(args) is syntactically part of the same CallExpression; we cannot split it.
    // Instead return the whole CallExpression as both, but expose a readDataBlock via dataBlockRange.
    dataBlockRange = { start: scenarioNode.start, end: scenarioNode.end }
    // For "inner Scenario" we return the range from ".Scenario(" onward.
    const source = parsed.source
    const dotIdx = source.lastIndexOf('.Scenario', scenarioNode.callee.property.start)
    if (dotIdx !== -1) {
      innerStart = dotIdx + 1 // skip the dot
    }
  }

  return {
    filePath: parsed.filePath,
    range: { start: innerStart, end: innerEnd },
    dataBlockRange,
    node: scenarioNode,
  }
}

function locateTestTS(parsed, title, lineHint) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const matches = []
  forEachCallExpressionTS(ts, sourceFile, node => {
    const name = calleeNameTS(ts, node)
    if (!name || !isScenarioCallee(name)) return
    const strArg = firstStringArgTS(ts, node)
    if (strArg !== title) return
    matches.push(node)
  })
  if (matches.length === 0) {
    throw new NotFoundError(`No Scenario titled "${title}" found in ${parsed.filePath}`, {
      filePath: parsed.filePath,
    })
  }

  let pick = matches
  if (lineHint != null && matches.length > 1) {
    const byLine = matches.filter(m => sourceFile.getLineAndCharacterOfPosition(m.getStart(sourceFile)).line + 1 === lineHint)
    if (byLine.length === 1) pick = byLine
  }

  if (pick.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple Scenarios titled "${title}" in ${parsed.filePath}`,
      {
        filePath: parsed.filePath,
        candidates: pick.map(m => ({
          start: m.getStart(sourceFile),
          end: m.getEnd(),
        })),
      },
    )
  }

  const scenarioNode = pick[0]
  const start = scenarioNode.getStart(sourceFile)
  const end = scenarioNode.getEnd()
  let innerStart = start
  const innerEnd = end
  let dataBlockRange = null

  const callee = scenarioNode.expression
  if (
    callee.kind === ts.SyntaxKind.PropertyAccessExpression &&
    callee.name?.text === 'Scenario' &&
    callee.expression.kind === ts.SyntaxKind.CallExpression &&
    callee.expression.expression.kind === ts.SyntaxKind.Identifier &&
    callee.expression.expression.text === 'Data'
  ) {
    dataBlockRange = { start, end }
    innerStart = callee.name.getStart(sourceFile) - 1 // include the dot
    innerStart += 1 // skip the dot itself to match the JS path
  }

  return {
    filePath: parsed.filePath,
    range: { start: innerStart, end: innerEnd },
    dataBlockRange,
    node: scenarioNode,
  }
}
