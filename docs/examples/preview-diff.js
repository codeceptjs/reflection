import fs from 'node:fs'
import { Reflection } from '@codeceptjs/reflection'

// Dry-run an edit and write the diff to a staging file for human review.

export function stageEdit(test, newSource, diffPath) {
  const tr = Reflection.forTest(test)
  const edit = tr.replace(newSource)
  fs.appendFileSync(diffPath, edit.diff() + '\n')
  return edit
}
