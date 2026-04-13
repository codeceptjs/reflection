import { createRequire } from 'node:module'
import { NotFoundError, ReflectionError } from '../errors.js'

const require = createRequire(import.meta.url)

export function locatePageObject(parsed, { name } = {}) {
  if (parsed.engine === 'acorn') return locateJS(parsed, { name })
  return locateTS(parsed, { name })
}

// -------------------- JS --------------------

function locateJS(parsed, { name }) {
  const ast = parsed.ast
  const body = ast.body
  const inject = findInjectCallJS(body)

  const classInfo = findClassJS(body, name)
  if (classInfo) {
    return {
      kind: 'class',
      classNode: classInfo.classNode,
      classBody: classInfo.classNode.body,
      containerNode: classInfo.classNode.body,
      containerRange: {
        start: classInfo.classNode.body.start,
        end: classInfo.classNode.body.end,
      },
      className: classInfo.className,
      members: extractClassMembersJS(classInfo.classNode),
      inject,
    }
  }

  const objectInfo = findExportedObjectJS(body, name)
  if (objectInfo) {
    return {
      kind: 'plain-object',
      classNode: null,
      containerNode: objectInfo.objectNode,
      containerRange: {
        start: objectInfo.objectNode.start,
        end: objectInfo.objectNode.end,
      },
      className: objectInfo.exportName || null,
      members: extractObjectMembersJS(objectInfo.objectNode),
      inject,
    }
  }

  throw new NotFoundError(
    `No class or exported plain-object Page Object found in ${parsed.filePath}${name ? ` matching "${name}"` : ''}`,
    { filePath: parsed.filePath },
  )
}

function findInjectCallJS(body) {
  for (const stmt of body) {
    if (stmt.type !== 'VariableDeclaration') continue
    for (const decl of stmt.declarations) {
      if (!decl.init) continue
      if (decl.init.type !== 'CallExpression') continue
      if (decl.init.callee?.type !== 'Identifier') continue
      if (decl.init.callee.name !== 'inject') continue
      if (decl.id.type !== 'ObjectPattern') continue
      const props = decl.id.properties.map(p => {
        const keyName =
          p.type === 'Property'
            ? p.key?.name || p.key?.value
            : p.type === 'RestElement'
              ? `...${p.argument?.name}`
              : null
        return { name: keyName, node: p, range: { start: p.start, end: p.end } }
      })
      return {
        stmt,
        declarator: decl,
        objectPattern: decl.id,
        callNode: decl.init,
        properties: props,
        range: { start: stmt.start, end: stmt.end },
      }
    }
  }
  return null
}

function findClassJS(body, name) {
  for (const stmt of body) {
    let classNode = null
    let className = null
    // class Foo { ... }
    if (stmt.type === 'ClassDeclaration') {
      classNode = stmt
      className = stmt.id?.name || null
    }
    // export default class Foo { ... }
    if (stmt.type === 'ExportDefaultDeclaration' && stmt.declaration?.type === 'ClassDeclaration') {
      classNode = stmt.declaration
      className = classNode.id?.name || null
    }
    // export default class { ... } (anonymous)
    if (stmt.type === 'ExportDefaultDeclaration' && stmt.declaration?.type === 'ClassExpression') {
      classNode = stmt.declaration
      className = classNode.id?.name || null
    }
    // export class Foo { ... }
    if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration?.type === 'ClassDeclaration') {
      classNode = stmt.declaration
      className = classNode.id?.name || null
    }
    if (!classNode) continue
    if (name && className !== name) continue
    return { classNode, className }
  }
  return null
}

function findExportedObjectJS(body, name) {
  // module.exports = { ... }
  for (const stmt of body) {
    if (stmt.type !== 'ExpressionStatement') continue
    const expr = stmt.expression
    if (expr.type !== 'AssignmentExpression') continue
    if (expr.operator !== '=') continue
    const left = expr.left
    if (
      left.type === 'MemberExpression' &&
      left.object?.name === 'module' &&
      left.property?.name === 'exports' &&
      expr.right.type === 'ObjectExpression'
    ) {
      if (name) continue
      return { objectNode: expr.right, exportName: null }
    }
  }
  // export default { ... }
  for (const stmt of body) {
    if (stmt.type !== 'ExportDefaultDeclaration') continue
    if (stmt.declaration?.type === 'ObjectExpression') {
      if (name) continue
      return { objectNode: stmt.declaration, exportName: null }
    }
  }
  return null
}

function extractClassMembersJS(classNode) {
  const members = []
  for (const el of classNode.body.body) {
    if (el.type === 'MethodDefinition') {
      if (el.kind === 'constructor') continue
      const key = el.key
      const name = key.name || key.value
      if (!name) continue
      members.push({
        name,
        kind: 'method',
        static: !!el.static,
        node: el,
        range: { start: el.start, end: el.end },
        params: extractParamNamesJS(el.value?.params || []),
      })
    } else if (el.type === 'PropertyDefinition') {
      const key = el.key
      const name = key.name || key.value
      if (!name) continue
      members.push({
        name,
        kind: 'property',
        static: !!el.static,
        node: el,
        range: { start: el.start, end: el.end },
      })
    }
  }
  return members
}

function extractObjectMembersJS(objectNode) {
  const members = []
  for (const prop of objectNode.properties) {
    if (prop.type !== 'Property') continue
    const key = prop.key
    const name = key.name || key.value
    if (!name) continue
    members.push({
      name,
      kind: prop.method || prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression'
        ? 'method'
        : 'property',
      node: prop,
      range: { start: prop.start, end: prop.end },
      params:
        prop.method || prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression'
          ? extractParamNamesJS(prop.value?.params || [])
          : undefined,
    })
  }
  return members
}

function extractParamNamesJS(params) {
  return params.map(p => {
    if (p.type === 'Identifier') return p.name
    if (p.type === 'AssignmentPattern') return p.left?.name || null
    if (p.type === 'RestElement') return `...${p.argument?.name || ''}`
    if (p.type === 'ObjectPattern') return '{...}'
    return null
  })
}

// -------------------- TS --------------------

function locateTS(parsed, { name }) {
  const ts = require('typescript')
  const sourceFile = parsed.ast
  const inject = findInjectCallTS(ts, sourceFile)

  const classInfo = findClassTS(ts, sourceFile, name)
  if (classInfo) {
    return {
      kind: 'class',
      classNode: classInfo.classNode,
      classBody: null,
      containerNode: classInfo.classNode,
      containerRange: classBodyRangeTS(ts, sourceFile, classInfo.classNode),
      className: classInfo.className,
      members: extractClassMembersTS(ts, sourceFile, classInfo.classNode),
      inject,
    }
  }

  const objectInfo = findExportedObjectTS(ts, sourceFile, name)
  if (objectInfo) {
    return {
      kind: 'plain-object',
      classNode: null,
      containerNode: objectInfo.objectNode,
      containerRange: {
        start: objectInfo.objectNode.getStart(sourceFile),
        end: objectInfo.objectNode.getEnd(),
      },
      className: null,
      members: extractObjectMembersTS(ts, sourceFile, objectInfo.objectNode),
      inject,
    }
  }

  throw new NotFoundError(
    `No class or exported plain-object Page Object found in ${parsed.filePath}${name ? ` matching "${name}"` : ''}`,
    { filePath: parsed.filePath },
  )
}

function findInjectCallTS(ts, sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (stmt.kind !== ts.SyntaxKind.VariableStatement) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!decl.initializer) continue
      if (decl.initializer.kind !== ts.SyntaxKind.CallExpression) continue
      if (decl.initializer.expression?.kind !== ts.SyntaxKind.Identifier) continue
      if (decl.initializer.expression.text !== 'inject') continue
      if (decl.name?.kind !== ts.SyntaxKind.ObjectBindingPattern) continue
      const props = decl.name.elements.map(el => {
        const propName = el.propertyName || el.name
        const keyName = propName?.text || null
        return {
          name: keyName,
          node: el,
          range: { start: el.getStart(sourceFile), end: el.getEnd() },
        }
      })
      return {
        stmt,
        declarator: decl,
        objectPattern: decl.name,
        callNode: decl.initializer,
        properties: props,
        range: { start: stmt.getStart(sourceFile), end: stmt.getEnd() },
      }
    }
  }
  return null
}

function findClassTS(ts, sourceFile, name) {
  for (const stmt of sourceFile.statements) {
    if (stmt.kind === ts.SyntaxKind.ClassDeclaration) {
      const className = stmt.name?.text || null
      if (name && className !== name) continue
      return { classNode: stmt, className }
    }
    if (stmt.kind === ts.SyntaxKind.ExportAssignment && stmt.expression?.kind === ts.SyntaxKind.ClassExpression) {
      const classNode = stmt.expression
      const className = classNode.name?.text || null
      if (name && className !== name) continue
      return { classNode, className }
    }
  }
  return null
}

function findExportedObjectTS(ts, sourceFile, name) {
  if (name) return null
  for (const stmt of sourceFile.statements) {
    // export default {...}
    if (stmt.kind === ts.SyntaxKind.ExportAssignment && stmt.expression?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
      return { objectNode: stmt.expression }
    }
    // module.exports = {...}
    if (stmt.kind === ts.SyntaxKind.ExpressionStatement) {
      const expr = stmt.expression
      if (
        expr.kind === ts.SyntaxKind.BinaryExpression &&
        expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        expr.left.kind === ts.SyntaxKind.PropertyAccessExpression &&
        expr.left.expression?.text === 'module' &&
        expr.left.name?.text === 'exports' &&
        expr.right.kind === ts.SyntaxKind.ObjectLiteralExpression
      ) {
        return { objectNode: expr.right }
      }
    }
  }
  return null
}

function classBodyRangeTS(ts, sourceFile, classNode) {
  // Find the `{` and `}` of the class body; members live between them.
  const openBrace = classNode.getChildren(sourceFile).find(c => c.kind === ts.SyntaxKind.OpenBraceToken)
  const closeBrace = classNode.getChildren(sourceFile).find(c => c.kind === ts.SyntaxKind.CloseBraceToken)
  return {
    start: openBrace ? openBrace.getStart(sourceFile) : classNode.getStart(sourceFile),
    end: closeBrace ? closeBrace.getEnd() : classNode.getEnd(),
  }
}

function extractClassMembersTS(ts, sourceFile, classNode) {
  const members = []
  for (const m of classNode.members) {
    if (m.kind === ts.SyntaxKind.Constructor) continue
    const name = m.name?.text || m.name?.getText?.(sourceFile)
    if (!name) continue
    if (m.kind === ts.SyntaxKind.MethodDeclaration) {
      members.push({
        name,
        kind: 'method',
        static: hasStaticTS(ts, m),
        node: m,
        range: { start: m.getStart(sourceFile), end: m.getEnd() },
        params: extractParamNamesTS(ts, m.parameters || []),
      })
    } else if (m.kind === ts.SyntaxKind.PropertyDeclaration) {
      members.push({
        name,
        kind: 'property',
        static: hasStaticTS(ts, m),
        node: m,
        range: { start: m.getStart(sourceFile), end: m.getEnd() },
      })
    }
  }
  return members
}

function extractObjectMembersTS(ts, sourceFile, objectNode) {
  const members = []
  for (const prop of objectNode.properties) {
    const name = prop.name?.text || prop.name?.getText?.(sourceFile)
    if (!name) continue
    if (prop.kind === ts.SyntaxKind.MethodDeclaration) {
      members.push({
        name,
        kind: 'method',
        node: prop,
        range: { start: prop.getStart(sourceFile), end: prop.getEnd() },
        params: extractParamNamesTS(ts, prop.parameters || []),
      })
    } else if (prop.kind === ts.SyntaxKind.PropertyAssignment) {
      const isFn =
        prop.initializer?.kind === ts.SyntaxKind.ArrowFunction ||
        prop.initializer?.kind === ts.SyntaxKind.FunctionExpression
      members.push({
        name,
        kind: isFn ? 'method' : 'property',
        node: prop,
        range: { start: prop.getStart(sourceFile), end: prop.getEnd() },
      })
    }
  }
  return members
}

function hasStaticTS(ts, node) {
  if (!node.modifiers) return false
  return node.modifiers.some(m => m.kind === ts.SyntaxKind.StaticKeyword)
}

function extractParamNamesTS(ts, params) {
  return params.map(p => {
    if (p.name?.kind === ts.SyntaxKind.Identifier) return p.name.text
    if (p.name?.kind === ts.SyntaxKind.ObjectBindingPattern) return '{...}'
    return null
  })
}

// -------------------- shared helpers --------------------

/**
 * Parse a member snippet (class field / method or plain-object property)
 * and return its name. Used by addMember() to key inserts by name.
 */
export function parseMemberName(code, containerKind) {
  if (containerKind === 'class') return parseClassMemberName(code)
  return parsePlainObjectMemberName(code)
}

function parseClassMemberName(code) {
  // Wrap in a dummy class to get a valid program
  const wrapped = `class __R{\n${code}\n}`
  const acorn = require('acorn')
  let ast
  try {
    ast = acorn.parse(wrapped, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
      locations: true,
    })
  } catch (cause) {
    throw new ReflectionError(`Cannot parse class member code: ${cause.message}`, { cause })
  }
  const clsBody = ast.body[0]?.body?.body
  if (!clsBody || clsBody.length === 0) {
    throw new ReflectionError('addMember received code with no class members', {})
  }
  const first = clsBody[0]
  const key = first.key
  return key?.name || key?.value || null
}

function parsePlainObjectMemberName(code) {
  const wrapped = `({${code}})`
  const acorn = require('acorn')
  let ast
  try {
    ast = acorn.parse(wrapped, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
    })
  } catch (cause) {
    throw new ReflectionError(`Cannot parse plain-object member code: ${cause.message}`, { cause })
  }
  const objExpr = ast.body[0]?.expression
  const props = objExpr?.properties
  if (!props || props.length === 0) {
    throw new ReflectionError('addMember received code with no object properties', {})
  }
  const first = props[0]
  const key = first.key
  return key?.name || key?.value || null
}
