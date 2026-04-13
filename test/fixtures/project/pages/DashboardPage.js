const { I } = inject()

class DashboardPage {
  header = '.dashboard-header'

  open() {
    I.amOnPage('/dashboard')
    I.waitForElement(this.header)
  }

  seeWelcome(name) {
    I.see(`Welcome, ${name}`, this.header)
  }
}

export default DashboardPage
