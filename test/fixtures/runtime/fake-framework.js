// Stand-in for a framework module (like codeceptjs/lib/step/base.js).
// Integration tests add this file's directory to extraFrameworkPatterns
// so that StepReflection skips these frames when locating the caller.

export function createStep({ metaStep = null } = {}) {
  const e = new Error()
  return {
    stack: e.stack,
    metaStep,
    args: [],
    toCode: () => '',
  }
}
