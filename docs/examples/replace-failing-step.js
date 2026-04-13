import { Reflection } from '@codeceptjs/reflection'
import { event } from 'codeceptjs'

event.dispatcher.on(event.step.failed, (step, err) => {
  const test = step.ctx?.currentTest
  if (!test) return
  try {
    const sr = Reflection.forStep(step, { test })
    console.log('Failing step at', sr.fileName + ':' + sr.line)
    console.log('Source:', sr.read())
    console.log('Enclosing scenario:', sr.testTitle)
    console.log('Is PO call:', sr.isSupportObject)
  } catch (e) {
    console.warn('Reflection failed:', e.message)
  }
})
