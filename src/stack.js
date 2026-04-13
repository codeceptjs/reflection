import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRAME_WITH_FN = /^\s*at\s+(?:async\s+)?(.+?)\s+\((.+):(\d+):(\d+)\)\s*$/
const FRAME_NO_FN = /^\s*at\s+(?:async\s+)?(.+):(\d+):(\d+)\s*$/
const FRAME_EVAL = /^\s*at\s+eval\s+\(eval at\s+/

const FRAMEWORK_PATTERNS = [
  /[/\\]@codeceptjs[/\\]reflection[/\\]/,
  /[/\\]codeceptjs[/\\]lib[/\\]/,
  /[/\\]codeceptjs[/\\]bin[/\\]/,
  /[/\\]node_modules[/\\]codeceptjs[/\\]/,
  /[/\\]node_modules[/\\]mocha[/\\]/,
  /[/\\]node_modules[/\\]@codeceptjs[/\\]/,
  /^node:/,
  /^internal[/\\]/,
]

export function parseV8Stack(stackStr) {
  if (!stackStr || typeof stackStr !== 'string') return []
  const lines = stackStr.split('\n')
  const frames = []
  for (const raw of lines) {
    const frame = parseFrame(raw)
    if (frame) frames.push(frame)
  }
  return frames
}

function parseFrame(line) {
  if (FRAME_EVAL.test(line)) return null
  const withFn = line.match(FRAME_WITH_FN)
  if (withFn) {
    return buildFrame(withFn[1].trim(), withFn[2], withFn[3], withFn[4])
  }
  const noFn = line.match(FRAME_NO_FN)
  if (noFn) {
    return buildFrame(null, noFn[1], noFn[2], noFn[3])
  }
  return null
}

function buildFrame(functionName, rawFile, rawLine, rawCol) {
  let file = rawFile
  if (file.startsWith('file://')) {
    try {
      file = fileURLToPath(file)
    } catch {
      // leave as-is
    }
  }
  if (file.includes('?')) file = file.slice(0, file.indexOf('?'))
  return {
    functionName,
    file: path.normalize(file),
    line: Number(rawLine),
    column: Number(rawCol),
  }
}

export function isFrameworkFrame(frame, extraPatterns = []) {
  if (!frame || !frame.file) return true
  const patterns = [...FRAMEWORK_PATTERNS, ...extraPatterns]
  return patterns.some(p => p.test(frame.file))
}

export function firstUserFrame(stackStr, { extraFrameworkPatterns = [] } = {}) {
  const frames = parseV8Stack(stackStr)
  for (const frame of frames) {
    if (!isFrameworkFrame(frame, extraFrameworkPatterns)) return frame
  }
  return null
}
