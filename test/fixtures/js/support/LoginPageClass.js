const { I, registerPage } = inject()

class LoginPage {
  fields = {
    email: '#user_basic_email',
    password: '#user_basic_password',
  }

  submitButton = { css: '#new_user_basic input[type=submit]' }

  sendForm(email, password) {
    I.fillField(this.fields.email, email)
    I.fillField(this.fields.password, password)
    I.click(this.submitButton)
  }

  register(email, password) {
    registerPage.registerUser({ email, password })
  }
}

export default LoginPage
