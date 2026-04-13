import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ReflectionError } from './errors.js'

const MAX_RETRIES = 3

function tmpPath(target) {
  const dir = path.dirname(target)
  const base = path.basename(target)
  const rand = crypto.randomBytes(6).toString('hex')
  return path.join(dir, `.${base}.${rand}.tmp`)
}

export function atomicWriteFileSync(targetPath, data) {
  const tmp = tmpPath(targetPath)
  try {
    fs.writeFileSync(tmp, data)
    try {
      fs.renameSync(tmp, targetPath)
      return
    } catch (renameErr) {
      if (renameErr.code !== 'EBUSY' && renameErr.code !== 'EPERM' && renameErr.code !== 'EACCES') {
        throw renameErr
      }
      // Windows fallback: copyFile + unlink with retries
      let lastErr = renameErr
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          fs.copyFileSync(tmp, targetPath)
          try { fs.unlinkSync(tmp) } catch {}
          return
        } catch (copyErr) {
          lastErr = copyErr
          // Small synchronous delay
          const end = Date.now() + 25 * (i + 1)
          while (Date.now() < end) { /* spin */ }
        }
      }
      throw new ReflectionError(
        `Atomic write failed for ${targetPath}: ${lastErr.message}`,
        { filePath: targetPath, cause: lastErr },
      )
    }
  } catch (err) {
    try { fs.unlinkSync(tmp) } catch {}
    if (err instanceof ReflectionError) throw err
    throw new ReflectionError(
      `Atomic write failed for ${targetPath}: ${err.message}`,
      { filePath: targetPath, cause: err },
    )
  }
}
