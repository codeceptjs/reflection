# AI-assisted editing

Reflection makes it safe to put an LLM in the loop for rewriting CodeceptJS tests. The pattern:

1. Use `read()` / `readFunction()` / `readTest()` to feed the model *exact* source, not fragments or runtime state.
2. Ask the model for a replacement string.
3. Use `replace().preview()` and `.diff()` to show the human what would change.
4. Only `.apply()` after explicit confirmation.

## Example: fix a failing step with an LLM

```js
import { Reflection } from '@codeceptjs/reflection'
import { askLLM } from './your-llm-client.js'

async function healWithLLM(step, test, error) {
  const sr = Reflection.forStep(step, { test })

  const context = {
    failingStep: sr.read(),
    enclosingFunction: sr.readFunction(),
    fullScenario: sr.readTest(),
    errorMessage: error.message,
  }

  const { newStepCode } = await askLLM({
    system: 'You fix CodeceptJS test steps. Return only the new step call, no explanation.',
    user: JSON.stringify(context),
  })

  const edit = sr.replace(newStepCode)
  console.log(edit.diff())

  const ok = await confirmWithUser()
  if (ok) edit.apply()
}
```

## Example: rewrite a whole scenario

```js
import { Reflection } from '@codeceptjs/reflection'

async function rewriteScenario(test) {
  const tr = Reflection.forTest(test)
  const currentSource = tr.read()

  const newSource = await askLLM({
    system: 'Refactor this CodeceptJS scenario to use Page Objects. Return valid JS.',
    user: currentSource,
  })

  const edit = tr.replace(newSource)
  console.log(edit.preview())
  edit.apply()
}
```

## Why this is safer than string replacement

- The LLM never sees file paths, line numbers, or unrelated code — only the exact range you asked for. Less chance of hallucinated edits.
- `replace()` operates on a byte range, so the LLM cannot accidentally rewrite something outside its intended scope even if it tries.
- `preview()` gives you the *full* new file, so you can dry-run the output through a formatter or parser before committing.
- `apply()`'s stale check prevents races if a second process touches the file between `read()` and `apply()`.

## Feeding diffs to a human

```js
import { Reflection } from '@codeceptjs/reflection'
import fs from 'node:fs'

async function stageLLMEdits(tests) {
  const diffs = []
  for (const test of tests) {
    const tr = Reflection.forTest(test)
    const newSource = await askLLM({ user: tr.read() })
    diffs.push(tr.replace(newSource).diff())
  }
  fs.writeFileSync('llm-staged.diff', diffs.join('\n'))
}
```
