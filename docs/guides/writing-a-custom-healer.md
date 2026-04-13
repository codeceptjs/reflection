# Writing a custom healer

You can build your own healing strategy with `@codeceptjs/reflection` without touching the CodeceptJS heal plugin.

## Scenario: auto-fix flaky selectors

Say your test clicks a selector that has a small-change tolerance — `#submit` sometimes becomes `#submit-button`. You want a healer that:

1. Catches the failure.
2. Finds a similar element on the page at runtime.
3. Rewrites the failing step to use the new selector.

```js
import { Reflection } from '@codeceptjs/reflection'
import { event, container } from 'codeceptjs'

const learnedMappings = new Map()

event.dispatcher.on(event.step.failed, async (step, err) => {
  if (!step.args?.[0]?.startsWith?.('#')) return
  const helper = container.helpers('Playwright') // or whichever
  const similar = await helper._searchSimilarLocator(step.args[0])
  if (!similar) return
  learnedMappings.set(step, similar)
})

event.dispatcher.on(event.test.after, async (test) => {
  for (const [step, newSelector] of learnedMappings) {
    try {
      const sr = Reflection.forStep(step, { test })
      const oldCode = sr.read()
      // Simple, safe string swap INSIDE the step call text
      const newCode = oldCode.replace(step.args[0], newSelector)
      sr.replace(newCode).apply()
      console.log(`[healer] ${sr.fileName}:${sr.line}: ${step.args[0]} → ${newSelector}`)
    } catch (err) {
      console.warn(`[healer] ${err.message}`)
    }
  }
  learnedMappings.clear()
})
```

## Why `sr.read()` and not regex on the raw file

- `sr.read()` gives you the exact AST-bound range of the step call.
- Doing `.replace(old, new)` on that small string is safe because you're only touching *one occurrence* of the old selector inside that single step.
- The surrounding file is untouched: if your project has `#submit` elsewhere in the same file, you won't rewrite it accidentally.

## Error handling

Wrap every `.apply()` in a try/catch. Common failure modes:

- `AmbiguousLocateError` — the step came from a loop. Log and skip.
- `StaleEditError` — the file changed between reflection and apply. Either re-read and retry, or pass `{ ignoreStale: true }` if you're confident the edit range still applies.
- `NotFoundError` — the source line doesn't contain a call expression. Usually indicates a mismatched stack, maybe from a dynamically generated file or a source-mapped frame. Skip.
