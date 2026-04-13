import * as walk from 'acorn-walk'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Walk the body of a Scenario callback and return every MemberExpression
 * call that looks like a test step — `I.click(...)`, `loginPage.open()`, etc.
 *
 * @param {{ engine: 'acorn' | 'typescript', source: string, ast: any }} parsed
 * @param {any} scenarioCallNode
 * @returns {Array<{ code: string, receiver: string | null, method: string | null, args: string[], line: number, column: number, range: { start: number, end: number } }>}
 */
export function listStepsInScenario(parsed, scenarioCallNode) {
  if (parsed.engine === 'acorn') return listJS(parsed, scenarioCallNode)
  return listTS(parsed, scenarioCallNode)
}

function listJS(parsed, scenarioCallNode) {
  const callback = (scenarioCallNode.arguments || []).find(
    a => a && (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression'),
  )
  if (!callback || !callback.body) return []
  const body = callback.body
  const source = parsed.source
  const steps = []
  walk.simple(body, {
    CallExpression(node) {
      if (!node.callee || node.callee.type !== 'MemberExpression') return
      const receiver = readReceiverJS(node.callee.object)
      const method = node.callee.property?.name || node.callee.property?.value || null
      if (!receiver || !method) return
      steps.push({
        code: source.slice(node.start, node.end),
        receiver,
        method,
        args: (node.arguments || []).map(a => source.slice(a.start, a.end)),
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        range: { start: node.start, end: node.end },
      })
    },
  })
  return steps
}

function readReceiverJS(node) {
  if (!node) return null
  if (node.type === 'Identifier') return node.name
  if (node.type === 'ThisExpression') return 'this'
  if (node.type === 'MemberExpression') {
    // e.g. this.fields.email — chain down to the root Identifier
    const obj = readReceiverJS(node.object)
    const prop = node.property?.name || node.property?.value
    if (obj && prop) return `${obj}.${prop}`
    return obj || null
  }
  return null
}

function listTS(parsed, scenarioCallNode) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const source = parsed.source
  const callback = (scenarioCallNode.arguments || []).find(
    a =>
      a &&
      (a.kind === ts.SyntaxKind.ArrowFunction || a.kind === ts.SyntaxKind.FunctionExpression),
  )
  if (!callback || !callback.body) return []
  const steps = []
  const walkNode = node => {
    if (node.kind === ts.SyntaxKind.CallExpression) {
      const expr = node.expression
      if (expr?.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const receiver = readReceiverTS(ts, expr.expression)
        const method = expr.name?.text || null
        if (receiver && method) {
          const start = node.getStart(sourceFile)
          const end = node.getEnd()
          const startPos = sourceFile.getLineAndCharacterOfPosition(start)
          steps.push({
            code: source.slice(start, end),
            receiver,
            method,
            args: (node.arguments || []).map(a => source.slice(a.getStart(sourceFile), a.getEnd())),
            line: startPos.line + 1,
            column: startPos.character + 1,
            range: { start, end },
          })
        }
      }
    }
    ts.forEachChild(node, walkNode)
  }
  ts.forEachChild(callback.body, walkNode)
  return steps
}

function readReceiverTS(ts, node) {
  if (!node) return null
  if (node.kind === ts.SyntaxKind.Identifier) return node.text
  if (node.kind === ts.SyntaxKind.ThisKeyword) return 'this'
  if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
    const obj = readReceiverTS(ts, node.expression)
    const prop = node.name?.text
    if (obj && prop) return `${obj}.${prop}`
    return obj || null
  }
  return null
}
