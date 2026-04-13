// Top comment
Feature('Formatting')

/**
 * This scenario has extensive docs
 * and should be preserved verbatim.
 */
Scenario('renders with comments', async ({ I }) => {
  // step comment
  I.amOnPage('/')
  // another comment
  I.see('Hello')
})
