import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function extractScenarioDepsJS(scenarioCall) {
  if (!scenarioCall || !scenarioCall.arguments) return []
  const fn = scenarioCall.arguments.find(
    a => a && (a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression'),
  )
  if (!fn || !fn.params || fn.params.length === 0) return []
  const firstParam = fn.params[0]
  return readParamJS(firstParam)
}

function readParamJS(param) {
  if (!param) return []
  if (param.type === 'ObjectPattern') {
    const out = []
    for (const prop of param.properties) {
      if (prop.type === 'Property') {
        const key = prop.key
        if (key.type === 'Identifier') out.push(key.name)
        else if (key.type === 'Literal' && typeof key.value === 'string') out.push(key.value)
      } else if (prop.type === 'RestElement' && prop.argument?.type === 'Identifier') {
        out.push(`...${prop.argument.name}`)
      }
    }
    return out
  }
  if (param.type === 'Identifier') {
    return [`*${param.name}`]
  }
  if (param.type === 'AssignmentPattern') {
    return readParamJS(param.left)
  }
  return []
}

export function extractScenarioDepsTS(scenarioCall) {
  const ts = require('typescript')
  if (!scenarioCall || !scenarioCall.arguments) return []
  const fn = scenarioCall.arguments.find(
    a =>
      a &&
      (a.kind === ts.SyntaxKind.ArrowFunction || a.kind === ts.SyntaxKind.FunctionExpression),
  )
  if (!fn || !fn.parameters || fn.parameters.length === 0) return []
  const firstParam = fn.parameters[0]
  return readParamTS(ts, firstParam)
}

function readParamTS(ts, param) {
  if (!param) return []
  const name = param.name
  if (!name) return []
  if (name.kind === ts.SyntaxKind.ObjectBindingPattern) {
    const out = []
    for (const el of name.elements) {
      const propName = el.propertyName || el.name
      if (propName && propName.kind === ts.SyntaxKind.Identifier) {
        out.push(propName.text)
      } else if (propName && propName.kind === ts.SyntaxKind.StringLiteral) {
        out.push(propName.text)
      }
    }
    return out
  }
  if (name.kind === ts.SyntaxKind.Identifier) {
    return [`*${name.text}`]
  }
  return []
}
