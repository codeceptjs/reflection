# Heal plugin integration

The CodeceptJS [heal plugin](https://codecept.io/heal/) runs suggested fixes at runtime to make a failing test pass, then records the fix as a human-readable diff in `test.notes`. It does not currently write the fix back to the source file — that's where `@codeceptjs/reflection` comes in.

## The shape of a heal fix

Today, `lib/heal.js` stores each successful healing in `this.fixes[]`:

```js
{
  recipe: string,       // the recipe name that produced the fix
  test,                 // the Mocha test object that was being run
  step,                 // the failing step (BaseStep instance with .stack)
  snippet,              // the code string or function that replaced the step's behavior
}
```

When the fix is a string (not a function), it's a drop-in replacement for `step.toCode()`. That means we can use it directly as the new source line.

## Minimal auto-apply

Below is a drop-in outside the CodeceptJS core that listens for heal success events and rewrites the scenario file:

```js
import { Reflection, StaleEditError } from '@codeceptjs/reflection'
import { event } from 'codeceptjs'

event.dispatcher.on(event.all.after, ({ heal }) => {
  if (!heal?.fixes) return
  for (const fix of heal.fixes) {
    if (typeof fix.snippet !== 'string') continue

    try {
      const sr = Reflection.forStep(fix.step, { test: fix.test })
      const edit = sr.replace(fix.snippet)
      edit.apply()
      console.log(`[heal] rewrote ${sr.fileName}:${sr.line}`)
    } catch (err) {
      if (err instanceof StaleEditError) {
        console.warn(`[heal] skipping stale edit in ${err.filePath}`)
      } else {
        console.error(`[heal] reflection failed: ${err.message}`)
      }
    }
  }
})
```

## Preview before apply (recommended)

For any non-trivial deployment you probably want to preview fixes before committing them to source control. Write the diffs to a staging file and let a human or a follow-up commit apply them:

```js
import fs from 'node:fs'
import { Reflection } from '@codeceptjs/reflection'
import { event } from 'codeceptjs'

const staging = '.heal-patches.diff'

event.dispatcher.on(event.all.after, ({ heal }) => {
  if (!heal?.fixes) return
  const patches = []
  for (const fix of heal.fixes) {
    if (typeof fix.snippet !== 'string') continue
    try {
      const sr = Reflection.forStep(fix.step, { test: fix.test })
      patches.push(sr.replace(fix.snippet).diff())
    } catch { /* skip unreflectable steps */ }
  }
  if (patches.length) fs.writeFileSync(staging, patches.join('\n'))
})
```

You can then apply the patches with `git apply .heal-patches.diff` or feed them to a code review.

## Handling ambiguity

Heal often targets steps inside loops or shared helpers where one stack line maps to multiple potential source locations. `StepReflection` throws `AmbiguousLocateError` in that case. Skip and log:

```js
import { AmbiguousLocateError } from '@codeceptjs/reflection'

try {
  sr.replace(fix.snippet).apply()
} catch (err) {
  if (err instanceof AmbiguousLocateError) {
    console.warn(`[heal] ambiguous source for step — cannot auto-apply`)
  } else {
    throw err
  }
}
```
