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

const FEATURE_CALLEES = new Set([
  'Feature',
  'Feature.only',
  'Feature.skip',
  'xFeature',
])

const SCENARIO_DIRECT = new Set([
  'Scenario',
  'Scenario.only',
  'Scenario.skip',
  'Scenario.todo',
  'xScenario',
])

function isScenarioCallee(name) {
  if (!name) return false
  if (SCENARIO_DIRECT.has(name)) return true
  if (name === 'Data.Scenario' || name === 'Data.Scenario.only' || name === 'Data.Scenario.skip') {
    return true
  }
  return false
}

export const HOOK_KINDS = ['BeforeSuite', 'Before', 'After', 'AfterSuite']
const HOOK_SET = new Set(HOOK_KINDS)

function isHookCallee(name) {
  return !!name && HOOK_SET.has(name)
}

export function locateSuiteByTitle(parsed, { title, lineHint }) {
  if (parsed.engine === 'acorn') return locateSuiteJS(parsed, title, lineHint)
  return locateSuiteTS(parsed, title, lineHint)
}

function locateSuiteJS(parsed, title, lineHint) {
  const matches = []
  forEachCallExpressionJS(parsed.ast, node => {
    const name = calleeNameJS(node)
    if (!name || !FEATURE_CALLEES.has(name)) return
    const strArg = firstStringArgJS(node)
    if (strArg !== title) return
    matches.push(node)
  })
  if (matches.length === 0) {
    throw new NotFoundError(`No Feature titled "${title}" found in ${parsed.filePath}`, {
      filePath: parsed.filePath,
    })
  }
  let pick = matches
  if (lineHint != null && matches.length > 1) {
    const byLine = matches.filter(m => m.loc.start.line === lineHint)
    if (byLine.length === 1) pick = byLine
  }
  if (pick.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple Features titled "${title}" in ${parsed.filePath}`,
      {
        filePath: parsed.filePath,
        candidates: pick.map(m => ({ start: m.start, end: m.end })),
      },
    )
  }
  const node = pick[0]
  return {
    filePath: parsed.filePath,
    range: { start: node.start, end: node.end },
    node,
  }
}

export function collectSuiteStatements(parsed, featureNode) {
  if (parsed.engine === 'acorn') return collectSuiteStatementsJS(parsed, featureNode)
  return collectSuiteStatementsTS(parsed, featureNode)
}

function collectSuiteStatementsJS(parsed, featureNode) {
  const body = parsed.ast.body
  const idx = body.findIndex(
    stmt => stmt.type === 'ExpressionStatement' && stmt.expression === featureNode,
  )
  const featureStmt = idx !== -1 ? body[idx] : null
  const scenarios = []
  const hooks = []
  let suiteEnd = parsed.source.length
  if (idx === -1) return { featureStmt, scenarios, hooks, suiteEnd }

  for (let i = idx + 1; i < body.length; i++) {
    const stmt = body[i]
    if (stmt.type !== 'ExpressionStatement') continue
    const expr = stmt.expression
    if (!expr || expr.type !== 'CallExpression') continue
    const name = calleeNameJS(expr)
    if (!name) continue
    if (FEATURE_CALLEES.has(name)) {
      suiteEnd = stmt.start
      break
    }
    if (isScenarioCallee(name)) {
      scenarios.push({
        stmt,
        call: expr,
        title: firstStringArgJS(expr),
        range: { start: stmt.start, end: stmt.end },
      })
    } else if (isHookCallee(name)) {
      hooks.push({
        stmt,
        call: expr,
        kind: name,
        line: stmt.loc.start.line,
        range: { start: stmt.start, end: stmt.end },
      })
    }
  }
  return { featureStmt, scenarios, hooks, suiteEnd }
}

function collectSuiteStatementsTS(parsed, featureNode) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const stmts = sourceFile.statements
  const idx = stmts.findIndex(
    s => s.kind === ts.SyntaxKind.ExpressionStatement && s.expression === featureNode,
  )
  const featureStmt = idx !== -1 ? stmts[idx] : null
  const scenarios = []
  const hooks = []
  let suiteEnd = parsed.source.length
  if (idx === -1) return { featureStmt, scenarios, hooks, suiteEnd }

  for (let i = idx + 1; i < stmts.length; i++) {
    const stmt = stmts[i]
    if (stmt.kind !== ts.SyntaxKind.ExpressionStatement) continue
    const expr = stmt.expression
    if (!expr || expr.kind !== ts.SyntaxKind.CallExpression) continue
    const name = calleeNameTS(ts, expr)
    if (!name) continue
    if (FEATURE_CALLEES.has(name)) {
      suiteEnd = stmt.getStart(sourceFile)
      break
    }
    if (isScenarioCallee(name)) {
      scenarios.push({
        stmt,
        call: expr,
        title: firstStringArgTS(ts, expr),
        range: { start: stmt.getStart(sourceFile), end: stmt.getEnd() },
      })
    } else if (isHookCallee(name)) {
      const start = stmt.getStart(sourceFile)
      hooks.push({
        stmt,
        call: expr,
        kind: name,
        line: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
        range: { start, end: stmt.getEnd() },
      })
    }
  }
  return { featureStmt, scenarios, hooks, suiteEnd }
}

function locateSuiteTS(parsed, title, lineHint) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const matches = []
  forEachCallExpressionTS(ts, sourceFile, node => {
    const name = calleeNameTS(ts, node)
    if (!name || !FEATURE_CALLEES.has(name)) return
    const strArg = firstStringArgTS(ts, node)
    if (strArg !== title) return
    matches.push(node)
  })
  if (matches.length === 0) {
    throw new NotFoundError(`No Feature titled "${title}" found in ${parsed.filePath}`, {
      filePath: parsed.filePath,
    })
  }
  let pick = matches
  if (lineHint != null && matches.length > 1) {
    const byLine = matches.filter(
      m => sourceFile.getLineAndCharacterOfPosition(m.getStart(sourceFile)).line + 1 === lineHint,
    )
    if (byLine.length === 1) pick = byLine
  }
  if (pick.length > 1) {
    throw new AmbiguousLocateError(
      `Multiple Features titled "${title}" in ${parsed.filePath}`,
      {
        filePath: parsed.filePath,
        candidates: pick.map(m => ({
          start: m.getStart(sourceFile),
          end: m.getEnd(),
        })),
      },
    )
  }
  const node = pick[0]
  return {
    filePath: parsed.filePath,
    range: { start: node.getStart(sourceFile), end: node.getEnd() },
    node,
  }
}
