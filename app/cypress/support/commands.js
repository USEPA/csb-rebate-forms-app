import "@testing-library/cypress/add-commands";
import "cypress-file-upload";

/**
 * This command is used for logging into CSB.
 *
 * @param username - The username of the user to login as
 * @param password - The password of the user to login as
 */
Cypress.Commands.add("loginToCSB", (username, password = "password") => {
  cy.log(`Call loginToCSB('${username}')...`);
  cy.visit("/");

  // wait for loading to complete. This text is available on the SignIn page and the post sign in page
  cy.findByRole("heading", {
    name: /Clean School Bus Rebate Forms/i,
    level: 1,
  });

  // Check if the user needs to sign in, by looking for the sign in button.
  cy.get("body").then(($body) => {
    // not signed in, so sign in as the provided user
    if ($body.find("a:contains('Sign in')").length) {
      signIn();
    }

    // signed in as a different user, so sign out and sign back in as the provided user
    else if (
      $body.find(`p:contains('${username}')`).length === 0 &&
      $body.find("a:contains('Sign out')").length
    ) {
      cy.findByRole("link", { name: "Sign out" }).click();

      signIn();
    }

    else if (
      $body.find(`p:contains('${username}')`).length &&
      $body.find("a:contains('Sign out')").length
    ) {
      // already signed in as the provided user, so do nothing
    }
  });

  function signIn() {
    cy.findByRole("link", { name: "Sign in" }).click();

    // login to CSB
    cy.findByRole("textbox", { name: "Username" }).type(username);
    cy.findByLabelText("Password").type(password);
    cy.findByRole("button", { name: "Login" }).click();
  }
});

/**
 * This command provides functions for filling out individual
 * steps of a CSB application.
 *
 * @returns Functions for filling out an application
 */
Cypress.Commands.add("getApplicationSteps", () => {
  const loadingSpinnerText = "Loading...";
  let selectedUei = "";
  let selectedEft = "";
  let selectedOrganization = "";

  function startNewApplication() {
    cy.log("Starting a new application...");

    cy.findByRole("link", { name: "New Application" }).click();

    // verify the modal is displayed
    cy.findByRole("heading", { name: "Start a New Rebate Application" });

    // wait for loading to complete
    cy.findAllByText(loadingSpinnerText).should("not.exist");

    // select the first item in the modal table
    cy.findByRole("table", { name: "SAM.gov Entities" }).within(() => {
      cy.findAllByRole("row").then(($rows) => {
        cy.wrap($rows[1]).within(() => {
          cy.findAllByRole(
            (content, _element) => content === "rowheader" || content === "cell"
          ).then(($cols) => {
            // store the selected row for later use
            selectedUei = $cols[1].innerText;
            selectedEft = $cols[2].innerText;
            selectedOrganization = $cols[3].innerText;

            // click the arrow on the first row
            cy.findByRole("button").click();
          });
        });
      });
    });
  }

  function step1() {
    cy.log("Perform step 1 tests...");

    cy.contains("1 of 6 Welcome").should("be.visible");

    // go to next step
    cy.findByRole("button", { name: /Next/i }).click();
  }

  function step2(newApplication = false) {
    cy.log("Perform step 2 tests...");

    cy.contains("2 of 6 Applicant Type");

    if (newApplication) {
      // workaround for an issue where the fields below will be cleared
      // if filled out to soon
      cy.wait(2000);

      cy.findByRole("combobox", { name: "Applicant Type" }).select(
        "School District"
      );
      cy.findByRole("radio", { name: "Yes" }).click({ force: true });
    }

    // go to next step
    cy.findByRole("button", { name: /Next/i }).click();
  }

  function step3(newApplication = false) {
    cy.log("Perform step 3 tests...");

    cy.contains("3 of 6 Applicant Information");

    if (newApplication) {
      // verify auto populated fields
      cy.findByRole("textbox", { name: "Applicant Name" }).then(($el) =>
        cy.wrap($el).should("have.value", selectedOrganization)
      );
      cy.findByRole("textbox", { name: "Unique Entity Identifier (UEI)" }).then(
        ($el) => cy.wrap($el).should("have.value", selectedUei)
      );
      cy.findByRole("textbox", {
        name: "Electronic Funds Transfer (EFT) Indicator",
      }).then(($el) => cy.wrap($el).should("have.value", selectedEft));
      cy.findByRole("textbox", { name: "City" }).should(
        "have.value",
        "WATERTOWN"
      );
      cy.findByRole("textbox", { name: "State or Territory" }).should(
        "have.value",
        "MA"
      );
      cy.findByRole("textbox", { name: /Zip Code/i }).should(
        "have.value",
        "2472"
      );

      // fill out the remainder of the form
      cy.findAllByRole("textbox", { name: "Name" }).first().type("John Doe");
      cy.findAllByRole("textbox", { name: "Title" })
        .first()
        .type("Software Developer");
      cy.findAllByRole("textbox", { name: /Business Phone Number/i })
        .first()
        .type("1234567890");
      cy.findAllByRole("textbox", { name: "Business Email" })
        .first()
        .type("test1@test.com");
      cy.findAllByRole("textbox", { name: "Name" }).last().type("Jane Doe");
      cy.findAllByRole("textbox", { name: "Title" })
        .last()
        .type("Software Developer");
      cy.findAllByRole("textbox", { name: /Business Phone Number/i })
        .last()
        .type("1234567891");
      cy.findAllByRole("textbox", { name: "Business Email" })
        .last()
        .type("test2@test.com");
    }

    // go to next step
    cy.findByRole("button", { name: /Next/i }).click();
  }

  function step4(newApplication = false) {
    cy.log("Perform step 4 tests...");

    cy.contains("4 of 6 School District Information");

    if (newApplication) {
      // wait before typing District ID - this is a workaround for an issue
      //   where the school fields aren't autopopulated
      cy.wait(2000);

      // enter a district id
      cy.findByLabelText(
        "National Center for Education Statistics (NCES) District ID"
      ).type("BIE0013");

      // verify fields are autopopulated
      cy.findByRole("textbox", { name: "School District Name" }).then(($el) =>
        cy.wrap($el).should("have.value", "Wounded Knee District")
      );
      cy.findByRole("textbox", { name: "Physical Address Line 1" }).then(
        ($el) => cy.wrap($el).should("have.value", "100 Main Street")
      );
      cy.findByRole("textbox", { name: "City" }).then(($el) =>
        cy.wrap($el).should("have.value", "Manderson")
      );
      cy.findByLabelText("State or Territory").then(($el) =>
        cy.wrap($el).should("have.value", "SD")
      );
      cy.findByRole("textbox", { name: /Zip Code/i }).then(($el) =>
        cy.wrap($el).should("have.value", "57756")
      );
      cy.findByRole("textbox", { name: "Prioritized" }).then(($el) =>
        cy.wrap($el).should("have.value", "Yes")
      );

      // fill out the remainder of the form
      cy.findByRole("textbox", { name: "Name" }).type("Bob Wilson");
      cy.findByRole("textbox", { name: "Title" }).type("Principal");
      cy.findByRole("textbox", { name: /Business Phone Number/i }).type(
        "1235469870"
      );
      cy.findByRole("textbox", { name: "Business Email" }).type(
        "test3@test.com"
      );
    }

    // go to next step
    cy.findByRole("button", { name: /Next/i }).click();
  }

  function step5(newApplication = false) {
    cy.log("Perform step 5 tests...");

    cy.contains("5 of 6 Bus Information");

    if (newApplication) {
      cy.findByRole("button", { name: /Add bus/i }).click();

      cy.findByRole("textbox", { name: /VIN/i }).type("12345678901234567");

      // workaround for dropdown tests not working
      cy.wait(2000);

      // select the manufacturer - have to do this as a workaround since formio doesn't
      // use a normal select element
      cy.findByLabelText("Manufacturer").parent().click();
      cy.findByText("Blue Bird Corporation").click();

      cy.findByLabelText("Model").type("Bus 1543");
      cy.findByRole("textbox", { name: /Model Year/i }).type("1984");
      cy.findByRole("textbox", { name: /Average Annual Mileage/i }).type(
        "40000"
      );
      cy.findByLabelText("Average Annual Fuel Consumption (gallons)", {
        exact: false,
      }).type("5000");

      // select the manufacturer - have to do this as a workaround since formio doesn't
      // use a normal select element
      cy.findByLabelText("Fuel Type").parent().click();
      cy.findByText("Diesel").click();

      cy.findAllByRole("textbox", { name: /GVWR/i }).first().type("12000");

      // upload a file
      const fileName = "testPicture.jpg";
      cy.get('div[ref="fileDrop"]').attachFile(fileName, {
        subjectType: "drag-n-drop",
      });
      cy.findByText('"Starting upload."').should("be.visible");
      cy.findByText('"Starting upload."').should("not.exist");
      cy.findByText(fileName);

      cy.findByLabelText("Replacement Fuel Type").parent().click();
      cy.findByText("Electric").click();
      cy.findByLabelText("Replacement Bus GVWR (lbs.)", { exact: false }).type(
        "12000"
      );
      cy.findByRole("textbox", { name: /Rebate Amount Requested/i })
        .invoke("val")
        .should("not.eq", "");

      // This is a workaround, since there are 3 save buttons
      cy.findByRole("button", { name: "Cancel" })
        .parent()
        .within(() => {
          cy.findByRole("button", { name: "Save" }).click();
        });
    }

    // go to next step
    cy.findByRole("button", { name: /Next/i }).click();
  }

  function step6(newApplication = false) {
    cy.log("Perform step 6 tests...");

    cy.contains("6 of 6 Review and Sign");

    if (newApplication) {
      // sign the application
      cy.get("canvas").then(($el) => {
        cy.wrap($el).click();
      });

      cy.wait(1000);

      // go to next step
      cy.findByRole("button", { name: /Submit Form/i }).click();

      // verify the success message is displayed and goes away
      cy.findAllByText("Form successfully submitted.");
      cy.findAllByText("Form successfully submitted.").should("not.exist");

      // verify the app navigates back to the dashboard
      cy.findByText(
        "This collection of information is approved by OMB under the Paperwork Reduction Act",
        { exact: false, timeout: 60000 }
      );
    }
  }

  function submitTests(schoolDistrict, expectedStatus) {
    cy.log("Complete submission tests...");

    // verify the new record is in the table
    cy.findByRole("table", { name: "Your Rebate Forms" }).within(() => {
      cy.findAllByRole("row").then(($rows) => {
        cy.wrap($rows[1]).within(() => {
          cy.findAllByRole(
            (content, _element) => content === "rowheader" || content === "cell"
          ).then(($cols) => {
            cy.wrap($cols[1].innerText).should("eq", "Application");
            cy.wrap($cols[2].innerText).should("eq", selectedUei);
            cy.wrap($cols[3].innerText).should("eq", selectedEft);
            cy.wrap($cols[4].innerText).should("eq", selectedOrganization);
            cy.wrap($cols[5].innerText).should("eq", schoolDistrict);
            cy.wrap($cols[8].innerText).should("eq", expectedStatus);
          });
        });
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
    submitTests("Wounded Knee District", "submitted");
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
