import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Formio } from "formiojs";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import ConfirmationDialog from "components/confirmationDialog";
import { SAMUserData, useUserState, useUserDispatch } from "contexts/user";
import { useContentDispatch } from "contexts/content";
import { Action, useDialogDispatch } from "contexts/dialog";

Formio.use(uswds);

function useMatchedContactInfo() {
  const { epaUserData, samUserData } = useUserState();

  if (epaUserData.status !== "success" || samUserData.status !== "success") {
    return [];
  }

  const samEmailFields = [
    "ELEC_BUS_POC_EMAIL__c",
    "ALT_ELEC_BUS_POC_EMAIL__c",
    "GOVT_BUS_POC_EMAIL__c",
    "ALT_GOVT_BUS_POC_EMAIL__c",
  ];

  // matchedPOCs will be an array of objects containing the name and title
  // of SAM.gov POCs that share the same email address as the currently
  // logged in user
  const matchedPOCs = [];

  for (const record of samUserData.data) {
    let matchedEmailField;

    for (const [field, value] of Object.entries(record)) {
      if (!samEmailFields.includes(field)) continue;
      // TODO: below takes the first match only – confirm there's never a case
      // where the currently logged in user would be listed as multiple POCs
      // for a single record, and if so, we'd ever not just take the first match
      if (value === epaUserData.data.mail) {
        matchedEmailField = field;
        break;
      }
    }

    const fieldPrefix = matchedEmailField?.split("_EMAIL__c").shift();
    if (!fieldPrefix) continue;

    matchedPOCs.push({
      name: record[`${fieldPrefix}_NAME__c` as keyof SAMUserData] as string,
      title: record[`${fieldPrefix}_TITLE__c` as keyof SAMUserData] as string,
    });
  }

  return matchedPOCs;
}

function useFetchedSamData() {
  const dispatch = useUserDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_SAM_USER_DATA_REQUEST" });
    fetchData(`${serverUrl}/api/v1/sam-data`)
      .then((res) => {
        dispatch({
          type: "FETCH_SAM_USER_DATA_SUCCESS",
          payload: { samUserData: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_SAM_USER_DATA_FAILURE" });
      });
  }, [dispatch]);
}

function useFetchedContent() {
  const dispatch = useContentDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_CONTENT_REQUEST" });
    fetchData(`${serverUrl}/api/v1/content`)
      .then((res) => {
        const {
          allRebateFormsIntro,
          allRebateFormsOutro,
          newRebateFormIntro,
          newRebateFormDialog,
          existingDraftRebateFormIntro,
          existingSubmittedRebateFormIntro,
        } = res;
        dispatch({
          type: "FETCH_CONTENT_SUCCESS",
          payload: {
            allRebateFormsIntro,
            allRebateFormsOutro,
            newRebateFormIntro,
            newRebateFormDialog,
            existingDraftRebateFormIntro,
            existingSubmittedRebateFormIntro,
          },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_CONTENT_FAILURE" });
      });
  }, [dispatch]);
}

type IconTextProps = {
  order: "icon-text" | "text-icon";
  icon: string;
  text: string;
};

function IconText({ order, icon, text }: IconTextProps) {
  const Icon = (
    <svg
      key="icon"
      className="usa-icon"
      aria-hidden="true"
      focusable="false"
      role="img"
    >
      <use href={`${icons}#${icon}`} />
    </svg>
  );

  const Text = (
    <span
      key="text"
      className={`margin-${order === "icon-text" ? "left" : "right"}-1`}
    >
      {text}
    </span>
  );

  return (
    <span className="display-flex flex-align-center">
      {order === "icon-text" ? [Icon, Text] : [Text, Icon]}
    </span>
  );
}

export default function Dashboard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { epaUserData } = useUserState();
  const dispatch = useDialogDispatch();

  useFetchedSamData();
  useFetchedContent();

  // TODO: store this in React context, but first, get clarification...
  // NOTE: there will be one matched contact info object for every SAM.gov record
  // returned for the user, so determine if the contact info is the same for every
  // one and if not, how to determine which to store. I'm not sure how SAM.gov
  // records are created, but if another person adds you as a POC, using your email
  // address and mistypes your name, that typo could display in this app.
  const matchedContactInfo = useMatchedContactInfo();
  console.log(matchedContactInfo);

  /**
   * When provided a destination location to navigate to, creates an action
   * object that can be dispatched to the `DialogProvider` context component,
   * which the `ConfirmationDialog` component uses to display the provided info.
   */
  function createDialogNavAction(destination: string): Action {
    return {
      type: "DISPLAY_DIALOG",
      payload: {
        heading: "Are you sure you want to navigate away from this page?",
        description:
          "If you haven’t saved the current form, any changes you’ve made will be lost.",
        confirmText: "Yes",
        cancelText: "Cancel",
        confirmedAction: () => navigate(destination),
      },
    };
  }

  return (
    <div>
      <h1>Clean School Bus Rebate Forms</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        {pathname === "/" ? (
          <nav>
            <button className="usa-button font-sans-2xs" disabled>
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </button>

            <Link to="/rebate/new" className="usa-button font-sans-2xs">
              <IconText order="icon-text" icon="add_circle" text="New Rebate" />
            </Link>
          </nav>
        ) : (
          <nav>
            <a
              href="/"
              className="usa-button font-sans-2xs"
              onClick={(ev) => {
                ev.preventDefault();
                const action = createDialogNavAction("/");
                dispatch(action);
              }}
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </a>

            <button className="usa-button font-sans-2xs" disabled>
              <IconText order="icon-text" icon="add_circle" text="New Rebate" />
            </button>
          </nav>
        )}

        <nav className="display-flex flex-align-center">
          <p className="margin-bottom-0 margin-right-1">
            <span>
              {epaUserData.status === "success" && epaUserData.data.mail}
            </span>
          </p>

          <a
            className="usa-button font-sans-2xs margin-right-0"
            href={`${serverUrl}/logout`}
          >
            <IconText order="text-icon" icon="logout" text="Sign out" />
          </a>
        </nav>
      </div>

      <ConfirmationDialog />

      <Outlet />
    </div>
  );
}
