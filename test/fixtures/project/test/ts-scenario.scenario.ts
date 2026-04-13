Feature('Typed')

Scenario('typed scenario', async ({ I }: { I: CodeceptJS.I }) => {
  I.amOnPage('/typed')
  I.see('Welcome')
})
