import { Reflection } from '@codeceptjs/reflection'

// Given a list of {step, test, replacement} tuples from your healer,
// group them by file and apply all edits to each file in one write.

export function applyHealing(fixes) {
  const byFile = new Map()
  for (const fix of fixes) {
    const sr = Reflection.forStep(fix.step, { test: fix.test })
    const edit = sr.replace(fix.replacement)
    if (!byFile.has(edit.filePath)) byFile.set(edit.filePath, [])
    byFile.get(edit.filePath).push(edit)
  }
  for (const [file, edits] of byFile) {
    const batch = Reflection.batch(file)
    for (const e of edits) batch.add(e)
    batch.apply()
  }
}
