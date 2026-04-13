const users = [
  { name: 'alice', email: 'a@x.com' },
  { name: 'bob', email: 'b@x.com' },
]

Feature('Data')

Data(users).Scenario('user logs in', async ({ I, current }) => {
  I.amOnPage('/login')
  I.fillField('email', current.email)
  I.click('Sign in')
})
