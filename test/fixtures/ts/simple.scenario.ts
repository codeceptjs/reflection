Feature('Auth')

Scenario('login works', async ({ I }: { I: CodeceptJS.I }) => {
  I.amOnPage('/login')
  I.fillField('email', 'user@example.com')
  I.click('Sign in')
  I.see('Welcome')
})

Scenario('typed logout', async ({ I }: { I: CodeceptJS.I }) => {
  I.amOnPage('/')
  I.click('Logout')
})
