describe('Authentication', () => {
  beforeEach(() => {
    cy.clearCookie('csb-token')

    cy.loginToCSB('csbtest');
  });

  it('Sign in to CSB', () => {
    // verify the user name is displayed on the screen
    cy.findByText('csb-test@erg.com');
  });

  it('Sign out of CSB', () => {
    // verify the user name is displayed on the screen
    cy.findByText('csb-test@erg.com');

    // sign out
    cy.findByText('Sign out').click();

    // verify sign out was completed
    cy.findByTestId('csb-sign-in-text').contains(
      'Click the Sign in button below to log into the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });
});
