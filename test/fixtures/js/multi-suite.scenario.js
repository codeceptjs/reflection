Feature('First')

Scenario('a1', async ({ I }) => {
  I.amOnPage('/a1')
})

Scenario('a2', async ({ I, loginPage }) => {
  loginPage.login('x', 'y')
})

Feature('Second')

Scenario('b1', async ({ I, dashboardPage }) => {
  dashboardPage.open()
})
