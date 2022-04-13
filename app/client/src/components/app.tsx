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
import "formiojs/dist/formio.full.min.css";
import "@formio/premium/dist/premium.css";
import "@formio/uswds/dist/uswds.min.css";
import "@formio/choices.js/public/assets/styles/choices.min.css";
// ---
import { serverBasePath, serverUrl, cloudSpace, fetchData } from "../config";
import Loading from "components/loading";
import MarkdownContent from "components/markdownContent";
import Welcome from "components/welcome";
import Dashboard from "components/dashboard";
import ConfirmationDialog from "components/confirmationDialog";
import Helpdesk from "routes/helpdesk";
import AllRebateForms from "routes/allRebateForms";
import NewRebateForm from "routes/newRebateForm";
import ExistingRebateForm from "routes/existingRebateForm";
import NotFound from "routes/notFound";
import { useContentState, useContentDispatch } from "contexts/content";
import { useUserState, useUserDispatch } from "contexts/user";
import { useDialogDispatch, useDialogState } from "contexts/dialog";

// Custom hook to fetch static content
function useFetchedContent() {
  const dispatch = useContentDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_CONTENT_REQUEST" });
    fetchData(`${serverUrl}/api/content`)
      .then((res) => {
        const {
          siteAlert,
          helpdeskIntro,
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
            siteAlert,
            helpdeskIntro,
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

// Custom hook to display a site-wide alert banner
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

// Custom hook to display the CSB disclaimer banner for development/staging
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

// Custom hook to set up inactivity timer to auto-logout user if they're inactive for >15 minutes
function useInactivityDialog(callback: () => void) {
  const { epaUserData } = useUserState();
  const { dialogShown, heading } = useDialogState();
  const dispatch = useDialogDispatch();

  /**
   * Initial time (in seconds) used in the warning countdown timer.
   */
  const warningTime = 60;
  const [logoutTimer, setLogoutTimer] = useState(warningTime);

  /**
   * One minute less than our intended timeout (14 instead of 15) so that onIdle
   * is called and displays a 60-second warning modal to keep user logged in.
   */
  const timeout = 14 * 60 * 1000; // 14 minutes to millisecond

  const { reset } = useIdleTimer({
    timeout,
    onIdle: () => {
      // Display 60-second countdown dialog after 14 minutes of idle time
      dispatch({
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
        // Reset logout timer if user confirmed activity
        // (so countdown starts over on next inactive warning)
        setLogoutTimer(warningTime);
      }

      /**
       * If user makes action and the JWT is set to expire within 3 minutes,
       * call the callback (hit the /epa-data endpoint) to refresh the JWT
       */
      if (epaUserData.status !== "success") return;

      const jwtRefreshWindow = 180; // in seconds
      const exp = epaUserData.data.exp;
      const timeToExpire = exp - Date.now() / 1000;

      if (timeToExpire < jwtRefreshWindow) {
        callback();
        reset();
      }
    },
    debounce: 500,
    crossTab: { emitOnAllTabs: true },
  });

  useEffect(() => {
    if (dialogShown && heading === "Inactivity Warning") {
      setTimeout(() => {
        setLogoutTimer((count: number) => (count > 0 ? count - 1 : count));
        dispatch({
          type: "UPDATE_DIALOG_DESCRIPTION",
          payload: {
            description: `You will be automatically logged out in ${
              logoutTimer - 1
            } seconds due to inactivity.`,
          },
        });
      }, 1000);
    }

    // Log user out from server if inactivity countdown reaches 0
    if (logoutTimer === 0) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=timeout`;
    }
  }, [dialogShown, heading, logoutTimer, dispatch]);
}

// Custom hook to check if user should have access to helpdesk pages
export function useHelpdeskAccess() {
  const [helpdeskAccess, setHelpdeskAccess] = useState<
    "idle" | "pending" | "success" | "failure"
  >("idle");

  useEffect(() => {
    setHelpdeskAccess("pending");
    fetchData(`${serverUrl}/api/helpdesk-access`)
      .then((res) => setHelpdeskAccess("success"))
      .catch((err) => setHelpdeskAccess("failure"));
  }, []);

  return helpdeskAccess;
}

// Wrapper Component for any routes that need authenticated access
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticating, isAuthenticated } = useUserState();
  const dispatch = useUserDispatch();

  // Check if user is already logged in or needs to be redirected to /welcome route
  const verifyUser = useCallback(() => {
    fetchData(`${serverUrl}/api/epa-data`)
      .then((res) => {
        dispatch({
          type: "FETCH_EPA_USER_DATA_SUCCESS",
          payload: { epaUserData: res },
        });
        dispatch({ type: "USER_SIGN_IN" });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_EPA_USER_DATA_FAILURE" });
        dispatch({ type: "USER_SIGN_OUT" });
      });
  }, [dispatch]);

  useEffect(() => {
    dispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });
    verifyUser();
  }, [verifyUser, dispatch, pathname]);

  useInactivityDialog(verifyUser);

  if (isAuthenticating) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/welcome" state={{ redirectedFrom: pathname }} replace />
    );
  }

  return (
    <>
      <ConfirmationDialog />
      {children}
    </>
  );
}

export default function App() {
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
          <Route index element={<AllRebateForms />} />
          {/*
            NOTE: The helpdesk route is only accessible to users who should have
            access to it. When a user tries to access the `Helpdesk` route, an
            API call to the server is made (`/helpdesk-access`). Verification
            happens on the server via the user's EPA WAA groups stored in the
            JWT, and server responds appropriately. If user is a member of the
            appropriate WAA groups, they'll have access to the route, otherwise
            they'll be redirected to the index route (`AllRebateForms`).
            This same API call happens inside the `Dashboard` component as well,
            to determine whether a button/link to the helpdesk route should be
            displayed.
          */}
          <Route path="helpdesk" element={<Helpdesk />} />
          <Route path="rebate/new" element={<NewRebateForm />} />
          <Route path="rebate/:id" element={<ExistingRebateForm />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
