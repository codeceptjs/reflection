import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { ReflectionError } from './errors.js'

const require = createRequire(import.meta.url)

/**
 * Load a CodeceptJS config object from a file path.
 * Supports the common CodeceptJS shapes:
 *   - `export const config = { ... }`
 *   - `export default { ... }`
 *   - `module.exports.config = { ... }`
 *   - `module.exports = { ... }`
 */
export async function loadConfigFile(filePath) {
  const abs = path.resolve(filePath)
  if (!fs.existsSync(abs)) {
    throw new ReflectionError(`Config file not found: ${abs}`, { filePath: abs })
  }
  const ext = path.extname(abs).toLowerCase()
  if (ext === '.json') {
    const raw = fs.readFileSync(abs, 'utf8')
    return { config: JSON.parse(raw), configPath: abs, basePath: path.dirname(abs) }
  }

  let mod
  try {
    if (ext === '.cjs' || ext === '.js') {
      // Try CommonJS first for .js / .cjs
      try {
        mod = require(abs)
      } catch {
        mod = await import(pathToFileURL(abs).href)
      }
    } else {
      mod = await import(pathToFileURL(abs).href)
    }
  } catch (cause) {
    throw new ReflectionError(`Failed to load config ${abs}: ${cause.message}`, {
      filePath: abs,
      cause,
    })
  }

  const config = extractConfig(mod)
  if (!config) {
    throw new ReflectionError(
      `Config file ${abs} did not export a config object (expected default, .config, or module.exports)`,
      { filePath: abs },
    )
  }
  return { config, configPath: abs, basePath: path.dirname(abs) }
}

function extractConfig(mod) {
  if (!mod) return null
  if (mod.config && typeof mod.config === 'object') return mod.config
  if (mod.default?.config && typeof mod.default.config === 'object') return mod.default.config
  if (mod.default && typeof mod.default === 'object' && !mod.default.config) return mod.default
  if (typeof mod === 'object' && (mod.tests || mod.include || mod.helpers)) return mod
  return null
}
