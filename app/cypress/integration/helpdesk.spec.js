describe("Helpdesk", () => {
  // TODO Remove this when the app is more stable
  Cypress.on("uncaught:exception", (_err, _runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    debugger;
    return false;
  });

  let existingFormId = "";
  const searchInputLabelText = "Search by Form ID";
  const loadingSpinnerText = "Loading...";
  const helpdeskTableLabelText = "Rebate Form Search Results";

  function performSearch(formId) {
    // search for an existing id
    cy.findByRole("searchbox", { name: searchInputLabelText }).type(formId);
    cy.findAllByRole("button", { name: "Search" }).last().click();
    cy.findByText(formId);
  }

  function checkRecords(status, buttonToClick = "updateForm") {
    // verify the record is found and has expected data
    cy.findByRole("table", { name: helpdeskTableLabelText }).within(() => {
      cy.findAllByRole("row").then(($rows) => {
        cy.wrap($rows[1]).within(() => {
          cy.findAllByRole((content, element) => 
            content === 'rowheader' || content === 'cell'
          ).then(($cols) => {
            cy.wrap($cols[1].innerText).should("eq", existingFormId);
            cy.wrap($cols[5].innerText).should("eq", status);

            // click the change submission status button
            if (status === "submitted") {
              if (buttonToClick === "openForm") {
                cy.wrap($cols[0]).find("button").click();
              }
              if (buttonToClick === "updateForm") {
                cy.wrap($cols[6]).find("button").click();
              }
            }
          });
        })
      });
    });
  }

  before(() => {
    cy.loginToCSB("csbtest");

    cy.getApplicationSteps().then((steps) => {
      steps.fillOutNewApplication();
    });

    // get a formId from an existing application
    cy.findByRole("table", { name: "Your Rebate Forms" }).within(() => {
      cy.findAllByRole("row").then(($rows) => {
        cy.wrap($rows[1]).within(() => {
          cy.findByRole("link", { name: /Open Form/i }).click();
        })
      });
    });

    // verify the tab loaded
    cy.contains("1 of 6 Welcome");

    // extract the form id
    cy.get("body").then(($body) => {
      const elm = $body.find("h3:contains('Application ID:')")[0];
      existingFormId = elm.innerText.replace("Application ID: ", "");
    });
  });

  beforeEach(() => {
    cy.loginToCSB("csbtest");

    // navigate to helpdesk
    cy.findByRole("link", { name: "Helpdesk" }).click();
  });

  it("Test search input", () => {
    const errorText =
      "Error loading rebate form submission. Please confirm the form ID is correct and search again.";

    cy.findByText("Change Rebate Form Submission State");

    // scope this test to just the root, so the Search button in the
    // One EPA Template does not affect this test
    cy.get("#root").within(() => {
      cy.log("Test empty search");
      cy.findAllByRole("button", { name: "Search" }).last().click();
      cy.findByText(errorText);

      cy.log("Test random text in search");
      cy.findByRole("searchbox", { name: searchInputLabelText }).type("dsfdkljfskl");
      cy.findAllByRole("button", { name: "Search" }).last().click();
      cy.findByRole("searchbox", { name: searchInputLabelText }).clear();
      cy.findByText(errorText);

      cy.log("Test searching for an existing rebate form id");
      cy.findByRole("searchbox", { name: searchInputLabelText }).type(existingFormId);
      cy.findAllByRole("button", { name: "Search" }).last().click();
      cy.findByRole("searchbox", { name: searchInputLabelText }).clear(); // clear input so as not to trip up findByText
      cy.findByText(existingFormId);

      cy.log("Test searching for a non-existing rebate form id");
      cy.findByRole("searchbox", { name: searchInputLabelText }).type("1234567890abcdefghijklmn");
      cy.findAllByRole("button", { name: "Search" }).last().click();
      cy.findByRole("searchbox", { name: searchInputLabelText }).clear(); // clear input so as not to trip up findByText
      cy.findByText(errorText);

      cy.log("Test searching for a typo on an existing rebate form id");
      cy.findByRole("searchbox", { name: searchInputLabelText }).type("624f31dfb9cf1fafec93153a");
      cy.findAllByRole("button", { name: "Search" }).last().click();
      cy.findByRole("searchbox", { name: searchInputLabelText }).clear(); // clear input so as not to trip up findByText
      cy.findByText(errorText);
    });
  });

  it("Test viewing application from helpdesk", () => {
    performSearch(existingFormId);

    // verify the status is submitted
    checkRecords("submitted", "openForm");

    // verify the first step is displayed
    cy.contains("1 of 6 Welcome");
    cy.findByText("Next").click();

    // verify the form elements on the second step are disabled
    cy.contains("2 of 6 Applicant Type");
    cy.findByRole("combobox", { name: "Applicant Type" }).should("be.disabled");
  });

  it("Test setting back to draft", () => {
    performSearch(existingFormId);

    // verify the status is submitted
    checkRecords("submitted");

    // cancel setting the status back to draft
    cy.findByText(
      "Are you sure you want to change this submission's state back to draft?"
    );
    cy.findByRole("button", { name: "Cancel" }).click();

    // verify modal closed
    cy.findByText(existingFormId);

    // verify the status is still submitted
    checkRecords("submitted");

    // reset the status back to draft
    cy.findByRole("button", { name: "Yes" }).click();

    // verify the status was set back to draft
    cy.findAllByText(loadingSpinnerText).should("be.visible");
    cy.findAllByText(loadingSpinnerText).should("not.exist");
    checkRecords("draft");
  });
});
