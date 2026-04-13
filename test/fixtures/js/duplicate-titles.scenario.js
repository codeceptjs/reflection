Feature('Duplicates')

Scenario('check state', async ({ I }) => {
  I.amOnPage('/a')
})

Scenario('check state', async ({ I }) => {
  I.amOnPage('/b')
})
