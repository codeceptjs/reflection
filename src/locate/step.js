import {
  buildParentMapJS,
  forEachCallExpressionJS,
  calleeNameJS,
  findEnclosingFunctionJS,
  findEnclosingCallJS,
  nodeLocToV8JS,
  forEachCallExpressionTS,
  calleeNameTS,
  findEnclosingFunctionTS,
  findEnclosingCallTS,
  nodeRangeTS,
} from './walk.js'
import { NotFoundError, AmbiguousLocateError } from '../errors.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const SCENARIO_CALLEES = new Set([
  'Scenario',
  'Scenario.only',
  'Scenario.skip',
  'Scenario.todo',
  'xScenario',
])

export function locateStepByPosition(parsed, { line, column }) {
  if (parsed.engine === 'acorn') return locateStepJS(parsed, { line, column })
  return locateStepTS(parsed, { line, column })
}

function locateStepJS(parsed, { line, column }) {
  const { ast, source } = parsed
  const candidates = []
  forEachCallExpressionJS(ast, node => {
    const loc = nodeLocToV8JS(node)
    if (loc.startLine <= line && loc.endLine >= line) {
      candidates.push({ node, loc })
    }
  })
  if (candidates.length === 0) {
    throw new NotFoundError(`No call expression found at ${parsed.filePath}:${line}:${column}`, {
      filePath: parsed.filePath,
    })
  }

  const onLine = candidates.filter(c => c.loc.startLine === line)
  let pool = onLine.length > 0 ? onLine : candidates

  if (column != null) {
    const byColumn = pool.filter(
      c =>
        (c.loc.startLine < line || c.loc.startColumn <= column) &&
        (c.loc.endLine > line || c.loc.endColumn >= column),
    )
    if (byColumn.length > 0) pool = byColumn
  }

  pool.sort((a, b) => (a.node.end - a.node.start) - (b.node.end - b.node.start))
  const smallest = pool[0]
  const ambiguous = pool.filter(c => c.node.end - c.node.start === smallest.node.end - smallest.node.start)
  if (ambiguous.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple step candidates at ${parsed.filePath}:${line}:${column}`,
      {
        filePath: parsed.filePath,
        candidates: ambiguous.map(c => ({ start: c.node.start, end: c.node.end })),
      },
    )
  }

  const parentMap = buildParentMapJS(ast)
  const node = smallest.node
  const enclosingFn = findEnclosingFunctionJS(parentMap, node)
  const enclosingScenario = findEnclosingCallJS(parentMap, node, name =>
    name && SCENARIO_CALLEES.has(name),
  )

  return {
    filePath: parsed.filePath,
    stepRange: { start: node.start, end: node.end },
    functionRange: enclosingFn ? { start: enclosingFn.start, end: enclosingFn.end } : null,
    testRange: enclosingScenario
      ? { start: enclosingScenario.start, end: enclosingScenario.end }
      : null,
    line: smallest.loc.startLine,
    column: smallest.loc.startColumn,
    source,
  }
}

function locateStepTS(parsed, { line, column }) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const candidates = []
  forEachCallExpressionTS(ts, sourceFile, node => {
    const range = nodeRangeTS(ts, sourceFile, node)
    if (range.startLine <= line && range.endLine >= line) {
      candidates.push({ node, range })
    }
  })
  if (candidates.length === 0) {
    throw new NotFoundError(`No call expression found at ${parsed.filePath}:${line}:${column}`, {
      filePath: parsed.filePath,
    })
  }

  const onLine = candidates.filter(c => c.range.startLine === line)
  let pool = onLine.length > 0 ? onLine : candidates

  if (column != null) {
    const byColumn = pool.filter(
      c =>
        (c.range.startLine < line || c.range.startColumn <= column) &&
        (c.range.endLine > line || c.range.endColumn >= column),
    )
    if (byColumn.length > 0) pool = byColumn
  }

  pool.sort((a, b) => (a.range.end - a.range.start) - (b.range.end - b.range.start))
  const smallest = pool[0]
  const ambiguous = pool.filter(
    c => c.range.end - c.range.start === smallest.range.end - smallest.range.start,
  )
  if (ambiguous.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple step candidates at ${parsed.filePath}:${line}:${column}`,
      {
        filePath: parsed.filePath,
        candidates: ambiguous.map(c => ({ start: c.range.start, end: c.range.end })),
      },
    )
  }

  const node = smallest.node
  const enclosingFn = findEnclosingFunctionTS(ts, node)
  const enclosingScenario = findEnclosingCallTS(ts, node, name => name && SCENARIO_CALLEES.has(name))

  return {
    filePath: parsed.filePath,
    stepRange: { start: smallest.range.start, end: smallest.range.end },
    functionRange: enclosingFn
      ? { start: enclosingFn.getStart(sourceFile), end: enclosingFn.getEnd() }
      : null,
    testRange: enclosingScenario
      ? { start: enclosingScenario.getStart(sourceFile), end: enclosingScenario.getEnd() }
      : null,
    line: smallest.range.startLine,
    column: smallest.range.startColumn,
    source: parsed.source,
  }
}
