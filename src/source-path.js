import path from 'node:path'
import { createRequire } from 'node:module'

let injectedMapping = null

export function configure({ tsFileMapping } = {}) {
  if (tsFileMapping !== undefined) {
    injectedMapping = tsFileMapping
  }
}

export function resetConfiguration() {
  injectedMapping = null
}

export function resolveSourceFile(inputPath) {
  if (!inputPath) return inputPath
  const normalized = path.normalize(inputPath)

  if (!normalized.endsWith('.temp.mjs')) {
    return normalized
  }

  const mapping = injectedMapping || tryLazyCodeceptjsMapping()
  if (!mapping) return normalized

  for (const [tsFile, mjsFile] of mapping.entries()) {
    if (path.normalize(mjsFile) === normalized) {
      return path.normalize(tsFile)
    }
  }
  return normalized
}

function tryLazyCodeceptjsMapping() {
  try {
    const cjsRequire = createRequire(import.meta.url)
    const store = cjsRequire('codeceptjs/lib/store')
    const s = store?.default || store
    return s?.tsFileMapping || null
  } catch {
    return null
  }
}

export function __setInjectedMapping(m) {
  injectedMapping = m
}
