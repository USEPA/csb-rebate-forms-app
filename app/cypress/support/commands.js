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
    if ($body.find('a[data-testid=csb-sign-in-button]').length) {
      cy.findByTestId('csb-sign-in-button').click();

      // login to CSB
      cy.get('#username').type(username);
      cy.get('#password').type(password);
      cy.findByText('Login').click();
    }
  });
});
