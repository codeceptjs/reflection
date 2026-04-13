export function mockStep({ file, line, column = 1, metaStep = null, args = [], functionName = 'Object.<anonymous>' } = {}) {
  const stack =
    `Error\n` +
    `    at Step.setTrace (/irrelevant/codeceptjs/lib/step/base.js:84:15)\n` +
    `    at new BaseStep (/irrelevant/codeceptjs/lib/step/base.js:40:10)\n` +
    `    at Proxy.<anonymous> (/irrelevant/codeceptjs/lib/container.js:500:12)\n` +
    `    at Object.<anonymous> (/irrelevant/codeceptjs/lib/actor.js:80:5)\n` +
    `    at ${functionName} (${file}:${line}:${column})\n`
  return {
    stack,
    metaStep,
    args,
    toCode() {
      return `I.${functionName}(${args.map(a => JSON.stringify(a)).join(', ')})`
    },
  }
}

export function mockStepFromStack(stackStr, { metaStep = null, args = [] } = {}) {
  return {
    stack: stackStr,
    metaStep,
    args,
    toCode: () => '',
  }
}
