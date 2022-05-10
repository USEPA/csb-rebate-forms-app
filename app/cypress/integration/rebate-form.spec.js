describe("Rebate Form", () => {
  // TODO Remove this when the app is more stable
  Cypress.on("uncaught:exception", (_err, _runnable) => {
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
    submitTests;

  // Verifies a record is in the table and clicks the first row
  function clickFirstRebateFormRow() {
    cy.findByRole("table", { name: "Your Rebate Forms" }).within(() => {
      cy.findAllByRole("row").then(($rows) => {
        cy.wrap($rows[1]).within(() => {
          cy.findByRole("link").click();
        });
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
        submitTests,
      } = steps);
    });
  });

  beforeEach(() => {
    cy.loginToCSB("csbtest");

    // Leave the user logged in to prevent logging in for every test
    Cypress.Cookies.defaults({
      preserve: "csb-token",
    });
  });

  it("New application - Save and Continue button", () => {
    // complete steps 1 - 3
    startNewApplication();
    step1();
    step2(true);
    step3(true);

    // go back to step 3
    cy.findByRole("button", { name: /Previous/i }).click();
    cy.contains("3 of 6 Applicant Information");

    cy.findAllByRole("button", { name: "Save" }).first().click();

    // verify the save messages
    cy.findAllByText("Saving form...");
    cy.findAllByText("Draft successfully saved.");

    // go back to the dashboard
    cy.findByRole("link", { name: "Your Rebate Forms" }).click();
    cy.findByRole("heading", {
      name: "Are you sure you want to navigate away from this page?",
      level: 2,
    });
    cy.findByRole("button", { name: "Yes" }).click();

    // verify the new application is marked as draft
    submitTests("", "draft");

    clickFirstRebateFormRow();

    // complete the application
    step1();
    step2();
    step3();
    step4(true);
    step5(true);
    step6(true);

    // verify the application is now marked as submitted
    submitTests("Wounded Knee District", "submitted");
  });

  it("Existing application", () => {
    clickFirstRebateFormRow();

    // run the tests
    step1();
    step2();
    step3();
    step4();
    step5();
    step6();
  });

  it("Modal cancel tests", () => {
    startNewApplication();
    step1();
    step2();

    cy.findByRole("link", { name: "Your Rebate Forms" }).click();
    cy.findByRole("button", { name: "Cancel" }).click();

    cy.findByRole("link", { name: "Your Rebate Forms" }).click();
    cy.findByRole("button", { name: "Close this window" }).click();

    // go back to the dashboard
    cy.findByRole("link", { name: "Your Rebate Forms" }).click();
    cy.findByRole("button", { name: "Yes" }).click();
  });
});
