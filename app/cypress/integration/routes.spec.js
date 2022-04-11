describe('Routes', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  const formId = '624b92ede96cb08e5923392b';
  const loadingSpinnerId = 'csb-loading-spinner';

  beforeEach(() => {
    cy.loginToCSB('csbtest');
  });

  it('Test a route that is not found', () => {
    cy.findByText('Your Rebate Forms');

    cy.visit('/testing-not-found');

    cy.findByText('(Not Found)');
  });

  it('Navigate directly to an existing application', () => {
    cy.findByText('Your Rebate Forms');

    cy.visit(`/rebate/${formId}`);

    cy.findByTestId(loadingSpinnerId).should('be.visible');

    cy.findByText('View Your Submitted Rebate Application');
  });

  it('Navigate directly to an existing application without being logged in', () => {
    cy.findByText('csb-test@erg.com');

    // Sign out
    cy.findByText('Sign out').click();
    cy.findByText('You have succesfully logged out.');

    // verify the appropriate error message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.contains(
      'Click the Sign in button below to log into the Clean School Bus Rebate Dashboard using Login.gov.',
    );
  });

  it('Navigate directly to an existing application without appropriate access rights', () => {
    cy.findByText('Your Rebate Forms');

    // simulate the rebate-form-submission where user does not have access
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/rebate-form-submission/${formId}`, {
      statusCode: 200,
      body: {
        formSchema: {
          json: {},
          url: '',
        },
        submissionData: {
          access: [],
        },
        userAccess: false,
      },
    }).as('rebate-form-submission');

    // verify the appropriate message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.findByText(
      'You don’t have access to this form. Please contact support if you believe this is a mistake.',
    );
  });

  it('Navigate directly to an existing application and simulate a service failure', () => {
    cy.findByText('Your Rebate Forms');

    // simulate the rebate-form-submission service failing
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/rebate-form-submission/${formId}`, {
      statusCode: 500,
      body: {},
    }).as('rebate-form-submission');

    // verify the appropriate error message is displayed
    cy.visit(`/rebate/${formId}`);
    cy.findByText(`Error loading rebate form ${formId}.`);
  });
});
