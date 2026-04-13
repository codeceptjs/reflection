const { I } = inject()

export class LoginPage {
  private readonly emailField = '#email'
  private readonly passwordField = '#password'

  login(email: string, password: string): void {
    I.amOnPage('/login')
    I.fillField(this.emailField, email)
    I.fillField(this.passwordField, password)
    I.click('Sign in')
  }
}
