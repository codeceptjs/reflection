const { I } = inject()

module.exports = {
  loginFields: {
    email: '#email',
    password: '#password',
    submit: 'button[type=submit]',
  },

  login(email, password) {
    I.amOnPage('/login')
    I.fillField(this.loginFields.email, email)
    I.fillField(this.loginFields.password, password)
    I.click(this.loginFields.submit)
  },

  logout() {
    I.click('Logout')
  },
}
