Feature('Auth')

Scenario('login works', async ({ I }) => {
  I.amOnPage('/login')
  I.fillField('email', 'user@example.com')
  I.fillField('password', 'secret')
  I.click('Sign in')
  I.see('Welcome')
})

Scenario('logout works', async ({ I }) => {
  I.amOnPage('/')
  I.click('Logout')
  I.see('Goodbye')
})
