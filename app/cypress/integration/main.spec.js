describe('Main', () => {
  // Leave the user logged in to prevent logging in for every test
  Cypress.Cookies.defaults({
    preserve: 'csb-token',
  });

  beforeEach(() => {
    cy.loginToCSB('csbtest');
  });

  it('Check table', () => {
    cy.findByText('csb-test@erg.com');
    cy.findByText('School District Name');
  });
});
