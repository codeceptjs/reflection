const { I } = inject()

export default class DashboardPage {
  header = '.dashboard-header'
  stats = '.stats'

  open(): void {
    I.amOnPage('/dashboard')
    I.waitForElement(this.header)
  }

  async grabStats(): Promise<string> {
    return I.grabTextFrom(this.stats)
  }
}
