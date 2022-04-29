import '@testing-library/cypress/add-commands';
import 'cypress-file-upload';

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
    if (
      $body.find(`p:contains('${username}')`).length === 0 &&
      $body.find("a:contains('Sign out')").length
    ) {
      cy.contains('a', 'Sign out').click();

      cy.findAllByText('Sign in');

      signIn();
    }

    if ($body.find("a:contains('Sign in')").length) {
      signIn();
    }
  });

  function signIn() {
    cy.contains('a', 'Sign in').click();

    // login to CSB
    cy.findByLabelText('Username').type(username);
    cy.findByLabelText('Password').type(password);
    cy.findByText('Login').click();
  }
});

/**
 * This command provides functions for filling out individual
 * steps of a CSB application.
 *
 * @returns Functions for filling out an application
 */
Cypress.Commands.add('getApplicationSteps', () => {
  const loadingSpinnerText = 'Loading...';
  let selectedUei = '';
  let selectedEft = '';
  let selectedOrganization = '';

  function startNewApplication() {
    cy.log('Starting a new application...');

    cy.findByText('New Application').click();

    // verify the modal is displayed
    cy.findByText('Start a New Rebate Application');

    // wait for loading to complete
    cy.findAllByText(loadingSpinnerText).should('not.exist');

    // select the first item in the modal table
    cy.findByLabelText('SAM.gov Entities').within(() => {
      cy.get('tbody > tr').then(($elms) => {
        const $firstElm = $elms[0];

        cy.wrap($firstElm).within(() => {
          cy.get('th,td').then(($cols) => {
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

    cy.contains('1 of 6 Welcome').should('be.visible');

    // go to next step
    cy.findByText('Next').click();
  }

  function step2(newApplication = false) {
    cy.log('Perform step 2 tests...');

    cy.contains('2 of 6 Applicant Type');

    if (newApplication) {
      // workaround for an issue where the fields below will be cleared
      // if filled out to soon
      cy.wait(2000);

      cy.findByLabelText('Applicant Type').select('School District');
      cy.findByLabelText('Yes').click({ force: true });
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step3(newApplication = false) {
    cy.log('Perform step 3 tests...');

    cy.contains('3 of 6 Applicant Information');

    if (newApplication) {
      // verify auto populated fields
      cy.findByLabelText('Applicant Name').then(($el) =>
        cy.wrap($el).should('have.value', selectedOrganization),
      );
      cy.findByLabelText('Unique Entity Identifier (UEI)').then(($el) =>
        cy.wrap($el).should('have.value', selectedUei),
      );
      cy.findByLabelText('Electronic Funds Transfer (EFT) Indicator').then(
        ($el) => cy.wrap($el).should('have.value', selectedEft),
      );
      cy.findByLabelText('City').should('have.value', 'WATERTOWN');
      cy.findByLabelText('State or Territory').should('have.value', 'MA');
      cy.findByLabelText('Zip Code', { exact: false }).should(
        'have.value',
        '02472',
      );

      // fill out the remainder of the form
      cy.findAllByLabelText('Name').first().type('John Doe');
      cy.findAllByLabelText('Title').first().type('Software Developer');
      cy.findAllByLabelText('Business Phone Number', { exact: false })
        .first()
        .type('1234567890');
      cy.findAllByLabelText('Business Email').first().type('test1@test.com');
      cy.findAllByLabelText('Name').last().type('Jane Doe');
      cy.findAllByLabelText('Title').last().type('Software Developer');
      cy.findAllByLabelText('Business Phone Number', { exact: false })
        .last()
        .type('1234567891');
      cy.findAllByLabelText('Business Email').last().type('test2@test.com');
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step4(newApplication = false) {
    cy.log('Perform step 4 tests...');

    cy.contains('4 of 6 School District Information');

    if (newApplication) {
      // wait before typing District ID - this is a workaround for an issue
      //   where the school fields aren't autopopulated
      cy.wait(2000);

      // enter a district id
      cy.findByLabelText(
        'National Center for Education Statistics (NCES) District ID',
      ).type('BIE0013');

      // verify fields are autopopulated
      cy.findByLabelText('School District Name').then(($el) =>
        cy.wrap($el).should('have.value', 'Wounded Knee District'),
      );
      cy.findByLabelText('Physical Address Line 1').then(($el) =>
        cy.wrap($el).should('have.value', '100 Main Street'),
      );
      cy.findByLabelText('City').then(($el) =>
        cy.wrap($el).should('have.value', 'Manderson'),
      );
      cy.findByLabelText('State or Territory').then(($el) =>
        cy.wrap($el).should('have.value', 'SD'),
      );
      cy.findByLabelText('Zip Code', { exact: false }).then(($el) =>
        cy.wrap($el).should('have.value', '57756'),
      );
      cy.findByLabelText('Prioritized').then(($el) =>
        cy.wrap($el).should('have.value', 'Yes'),
      );

      // fill out the remainder of the form
      cy.findByLabelText('Name').type('Bob Wilson');
      cy.findByLabelText('Title').type('Principal');
      cy.findByLabelText('Business Phone Number', { exact: false }).type(
        '1235469870',
      );
      cy.findByLabelText('Business Email').type('test3@test.com');
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step5(newApplication = false) {
    cy.log('Perform step 5 tests...');

    cy.contains('5 of 6 Bus Information');

    if (newApplication) {
      cy.findByText('Add bus').click();

      cy.findByLabelText('VIN').type('12345678901234567');

      // workaround for dropdown tests not working
      cy.wait(2000);

      // select the manufacturer - have to do this as a workaround since formio doesn't
      // use a normal select element
      cy.findByLabelText('Manufacturer').parent().click();
      cy.findByText('Blue Bird Corporation').click();

      cy.findByLabelText('Model').type('Bus 1543');
      cy.findByLabelText('Model Year', { exact: false }).type('1984');
      cy.findByLabelText('Average Annual Mileage', { exact: false }).type(
        '40000',
      );
      cy.findByLabelText('Average Annual Fuel Consumption (gallons)', {
        exact: false,
      }).type('5000');

      // select the manufacturer - have to do this as a workaround since formio doesn't
      // use a normal select element
      cy.findByLabelText('Fuel Type').parent().click();
      cy.findByText('Diesel').click();

      cy.findAllByLabelText('GVWR', { exact: false }).first().type('12000');

      // upload a file
      const fileName = 'testPicture.jpg';
      cy.get('div[ref="fileDrop"]').attachFile(fileName, {
        subjectType: 'drag-n-drop',
      });
      cy.findByText('"Starting upload."').should('be.visible');
      cy.findByText('"Starting upload."').should('not.exist');
      cy.findByText(fileName);

      cy.findByLabelText('Replacement Fuel Type').parent().click();
      cy.findByText('Electric').click();
      cy.findByLabelText('Replacement Bus GVWR (lbs.)', { exact: false }).type(
        '12000',
      );
      cy.findByLabelText('Rebate Amount Requested', { exact: false }).invoke('val').should('not.eq', '');

      // This is a workaround, since there are 3 save buttons
      cy.findByText('Cancel')
        .parent()
        .within(() => {
          cy.findByText('Save').click();
        });
    }

    // go to next step
    cy.findByText('Next').click();
  }

  function step6(newApplication = false) {
    cy.log('Perform step 6 tests...');

    cy.contains('6 of 6 Review and Sign');

    if (newApplication) {
      // sign the application
      cy.get('canvas').then(($el) => {
        cy.wrap($el).click();
      });

      cy.wait(1000);

      // go to next step
      cy.findByText('Submit Form').click();

      // verify the success message is displayed and goes away
      cy.findAllByText('Form successfully submitted.');
      cy.findAllByText('Form successfully submitted.').should('not.exist');

      // verify the app navigates back to the dashboard
      cy.findByText(
        'This collection of information is approved by OMB under the Paperwork Reduction Act',
        { exact: false, timeout: 60000 },
      );
    }
  }

  function submitTests(schoolDistrict, expectedStatus) {
    cy.log('Complete submission tests...');

    // verify the new record is in the table
    cy.findByLabelText('Your Rebate Forms')
      .get('tbody > tr')
      .within(($rows) => {
        const $firstRow = $rows[0];
        cy.wrap($firstRow)
          .get('th,td')
          .then(($cols) => {
            cy.wrap($cols[1].innerText).should('eq', 'Application');
            cy.wrap($cols[2].innerText).should('eq', selectedUei);
            cy.wrap($cols[3].innerText).should('eq', selectedEft);
            cy.wrap($cols[4].innerText).should('eq', selectedOrganization);
            cy.wrap($cols[5].innerText).should('eq', schoolDistrict);
            cy.wrap($cols[8].innerText).should('eq', expectedStatus);
          });
      });
  }

  function fillOutNewApplication() {
    startNewApplication();
    step1();
    step2(true);
    step3(true);
    step4(true);
    step5(true);
    step6(true);
    submitTests('Wounded Knee District', 'submitted');
  }

  return cy.wrap({
    startNewApplication,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    submitTests,
    fillOutNewApplication,
  });
});
