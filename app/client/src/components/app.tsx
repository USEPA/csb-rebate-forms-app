import { useState, useEffect, useCallback } from "react";
import { render } from "react-dom";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useIdleTimer } from "react-idle-timer";
import "@reach/dialog/styles.css";
import "@reach/tooltip/styles.css";
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
import "bootstrap/dist/css/bootstrap-grid.min.css";
import "@formio/uswds/dist/uswds.min.css";
import "@formio/choices.js/public/assets/styles/choices.min.css";
import "@formio/premium/dist/premium.css";
import "formiojs/dist/formio.full.min.css";
// ---
import { serverBasePath, serverUrl, cloudSpace, getData } from "../config";
import { Loading } from "components/loading";
import { MarkdownContent } from "components/markdownContent";
import { Welcome } from "routes/welcome";
import { Dashboard } from "components/dashboard";
import { ConfirmationDialog } from "components/confirmationDialog";
import { CombinedRebates } from "components/combinedRebates";
import { Helpdesk } from "routes/helpdesk";
import { AllRebates } from "routes/allRebates";
import { NewApplicationForm } from "routes/newApplicationForm";
import { ApplicationForm } from "routes/applicationForm";
import { PaymentRequestForm } from "routes/paymentRequestForm";
import { useContentState, useContentDispatch } from "contexts/content";
import { useDialogDispatch, useDialogState } from "contexts/dialog";
import { useUserState, useUserDispatch } from "contexts/user";

type FetchStatus = "idle" | "pending" | "success" | "failure";

/** Custom hook to fetch static content */
function useFetchedContent() {
  const contentDispatch = useContentDispatch();

  useEffect(() => {
    contentDispatch({ type: "FETCH_CONTENT_REQUEST" });
    getData(`${serverUrl}/api/content`)
      .then((res) => {
        contentDispatch({
          type: "FETCH_CONTENT_SUCCESS",
          payload: res,
        });
      })
      .catch((err) => {
        contentDispatch({ type: "FETCH_CONTENT_FAILURE" });
      });
  }, [contentDispatch]);
}

/** Custom hook to display a site-wide alert banner */
function useSiteAlertBanner() {
  const { content } = useContentState();

  useEffect(() => {
    if (content.status !== "success") return;
    if (content.data?.siteAlert === "") return;

    const siteAlert = document.querySelector(".usa-site-alert");
    if (!siteAlert) return;

    siteAlert.setAttribute("aria-label", "Site alert");
    siteAlert.classList.add("usa-site-alert--emergency");

    render(
      <div className="usa-alert">
        <MarkdownContent
          className="usa-alert__body"
          children={content.data?.siteAlert || ""}
          components={{
            h1: (props) => (
              <h3 className="usa-alert__heading">{props.children}</h3>
            ),
            h2: (props) => (
              <h3 className="usa-alert__heading">{props.children}</h3>
            ),
            h3: (props) => (
              <h3 className="usa-alert__heading">{props.children}</h3>
            ),
            p: (props) => <p className="usa-alert__text">{props.children}</p>,
          }}
        />
      </div>,
      siteAlert
    );
  }, [content]);
}

/** Custom hook to display the CSB disclaimer banner for development/staging */
function useDisclaimerBanner() {
  useEffect(() => {
    if (!(cloudSpace === "dev" || cloudSpace === "staging")) return;

    const siteAlert = document.querySelector(".usa-site-alert");
    if (!siteAlert) return;

    const banner = document.createElement("div");
    banner.setAttribute("id", "csb-disclaimer-banner");
    banner.setAttribute(
      "class",
      "padding-1 text-center text-white bg-secondary-dark"
    );
    banner.innerHTML = `<strong>EPA development environment:</strong> The
      content on this page is not production data and this site is being used
      for <strong>development</strong> and/or <strong>testing</strong> purposes
      only.`;

    siteAlert.insertAdjacentElement("beforebegin", banner);
  }, []);
}

/** Custom hook to set up inactivity timer to auto-logout user if they're inactive for >15 minutes */
function useInactivityDialog(callback: () => void) {
  const { epaUserData } = useUserState();
  const { dialogShown, heading } = useDialogState();
  const dialogDispatch = useDialogDispatch();

  /** Initial time (seconds) used in the logout countdown timer */
  const initialCountdownSeconds = 60;

  const [logoutTimer, setLogoutTimer] = useState(initialCountdownSeconds);

  /**
   * One minute less than our intended 15 minute timeout, so `onIdle` is called
   * and displays a 60 second warning modal to keep user logged in.
   */
  const timeout = 14 * 60 * 1000; // 14 minutes in milliseconds

  const { reset } = useIdleTimer({
    timeout,
    onIdle: () => {
      // display 60 second countdown dialog after 14 minutes of idle time
      dialogDispatch({
        type: "DISPLAY_DIALOG",
        payload: {
          dismissable: false,
          heading: "Inactivity Warning",
          description: `You will be automatically logged out in ${logoutTimer} seconds due to inactivity.`,
          confirmText: "Stay logged in",
          confirmedAction: () => {
            callback();
            reset();
          },
        },
      });
    },
    onAction: () => {
      if (!dialogShown) {
        // keep logout timer at initial countdown time if the dialog isn't shown
        // (so logout timer is ready for the next inactive warning)
        setLogoutTimer(initialCountdownSeconds);
      }

      if (epaUserData.status !== "success") return;

      const { exp } = epaUserData.data; // seconds
      const timeToExpire = exp - Date.now() / 1000; // seconds
      const threeMinutes = 180; // seconds

      /**
       * If user makes action and the JWT is set to expire within 3 minutes,
       * call the callback (access "/epa-user-data") to refresh the JWT
       */
      if (timeToExpire < threeMinutes) {
        callback();
        reset();
      }
    },
    debounce: 500,
    crossTab: true,
  });

  useEffect(() => {
    // update inactivity warning dialog's time remaining every second
    if (dialogShown && heading === "Inactivity Warning") {
      setTimeout(() => {
        setLogoutTimer((time: number) => (time > 0 ? time - 1 : time));
        dialogDispatch({
          type: "UPDATE_DIALOG_DESCRIPTION",
          payload: {
            description:
              `You will be automatically logged out in ` +
              `${logoutTimer - 1} seconds due to inactivity.`,
          },
        });
      }, 1000);
    }

    // log user out from server if inactivity countdown reaches 0
    if (logoutTimer === 0) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=timeout`;
    }
  }, [dialogShown, heading, logoutTimer, dialogDispatch]);
}

/** Custom hook to check if user should have access to helpdesk pages */
export function useHelpdeskAccess() {
  const [helpdeskAccess, setHelpdeskAccess] = useState<FetchStatus>("idle");

  useEffect(() => {
    setHelpdeskAccess("pending");
    getData(`${serverUrl}/api/helpdesk-access`)
      .then((res) => setHelpdeskAccess("success"))
      .catch((err) => setHelpdeskAccess("failure"));
  }, []);

  return helpdeskAccess;
}

// Wrapper Component for any routes that need authenticated access
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticating, isAuthenticated } = useUserState();
  const userDispatch = useUserDispatch();

  // check if user is already logged in or needs to be logged out (which will
  // redirect them to the "/welcome" route)
  const verifyUser = useCallback(() => {
    getData(`${serverUrl}/api/epa-user-data`)
      .then((res) => {
        userDispatch({
          type: "FETCH_EPA_USER_DATA_SUCCESS",
          payload: { epaUserData: res },
        });
        userDispatch({ type: "USER_SIGN_IN" });
      })
      .catch((err) => {
        userDispatch({ type: "FETCH_EPA_USER_DATA_FAILURE" });
        userDispatch({ type: "USER_SIGN_OUT" });
      });
  }, [userDispatch]);

  // NOTE: even though `pathname` isn't used in the effect below, it's being
  // included it in the dependency array as we want to verify the user's access
  // any time a route changes
  useEffect(() => {
    userDispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });
    verifyUser();
  }, [userDispatch, verifyUser, pathname]);

  useInactivityDialog(verifyUser);

  if (isAuthenticating) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <>
      <ConfirmationDialog />
      {children}
    </>
  );
}

export function App() {
  useFetchedContent();
  useSiteAlertBanner();
  useDisclaimerBanner();

  return (
    <BrowserRouter basename={serverBasePath}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<AllRebates />} />
          {/*
            NOTE: The helpdesk route is only accessible to users who should have
            access to it. When a user tries to access the `Helpdesk` route, an
            API call to the server is made (`/helpdesk-access`). Verification
            happens on the server via the user's EPA WAA groups stored in the
            JWT, and server responds appropriately. If user is a member of the
            appropriate WAA groups, they'll have access to the route, otherwise
            they'll be redirected to the index route (`AllRebates`). This same
            API call happens inside the `Dashboard` component as well, to
            determine whether a button/link to the helpdesk route should be
            displayed.
          */}
          <Route path="helpdesk" element={<Helpdesk />} />
          <Route path="rebate/new" element={<NewApplicationForm />} />
          <Route
            path="rebate/:mongoId"
            element={
              <CombinedRebates>
                <ApplicationForm />
              </CombinedRebates>
            }
          />
          <Route
            path="payment-request/:rebateId"
            element={
              <CombinedRebates>
                <PaymentRequestForm />
              </CombinedRebates>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
