describe('Rebate Form', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (_err, _runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  let startNewApplication,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    step7,
    submitTests,
    fillOutNewApplication;

  // Verifies a record is in the table and clicks the first row
  function clickFirstRebateFormRow() {
    cy.findByLabelText('Your Rebate Forms')
      .get('tbody > tr')
      .within(($rows) => {
        const $firstRow = $rows[0];
        cy.wrap($firstRow)
          .get('th,td')
          .then(($cols) => {
            cy.wrap($cols[0]).click();
          });
      });
  }

  before(() => {
    cy.getApplicationSteps().then((steps) => {
      ({
        startNewApplication,
        step1,
        step2,
        step3,
        step4,
        step5,
        step6,
        step7,
        submitTests,
        fillOutNewApplication,
      } = steps);
    });
  });

  beforeEach(() => {
    cy.loginToCSB('csbtest');

    // Leave the user logged in to prevent logging in for every test
    Cypress.Cookies.defaults({
      preserve: 'csb-token',
    });
  });

  it('New application', () => {
    // run the tests
    fillOutNewApplication();
  });

  it('New application - Save and Continue button', () => {
    // complete steps 1 - 4
    startNewApplication();
    step1(true);
    step2();
    step3(true);
    step4(true);

    // go back to step 4
    cy.findByText('Previous').click();
    cy.contains('4 of 7 Applicant Information');

    cy.findAllByText('Save and Continue').filter('button').first().click();

    // verify the save messages
    cy.findAllByText('Saving form...');
    cy.findAllByText('Draft succesfully saved.');

    // go back to the dashboard
    cy.findByText('Your Rebate Forms').click();
    cy.findByText('Are you sure you want to navigate away from this page?');
    cy.findByText('Yes').click();

    // verify the new application is marked as draft
    submitTests('', 'draft');

    clickFirstRebateFormRow();

    // complete the application
    step1();
    step2();
    step3();
    step4();
    step5(true);
    step6();
    step7(true);

    // verify the application is now marked as submitted
    submitTests('Wounded Knee District', 'submitted');
  });

  it('New application service error', () => {
    // simulate the rebate-form-schema service failing
    const origin =
      location.hostname === 'localhost'
        ? `${location.protocol}//${location.hostname}:3001`
        : window.location.origin;
    cy.intercept(`${origin}/api/rebate-form-schema/`, {
      statusCode: 500,
      body: {},
    }).as('rebate-form-schema');

    // verify the appropriate error message is displayed
    startNewApplication();
    cy.findByText('Error loading rebate form.');
  });

  it('Existing application', () => {
    clickFirstRebateFormRow();

    // run the tests
    step1();
    step2();
    step3();
    step4();
    step5();
    step6();
    step7();
  });

  it('Modal cancel tests', () => {
    startNewApplication();
    step1(true);
    step2();

    cy.findByText('Your Rebate Forms').click();
    cy.findByText('Cancel').click();

    cy.findByText('Your Rebate Forms').click();
    cy.get('button[aria-label="Close this window"]').click();

    // go back to the dashboard
    cy.findByText('Your Rebate Forms').click();
    cy.findByText('Yes').click();
  });
});
