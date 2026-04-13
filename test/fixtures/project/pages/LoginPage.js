const { I } = inject()

class LoginPage {
  fields = {
    email: '#email',
    password: '#password',
  }

  submitButton = 'button[type=submit]'

  open() {
    I.amOnPage('/login')
  }

  sendForm(email, password) {
    I.fillField(this.fields.email, email)
    I.fillField(this.fields.password, password)
    I.click(this.submitButton)
  }
}

export default LoginPage
