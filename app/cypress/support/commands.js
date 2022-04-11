import '@testing-library/cypress/add-commands';

/**
 * This command is used for logging into CSB.
 *
 * @param username - The username of the user to login as
 * @param password - The password of the user to login as
 */
Cypress.Commands.add('loginToCSB', (username, password = 'password') => {
  cy.log(`Call loginToCSB('${username}')...`);
  cy.visit('/');

  // wait for loading to complete. This text is available on the SignIn page and the post sign in page
  cy.findAllByText('Clean School Bus Rebate', { exact: false });

  cy.get('body').then(($body) => {
    // Check if the user needs to sign in, by looking for the sign in button. 
    // If the sign in button is not found do nothing, because the user is already logged in.
    if ($body.find("a:contains('Sign in')").length) {
      cy.contains('a', 'Sign in').click();

      // login to CSB
      cy.findByLabelText('Username').type(username);
      cy.findByLabelText('Password').type(password);
      cy.findByText('Login').click();
    }
  });
});
