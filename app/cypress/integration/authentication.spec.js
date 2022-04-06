describe('Authentication', () => {
  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

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
    cy.findByText('You have succesfully logged out.');
    cy.findByTestId('csb-sign-in-text').contains(
      'Click the Sign in button below to log into the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });

  it('Verify error messages based on error parameter value', () => {
    cy.visit('/welcome?error=auth');
    cy.findByText('Authentication error. Please log in again or contact support.');
    
    cy.visit('/welcome?error=saml');
    cy.findByText('Error logging in. Please try again or contact support.');
    
    cy.visit('/welcome?error=sam-fetch');
    cy.findByText('Error retrieving SAM.gov data. Please contact support.');
    
    cy.visit('/welcome?info=sam-results');
    cy.findByText('No SAM.gov records found. Please refer to the help documentation to add data to SAM.gov.');
    
    cy.visit('/welcome?info=timeout');
    cy.findByText('For security reasons, you have been logged out due to 15 minutes of inactivity.');
    
    cy.visit('/welcome?success=logout');
    cy.findByText('You have succesfully logged out.');
  });
});
