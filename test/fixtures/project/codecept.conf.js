export const config = {
  tests: './test/*.scenario.js',
  output: './output',
  helpers: {
    Stub: { require: './stub-helper.js' },
  },
  include: {
    I: './steps_file.js',
    loginPage: './pages/LoginPage.js',
    dashboardPage: './pages/DashboardPage.js',
  },
  name: 'reflection-project-fixture',
}
