Feature: Login

  Scenario: user logs in
    Given I am on login page
    When I enter valid credentials
    Then I see dashboard
