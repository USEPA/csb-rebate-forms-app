describe('Helpdesk', () => {
  // TODO Remove this when the app is more stable
  Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  const existingFormId = '624f31dfb9cf1fafec93153d';

  beforeEach(() => {
    cy.loginToCSB('csbhelpdesk');

    // navigate to helpdesk
    cy.findByText('Helpdesk').click();

    // click yes on modal dialog
    cy.findByText('Are you sure you want to navigate away from this page?');
    cy.findByText('Yes').click();
  });

  it('Test search input', () => {
    const searchInputLabelText = 'Search by Form ID';
    const errorText = 'Error loading rebate form submission. Please confirm the form ID is correct and search again.';

    cy.findByText('Change Rebate Form Submission State');

    // scope this test to just the root, so the Search button in the 
    // One EPA Template does not affect this test
    cy.get('#root').within(($main) => {
      cy.log('Test empty search');
      cy.contains('button', 'Search').click();
      cy.findByText(errorText);

      cy.log('Test random text in search');
      cy.findByLabelText(searchInputLabelText).type('dsfdkljfskl');
      cy.contains('button', 'Search').click();
      cy.findByLabelText(searchInputLabelText).clear();
      cy.findByText(errorText);

      cy.log('Test searching for an existing rebate form id');
      cy.findByLabelText(searchInputLabelText).type(existingFormId);
      cy.contains('button', 'Search').click();
      cy.findByLabelText(searchInputLabelText).clear(); // clear input so as not to trip up findByText
      cy.findByText(existingFormId);

      cy.log('Test searching for a non-existing rebate form id');
      cy.findByLabelText(searchInputLabelText).type('1234567890abcdefghijklmn');
      cy.contains('button', 'Search').click();
      cy.findByLabelText(searchInputLabelText).clear(); // clear input so as not to trip up findByText
      cy.findByText(errorText);

      cy.log('Test searching for a typo on an existing rebate form id');
      cy.findByLabelText(searchInputLabelText).type('624f31dfb9cf1fafec93153a');
      cy.contains('button', 'Search').click();
      cy.findByLabelText(searchInputLabelText).clear(); // clear input so as not to trip up findByText
      cy.findByText(errorText);
  });
  });
});
