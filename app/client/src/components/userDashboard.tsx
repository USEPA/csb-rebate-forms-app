import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Formio } from "@formio/react";
import premium from "@formio/premium";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import {
  serverUrl,
  serverUrlForHrefs,
  formioBaseUrl,
  formioProjectUrl,
  getData,
} from "../config";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { Action, useDialogDispatch } from "contexts/dialog";

type CsbData = {
  submissionPeriodOpen: {
    application: boolean;
    paymentRequest: boolean;
    closeOut: boolean;
  };
};

export type BapSamEntity = {
  ENTITY_COMBO_KEY__c: string;
  UNIQUE_ENTITY_ID__c: string;
  ENTITY_EFT_INDICATOR__c: string;
  ENTITY_STATUS__c: "Active" | string;
  LEGAL_BUSINESS_NAME__c: string;
  PHYSICAL_ADDRESS_LINE_1__c: string;
  PHYSICAL_ADDRESS_LINE_2__c: string | null;
  PHYSICAL_ADDRESS_CITY__c: string;
  PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: string;
  PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: string;
  PHYSICAL_ADDRESS_ZIP_CODE_4__c: string;
  // contacts
  ELEC_BUS_POC_EMAIL__c: string | null;
  ELEC_BUS_POC_NAME__c: string | null;
  ELEC_BUS_POC_TITLE__c: string | null;
  //
  ALT_ELEC_BUS_POC_EMAIL__c: string | null;
  ALT_ELEC_BUS_POC_NAME__c: string | null;
  ALT_ELEC_BUS_POC_TITLE__c: string | null;
  //
  GOVT_BUS_POC_EMAIL__c: string | null;
  GOVT_BUS_POC_NAME__c: string | null;
  GOVT_BUS_POC_TITLE__c: string | null;
  //
  ALT_GOVT_BUS_POC_EMAIL__c: string | null;
  ALT_GOVT_BUS_POC_NAME__c: string | null;
  ALT_GOVT_BUS_POC_TITLE__c: string | null;
  //
  attributes: { type: string; url: string };
};

type BapSamData =
  | { results: false; entities: [] }
  | { results: true; entities: BapSamEntity[] };

Formio.setBaseUrl(formioBaseUrl);
Formio.setProjectUrl(formioProjectUrl);
Formio.use(premium);
Formio.use(uswds);

/** Custom hook that returns cached fetched CSB data */
export function useCsbData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<CsbData>(["csb-data"]);
}

/** Custom hook that returns cached fetched BAP SAM.gov data */
export function useBapSamData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<BapSamData>(["bap-sam-data"]);
}

function IconText(props: {
  order: "icon-text" | "text-icon";
  icon: string;
  text: string;
}) {
  const { order, icon, text } = props;

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

export function UserDashboard(props: { email: string }) {
  const { email } = props;

  const { pathname } = useLocation();
  const navigate = useNavigate();

  useQuery({
    queryKey: ["csb-data"],
    queryFn: () => getData<CsbData>(`${serverUrl}/api/csb-data`),
    refetchOnWindowFocus: false,
  });

  useQuery({
    queryKey: ["bap-sam-data"],
    queryFn: () => getData<BapSamData>(`${serverUrl}/api/bap-sam-data`),
    onSuccess: (res) => {
      if (!res.results) {
        window.location.href = `${serverUrlForHrefs}/logout?RelayState=/welcome?info=bap-sam-results`;
      }
    },
    onError: (err) => {
      window.location.href = `${serverUrlForHrefs}/logout?RelayState=/welcome?error=bap-sam-fetch`;
    },
    refetchOnWindowFocus: false,
  });

  const csbData = useCsbData();
  const bapSamData = useBapSamData();

  const dialogDispatch = useDialogDispatch();
  const helpdeskAccess = useHelpdeskAccess();

  const onAllRebatesPage = pathname === "/";
  const onHelpdeskPage = pathname === "/helpdesk";
  const onApplicationFormPage = pathname.startsWith("/rebate");
  const onPaymentRequestFormPage = pathname.startsWith("/payment-request");

  const applicationFormOpen = csbData
    ? csbData.submissionPeriodOpen.application
    : false;

  /**
   * When provided a destination location to navigate to, creates an action
   * object that can be dispatched to the `DialogProvider` context component,
   * which the `ConfirmationDialog` component (rendered in the `App` component's
   * `ProtectedRoute` component) uses to display the provided info.
   */
  function createDialogNavAction(destination: string): Action {
    return {
      type: "DISPLAY_DIALOG",
      payload: {
        dismissable: true,
        heading: "Are you sure you want to navigate away from this page?",
        description: (
          <p>
            If you haven’t saved the current form, any changes you’ve made will
            be lost.
          </p>
        ),
        confirmText: "Yes",
        dismissText: "Cancel",
        confirmedAction: () => navigate(destination),
      },
    };
  }

  if (!csbData || !bapSamData) {
    return <Loading />;
  }

  return (
    <div>
      <h1 className="margin-bottom-2">Clean School Bus Rebate Forms</h1>

      <ul className="margin-bottom-4">
        <li>
          <a
            href="https://www.epa.gov/cleanschoolbus/school-bus-rebates-clean-school-bus-program"
            target="_blank"
            rel="noopener noreferrer"
          >
            Clean School Bus Rebate Program
          </a>
        </li>
        <li>
          <a
            href="https://www.epa.gov/cleanschoolbus/online-rebate-application-information-clean-school-bus-program"
            target="_blank"
            rel="noopener noreferrer"
          >
            Online Rebate Application Information
          </a>
        </li>
      </ul>

      <div className="desktop:display-flex flex-justify border-bottom">
        <nav className="desktop:order-last mobile-lg:display-flex flex-align-center flex-justify-end">
          <p className="margin-bottom-1 margin-right-1">
            <span>{email}</span>
          </p>

          <a
            className="margin-bottom-1 usa-button font-sans-2xs margin-right-0"
            href={`${serverUrlForHrefs}/logout`}
          >
            <IconText order="text-icon" icon="logout" text="Sign out" />
          </a>
        </nav>

        <nav>
          {onAllRebatesPage ? (
            <button
              className="margin-bottom-1 usa-button font-sans-2xs"
              disabled
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </button>
          ) : (
            <Link
              to="/"
              className="margin-bottom-1 usa-button font-sans-2xs"
              onClick={(ev) => {
                if (onApplicationFormPage || onPaymentRequestFormPage) {
                  ev.preventDefault();
                  const action = createDialogNavAction("/");
                  dialogDispatch(action);
                }
              }}
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </Link>
          )}

          {onApplicationFormPage ||
          onPaymentRequestFormPage ||
          !applicationFormOpen ? (
            <button
              className="margin-bottom-1 usa-button font-sans-2xs"
              disabled
            >
              <IconText
                order="icon-text"
                icon="add_circle"
                text="New Application"
              />
            </button>
          ) : (
            <Link
              to="/rebate/new"
              className="margin-bottom-1 usa-button font-sans-2xs"
            >
              <IconText
                order="icon-text"
                icon="add_circle"
                text="New Application"
              />
            </Link>
          )}

          {helpdeskAccess === "success" && (
            <>
              {onHelpdeskPage ? (
                <button
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  disabled
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </button>
              ) : (
                <Link
                  to="/helpdesk"
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  onClick={(ev) => {
                    if (onApplicationFormPage || onPaymentRequestFormPage) {
                      ev.preventDefault();
                      const action = createDialogNavAction("/helpdesk");
                      dialogDispatch(action);
                    }
                  }}
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </Link>
              )}
            </>
          )}
        </nav>
      </div>

      <Outlet context={{ email }} />
    </div>
  );
}
