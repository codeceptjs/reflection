Feature('Dashboard')

Scenario('user sees welcome', async ({ I, dashboardPage }) => {
  dashboardPage.open()
  dashboardPage.seeWelcome('John')
})
