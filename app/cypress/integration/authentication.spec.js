describe('Authentication', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (_err, _runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  beforeEach(() => {
    cy.clearCookie('csb-token');

    cy.loginToCSB('csbtest');
  });

  const loggedOutMessage = 'You have succesfully logged out.';
  const samInfoText =
    'No SAM.gov records match your email. Only Government and Electronic Business SAM.gov Points of Contacts (and alternates) may edit and submit Clean School Bus Rebate Forms.';
  const samErrorText = 'Error retrieving SAM.gov data. Please contact support.';

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
    cy.findByText(loggedOutMessage);
    cy.contains(
      'Click the Sign in button below to login to the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });

  it('Verify error messages based on error parameter value', () => {
    cy.visit('/welcome?error=auth');
    cy.findByText(
      'Authentication error. Please log in again or contact support.',
    );

    cy.visit('/welcome?error=saml');
    cy.findByText('Error logging in. Please try again or contact support.');

    cy.visit('/welcome?error=sam-fetch');
    cy.findByText(samErrorText);

    cy.visit('/welcome?info=sam-results');
    cy.findByText(samInfoText);

    cy.visit('/welcome?info=timeout');
    cy.findByText(
      'For security reasons, you have been logged out due to 15 minutes of inactivity.',
    );

    cy.visit('/welcome?success=logout');
    cy.findByText(loggedOutMessage);
  });

  it('Test SAM.gov service failure', () => {
    // sign out
    cy.findByText('csb-test@erg.com');
    cy.findByText('Sign out').click();
    cy.findByText(loggedOutMessage);

    // simulate the sam-data service failing
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/sam-data`, {
      statusCode: 500,
      body: {},
    }).as('sam-data');

    // verify the appropriate error message is displayed
    cy.loginToCSB('csbtest');
    cy.findByText(samErrorText);
  });

  it('Test SAM.gov service with no results', () => {
    // sign out
    cy.findByText('csb-test@erg.com');
    cy.findByText('Sign out').click();
    cy.findByText(loggedOutMessage);

    // simulate the sam-data service with no results
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/sam-data`, {
      statusCode: 200,
      body: {
        records: [],
        results: false,
      },
    }).as('sam-data');

    // verify the appropriate message is displayed
    cy.loginToCSB('csbtest');
    cy.findByText(samInfoText);
  });
});
