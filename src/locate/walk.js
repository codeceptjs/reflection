import * as walk from 'acorn-walk'

const SKIP_KEYS = new Set(['loc', 'range', 'start', 'end', 'parent'])

function isAstNode(v) {
  return v && typeof v === 'object' && typeof v.type === 'string'
}

export function buildParentMapJS(ast) {
  const map = new WeakMap()
  const visit = (node, parent) => {
    if (parent) map.set(node, parent)
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue
      const child = node[key]
      if (Array.isArray(child)) {
        for (const c of child) if (isAstNode(c)) visit(c, node)
      } else if (isAstNode(child)) {
        visit(child, node)
      }
    }
  }
  visit(ast, null)
  return map
}

export function forEachCallExpressionJS(ast, visit) {
  walk.simple(ast, {
    CallExpression(node) {
      visit(node)
    },
  })
}

export function calleeNameJS(callExpr) {
  const callee = callExpr.callee
  if (!callee) return null
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression') {
    const obj = calleeNameJS({ callee: callee.object })
    const prop = callee.property?.name || callee.property?.value
    if (obj && prop) return `${obj}.${prop}`
    if (prop) return prop
  }
  if (callee.type === 'CallExpression') return calleeNameJS(callee)
  return null
}

export function firstStringArgJS(callExpr) {
  const arg = callExpr.arguments?.[0]
  if (!arg) return null
  if (arg.type === 'Literal' && typeof arg.value === 'string') return arg.value
  if (arg.type === 'TemplateLiteral' && arg.quasis.length === 1 && arg.expressions.length === 0) {
    return arg.quasis[0].value.cooked
  }
  return null
}

export function findEnclosingFunctionJS(parentMap, node) {
  let cur = parentMap.get(node)
  while (cur) {
    if (
      cur.type === 'FunctionExpression' ||
      cur.type === 'ArrowFunctionExpression' ||
      cur.type === 'FunctionDeclaration' ||
      cur.type === 'MethodDefinition'
    ) {
      return cur
    }
    cur = parentMap.get(cur)
  }
  return null
}

export function findEnclosingCallJS(parentMap, node, calleePredicate) {
  let cur = parentMap.get(node)
  while (cur) {
    if (cur.type === 'CallExpression' && calleePredicate(calleeNameJS(cur))) {
      return cur
    }
    cur = parentMap.get(cur)
  }
  return null
}

export function nodeLocToV8JS(node) {
  // acorn loc: line is 1-based, column is 0-based
  // V8 stack: line is 1-based, column is 1-based
  return {
    startLine: node.loc.start.line,
    startColumn: node.loc.start.column + 1,
    endLine: node.loc.end.line,
    endColumn: node.loc.end.column + 1,
  }
}

export function forEachCallExpressionTS(ts, sourceFile, visit) {
  const walkNode = node => {
    if (node.kind === ts.SyntaxKind.CallExpression) visit(node)
    ts.forEachChild(node, walkNode)
  }
  ts.forEachChild(sourceFile, walkNode)
}

export function calleeNameTS(ts, callExpr) {
  return exprNameTS(ts, callExpr.expression)
}

function exprNameTS(ts, node) {
  if (!node) return null
  if (node.kind === ts.SyntaxKind.Identifier) return node.text
  if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
    const obj = exprNameTS(ts, node.expression)
    const prop = node.name?.text
    if (obj && prop) return `${obj}.${prop}`
    if (prop) return prop
  }
  if (node.kind === ts.SyntaxKind.CallExpression) {
    return exprNameTS(ts, node.expression)
  }
  return null
}

export function firstStringArgTS(ts, callExpr) {
  const arg = callExpr.arguments?.[0]
  if (!arg) return null
  if (arg.kind === ts.SyntaxKind.StringLiteral) return arg.text
  if (arg.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) return arg.text
  return null
}

export function findEnclosingFunctionTS(ts, node) {
  let cur = node.parent
  while (cur) {
    const k = cur.kind
    if (
      k === ts.SyntaxKind.FunctionExpression ||
      k === ts.SyntaxKind.ArrowFunction ||
      k === ts.SyntaxKind.FunctionDeclaration ||
      k === ts.SyntaxKind.MethodDeclaration ||
      k === ts.SyntaxKind.Constructor
    ) {
      return cur
    }
    cur = cur.parent
  }
  return null
}

export function findEnclosingCallTS(ts, node, calleePredicate) {
  let cur = node.parent
  while (cur) {
    if (cur.kind === ts.SyntaxKind.CallExpression && calleePredicate(calleeNameTS(ts, cur))) {
      return cur
    }
    cur = cur.parent
  }
  return null
}

export function nodeRangeTS(ts, sourceFile, node) {
  const start = node.getStart(sourceFile)
  const end = node.getEnd()
  const startPos = sourceFile.getLineAndCharacterOfPosition(start)
  const endPos = sourceFile.getLineAndCharacterOfPosition(end)
  return {
    start,
    end,
    startLine: startPos.line + 1,
    startColumn: startPos.character + 1,
    endLine: endPos.line + 1,
    endColumn: endPos.character + 1,
  }
}
