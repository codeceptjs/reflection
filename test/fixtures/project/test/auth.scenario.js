Feature('Auth')

Scenario('user signs in', async ({ I, loginPage }) => {
  loginPage.open()
  loginPage.sendForm('user@example.com', 'secret')
  I.see('Welcome')
})

Scenario('user signs out', async ({ I }) => {
  I.amOnPage('/')
  I.click('Logout')
  I.see('Goodbye')
})
