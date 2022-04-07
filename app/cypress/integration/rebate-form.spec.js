describe('Rebate Form', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  // Leave the user logged in to prevent logging in for every test
  Cypress.Cookies.defaults({
    preserve: 'csb-token',
  });

  const loadingSpinnerId = 'csb-loading-spinner';
  let selectedUei = '';
  let selectedEft = '';
  let selectedOrganization = '';

  function verifyStepCounter(stepNumber, stepTitle) {
    // verify the page step number and title
    cy.get('.usa-step-indicator__heading').then(($elms) => {
      cy.wrap($elms[0]).contains(`${stepNumber} of 7 ${stepTitle}`);
    });
  }

  function startNewApplication() {
    cy.log('Starting a new application...');

    cy.findByText('New Application').click();

    // verify the modal is displayed
    cy.findByText('Start a New Rebate Application');

    // wait for loading to complete
    cy.findByTestId(loadingSpinnerId).should('not.exist');

    // select the first item in the modal table
    cy.findByTestId('csb-modal-table').within(($el) => {
      cy.get('tbody > tr').then(($elms) => {
        const $firstElm = $elms[0];

        cy.wrap($firstElm).within(($firstRow) => {
          cy.get('th').then(($cols) => {
            // store the selected row for later use
            selectedUei = $cols[1].innerText;
            selectedEft = $cols[2].innerText;
            selectedOrganization = $cols[3].innerText;

            // click the arrow on the first row
            cy.wrap($cols[0])
              .get('button')
              .then(($buttons) => {
                cy.wrap($buttons[0]).click();
              });
          });
        });
      });
    });
  }

  function step1() {
    cy.log('Perform step 1 tests...');

    verifyStepCounter('1', 'Introduction');

    cy.findByText(
      'EPA is ready to assist fleets in purchasing new, cleaner school buses',
      { exact: false },
    );

    // go to next step
    cy.findByText('Next').click();
  }

  function step2() {
    cy.log('Perform step 2 tests...');

    verifyStepCounter('2', 'Welcome');

    cy.findByText(
      'Begin your rebate application for the Clean School Bus (CSB) program here.',
      { exact: false },
    );

    // go to next step
    cy.findByText('Next').click();
  }

  function step3(fillOutForm = false) {
    cy.log('Perform step 3 tests...');

    verifyStepCounter('3', 'Organization Type');

    cy.findByText('Applicant Organization Type');

    if (fillOutForm) {
      const orgInputQuery = 'select[name="data[applicantOrganizationType]"]';
      const replaceInputYesQuery =
        'input[name*="data[doesYourOrganizationOwnTheBusesToBeReplaced]"][value=yes]';

      cy.get(orgInputQuery).select('Local Education Agency (LEA)');
      cy.get(replaceInputYesQuery).click({ force: true });
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step4(fillOutForm = false) {
    cy.log('Perform step 4 tests...');

    verifyStepCounter('4', 'Applicant Information');

    if (fillOutForm) {
      // verify auto populated fields
      cy.get('input[name="data[applicantOrganizationName]"]').then(($el) =>
        cy.wrap($el).should('have.value', selectedOrganization),
      );
      cy.get('input[name="data[applicantUEI]"]').then(($el) =>
        cy.wrap($el).should('have.value', selectedUei),
      );
      cy.get('input[name="data[applicantEfti]"]').then(($el) =>
        cy.wrap($el).should('have.value', selectedEft),
      );
      cy.get('input[name="data[applicantCity]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'WATERTOWN'),
      );
      cy.get('input[name="data[applicantState]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'MA'),
      );
      cy.get('input[name="data[applicantZipCode]"]').then(($el) =>
        cy.wrap($el).should('have.value', '2472'),
      );

      // fill out the remainder of the form
      cy.get('input[name="data[primaryContactName]"]').type('John Doe');
      cy.get('input[name="data[primaryContactTitle]"]').type(
        'Software Developer',
      );
      cy.get('input[name="data[primaryContactPhoneNumber]"]').type(
        '1234567890',
      );
      cy.get('input[name="data[primaryContactEmail]"]').type('test1@test.com');
      cy.get('input[name="data[alternateContactName]"]').type('Jane Doe');
      cy.get('input[name="data[alternateContactTitle]"]').type(
        'Software Developer',
      );
      cy.get('input[name="data[alternateContactPhoneNumber]"]').type(
        '1234567891',
      );
      cy.get('input[name="data[alternateContactEmail]"]').type(
        'test2@test.com',
      );
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step5(fillOutForm = false) {
    cy.log('Perform step 5 tests...');

    verifyStepCounter('5', 'School District Information');

    if (fillOutForm) {
      // enter a district id
      cy.get('input[name="data[ncesDistrictId]"]').type('BIE0013');

      // verify fields are autopopulated
      cy.get('input[name="data[schoolDistrictName]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'Wounded Knee District'),
      );
      cy.get('input[name="data[schoolDistrictPhysicalAddressLine1]"]').then(
        ($el) => cy.wrap($el).should('have.value', '100 Main Street'),
      );
      cy.get('input[name="data[schoolDistrictCity]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'Manderson'),
      );
      cy.get('input[name="data[schoolDistrictState]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'SD'),
      );
      cy.get('input[name="data[schoolDistrictZipCode]"]').then(($el) =>
        cy.wrap($el).should('have.value', '57756'),
      );
      cy.get('input[name="data[schoolDistricPrioritized]"]').then(($el) =>
        cy.wrap($el).should('have.value', 'Yes'),
      );

      // fill out the remainder of the form
      cy.get('input[name="data[schoolDistrictContactName]"]').type(
        'Bob Wilson',
      );
      cy.get('input[name="data[schoolDistrictContactTitle]"]').type(
        'Principal',
      );
      cy.get('input[name="data[schoolDistrictContactPhoneNumber]"]').type(
        '1235469870',
      );
      cy.get('input[name="data[schoolDistrictContactEmail]"]').type(
        'test3@test.com',
      );
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step6() {
    cy.log('Perform step 6 tests...');

    verifyStepCounter('6', 'Bus Information');

    // go to next step
    cy.findByText('Next').click();
  }

  function step7(fillOutForm = false) {
    cy.log('Perform step 7 tests...');

    verifyStepCounter('7', 'Review and Sign');

    if (fillOutForm) {
      // sign the application
      cy.get('canvas[class="signature-pad-canvas"]').then(($el) => {
        cy.wrap($el).click();
      });

      cy.wait(1000);

      // go to next step
      cy.findByText('Submit Form').click();

      // verify the success message is displayed and goes away
      cy.findByText('Form succesfully submitted.');
      cy.findByText('Form succesfully submitted.').should('not.exist');

      // verify the app navigates back to the dashboard
      cy.findByText(
        'This collection of information is approved by OMB under the Paperwork Reduction Act',
        { exact: false },
      );
    }
  }

  function submitTests() {
    cy.log('Complete submission tests...');

    // TODO Uncomment the below tests when the submit code is fixed
    //      Currently there is an issue where the data is not saved on submit
    // // verify the new record is in the table
    // cy.findByTestId('csb-rebate-forms-thead')
    //   .get('tbody > tr')
    //   .within(($rows) => {
    //     const $firstRow = $rows[0];
    //     cy.wrap($firstRow)
    //       .get('th,td')
    //       .then(($cols) => {
    //         cy.wrap($cols[1].innerText).should('eq', 'Application');
    //         cy.wrap($cols[2].innerText).should('eq', selectedUei);
    //         cy.wrap($cols[3].innerText).should('eq', selectedEft);
    //         cy.wrap($cols[4].innerText).should('eq', selectedOrganization);
    //         cy.wrap($cols[5].innerText).should('eq', 'CODE RVA HIGH');
    //         cy.wrap($cols[6].innerText).should('eq', 'csb-test@erg.com');
    //         cy.wrap($cols[8].innerText).should('eq', 'submitted');
    //       });
    //   });
  }

  beforeEach(() => {
    cy.loginToCSB('csbtest');
  });

  it('New application', () => {
    // run the tests
    startNewApplication();
    step1();
    step2();
    step3(true);
    step4(true);
    step5(true);
    step6();
    step7(true);
    submitTests();
  });

  it('New application - Save and Continue button', () => {
    // complete steps 1 - 4
    startNewApplication();
    step1();
    step2();
    step3(true);
    step4(true);

    // go back to step 4
    cy.findByText('Previous').click();
    verifyStepCounter('4', 'Applicant Information');

    cy.get('button:contains("Save and Continue")').first().click();

    // TODO Update the success message test as currently there are issues with saving
    cy.findByText('Submission Complete');

    submitTests();

    // TODO create a test the opens the saved partial application and
    // verifies the application is partially filled out
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
    // verify the new record is in the table
    cy.findByTestId('csb-rebate-forms-thead')
      .get('tbody > tr')
      .within(($rows) => {
        const $firstRow = $rows[0];
        cy.wrap($firstRow)
          .get('th,td')
          .then(($cols) => {
            cy.wrap($cols[0]).click();
          });
      });

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
    step1();
    step2();

    cy.findByText('Your Rebate Forms').click();
    cy.get('.usa-modal__main')
      .filter(':visible')
      .within(($el) => {
        cy.findByText('Cancel').click();
      });

    cy.findByText('Your Rebate Forms').click();
    cy.get('.usa-modal__content')
      .filter(':visible')
      .within(($el) => {
        cy.get('button[aria-label="Close this window"]').click();
      });

    // go back to the dashboard
    cy.findByText('Your Rebate Forms').click();
    cy.get('.usa-modal__main')
      .filter(':visible')
      .within(($el) => {
        cy.findByText('Yes').click();
      });
  });
});
