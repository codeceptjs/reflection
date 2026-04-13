import { parseFile } from './parser.js'
import { resolveSourceFile } from './source-path.js'
import { locatePageObject, parseMemberName } from './locate/pageobject.js'
import { Edit } from './edit.js'
import { ReflectionError, NotFoundError } from './errors.js'

export class PageObjectReflection {
  constructor(filePath, { name } = {}) {
    if (!filePath) throw new ReflectionError('PageObjectReflection requires a file path')
    this._filePath = filePath
    this._name = name
    this._parsedCache = null
    this._locateCache = null
  }

  _parsed() {
    if (!this._parsedCache) this._parsedCache = parseFile(resolveSourceFile(this._filePath))
    return this._parsedCache
  }

  _locate() {
    if (this._locateCache) return this._locateCache
    this._locateCache = locatePageObject(this._parsed(), { name: this._name })
    return this._locateCache
  }

  get fileName() {
    return this._parsed().filePath
  }

  get kind() {
    return this._locate().kind
  }

  get className() {
    return this._locate().className
  }

  // -------------------- Dependencies (inject()) --------------------

  get dependencies() {
    const info = this._locate().inject
    if (!info) return []
    return info.properties.map(p => p.name).filter(Boolean)
  }

  addDependency(name) {
    if (!name || typeof name !== 'string') {
      throw new ReflectionError('addDependency requires a non-empty name')
    }
    const parsed = this._parsed()
    const info = this._locate().inject
    if (!info) {
      throw new ReflectionError(
        `Cannot add dependency "${name}": no inject() call found in ${parsed.filePath}. Add \`const { } = inject()\` at the top of the file first.`,
        { filePath: parsed.filePath },
      )
    }
    if (this.dependencies.includes(name)) {
      throw new ReflectionError(`Dependency "${name}" is already injected`, {
        filePath: parsed.filePath,
      })
    }

    // Insert into the ObjectPattern just before the closing `}`.
    const patternRange = {
      start: info.objectPattern.start,
      end: info.objectPattern.end,
    }
    const source = parsed.source
    const patternText = source.slice(patternRange.start, patternRange.end)
    // Find the last `}` and insert before it
    const closeIdx = source.lastIndexOf('}', patternRange.end)
    if (closeIdx === -1 || closeIdx >= patternRange.end) {
      throw new ReflectionError('Malformed inject() destructuring pattern', {
        filePath: parsed.filePath,
      })
    }

    const hasExistingProps = info.properties.length > 0
    // Determine whether to prepend a comma based on what's just before `}`
    let insertPos = closeIdx
    const before = source.slice(patternRange.start, closeIdx)
    const trimmedBefore = before.trimEnd()
    const lastNonWs = trimmedBefore.slice(-1)
    let replacement
    if (!hasExistingProps) {
      replacement = ` ${name} `
    } else if (lastNonWs === ',') {
      replacement = ` ${name}`
    } else {
      replacement = `, ${name} `
      // Back up insertPos to skip trailing whitespace so the `, ` lands right after the last prop
      insertPos = patternRange.start + trimmedBefore.length
    }

    return new Edit({
      filePath: parsed.filePath,
      source,
      parsedAtHash: parsed.hash,
      start: insertPos,
      end: insertPos,
      replacement,
      eol: parsed.eol,
    })
  }

  removeDependency(name) {
    const parsed = this._parsed()
    const info = this._locate().inject
    if (!info) {
      throw new NotFoundError(`No inject() call in ${parsed.filePath}`, {
        filePath: parsed.filePath,
      })
    }
    const match = info.properties.find(p => p.name === name)
    if (!match) {
      throw new NotFoundError(`Dependency "${name}" not found in inject()`, {
        filePath: parsed.filePath,
      })
    }

    const source = parsed.source
    let start = match.range.start
    let end = match.range.end
    // Absorb trailing `, ` if present
    while (end < source.length && (source[end] === ',' || source[end] === ' ')) end++
    // If we didn't consume a trailing comma, try to remove a leading `, `
    if (source[match.range.end] !== ',') {
      // Back up over whitespace then comma
      let back = start
      while (back > 0 && source[back - 1] === ' ') back--
      if (back > 0 && source[back - 1] === ',') {
        start = back - 1
      }
    }

    return new Edit({
      filePath: parsed.filePath,
      source,
      parsedAtHash: parsed.hash,
      start,
      end,
      replacement: '',
      eol: parsed.eol,
    })
  }

  // -------------------- Members --------------------

  get members() {
    return this._locate().members.map(m => ({
      name: m.name,
      kind: m.kind,
      range: m.range,
      params: m.params,
      static: m.static || false,
    }))
  }

  get methods() {
    return this.members.filter(m => m.kind === 'method')
  }

  get properties() {
    return this.members.filter(m => m.kind === 'property')
  }

  findMember(name) {
    return this.members.find(m => m.name === name) || null
  }

  read() {
    const parsed = this._parsed()
    const info = this._locate()
    const start = info.classNode ? info.classNode.start ?? info.classNode.getStart?.(parsed.ast) : info.containerRange.start
    const end = info.classNode ? info.classNode.end ?? info.classNode.getEnd?.() : info.containerRange.end
    return parsed.source.slice(start, end)
  }

  readMember(name) {
    const info = this._locate()
    const match = info.members.find(m => m.name === name)
    if (!match) {
      throw new NotFoundError(`Member "${name}" not found`, { filePath: this.fileName })
    }
    return this._parsed().source.slice(match.range.start, match.range.end)
  }

  addMember(code) {
    if (!code || typeof code !== 'string') {
      throw new ReflectionError('addMember requires a code string')
    }
    const parsed = this._parsed()
    const info = this._locate()
    const name = parseMemberName(code, info.kind)
    if (!name) {
      throw new ReflectionError('addMember could not determine the member name from the given code')
    }
    if (info.members.some(m => m.name === name)) {
      throw new ReflectionError(`Member "${name}" already exists in the Page Object`, {
        filePath: parsed.filePath,
      })
    }

    const eol = parsed.eol
    const source = parsed.source

    // Pick insertion point: end of last member, or just after `{`
    let insertPos
    let prefix = ''
    let suffix = ''
    const indent = detectIndent(source, info, eol)
    const trimmed = code.replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '')
    const indentedCode = indentBlock(trimmed, indent)

    if (info.members.length > 0) {
      const last = info.members[info.members.length - 1]
      insertPos = last.range.end
      if (info.kind === 'plain-object') {
        // Skip past any existing trailing comma
        if (source[insertPos] === ',') insertPos += 1
        else prefix = ','
      }
      prefix += eol + eol + indentedCode
      if (info.kind === 'plain-object' && !trimmed.endsWith(',')) suffix = ','
    } else {
      // Empty container: insert just after `{`
      const openBrace = source.indexOf('{', info.containerRange.start)
      insertPos = openBrace + 1
      prefix = eol + indentedCode
      if (info.kind === 'plain-object' && !trimmed.endsWith(',')) suffix = ','
      suffix += eol
    }

    return new Edit({
      filePath: parsed.filePath,
      source,
      parsedAtHash: parsed.hash,
      start: insertPos,
      end: insertPos,
      replacement: prefix + suffix,
      eol,
    })
  }

  replaceMember(name, code) {
    const parsed = this._parsed()
    const info = this._locate()
    const match = info.members.find(m => m.name === name)
    if (!match) {
      throw new NotFoundError(`Member "${name}" not found`, { filePath: parsed.filePath })
    }
    const trimmed = code.replace(/^[\r\n]+/, '').replace(/[\r\n]+$/, '')
    return new Edit({
      filePath: parsed.filePath,
      source: parsed.source,
      parsedAtHash: parsed.hash,
      start: match.range.start,
      end: match.range.end,
      replacement: trimmed,
      eol: parsed.eol,
    })
  }

  removeMember(name) {
    const parsed = this._parsed()
    const info = this._locate()
    const match = info.members.find(m => m.name === name)
    if (!match) {
      throw new NotFoundError(`Member "${name}" not found`, { filePath: parsed.filePath })
    }
    const source = parsed.source
    const eol = parsed.eol
    let start = match.range.start
    let end = match.range.end

    if (info.kind === 'plain-object') {
      // Absorb trailing comma if present
      if (source[end] === ',') end += 1
    }
    // Absorb trailing newline
    if (source.slice(end, end + eol.length) === eol) end += eol.length
    // If there was a blank line before, absorb one
    if (
      source.slice(start - eol.length, start) === eol &&
      source.slice(start - 2 * eol.length, start - eol.length) === eol
    ) {
      start -= eol.length
    }
    // Absorb leading indent of the line
    while (start > 0 && (source[start - 1] === ' ' || source[start - 1] === '\t')) start--

    return new Edit({
      filePath: parsed.filePath,
      source,
      parsedAtHash: parsed.hash,
      start,
      end,
      replacement: '',
      eol,
    })
  }
}

function detectIndent(source, info, eol) {
  // If the container has members, use the first member's leading whitespace
  if (info.members.length > 0) {
    const first = info.members[0]
    const lineStart = source.lastIndexOf('\n', first.range.start - 1) + 1
    const indent = source.slice(lineStart, first.range.start)
    if (/^[\s]*$/.test(indent) && indent.length > 0) return indent
  }
  return '  '
}

function indentBlock(text, indent) {
  const lines = text.split(/\r?\n/)
  return lines.map((l, i) => (i === 0 ? indent + l : l === '' ? l : indent + l)).join('\n')
}

