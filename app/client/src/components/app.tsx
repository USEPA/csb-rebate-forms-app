import { useState, useEffect, useCallback } from "react";
import { render } from "react-dom";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useIdleTimer } from "react-idle-timer";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
import "bootstrap/dist/css/bootstrap-grid.min.css";
import "@formio/uswds/dist/uswds.min.css";
import "@formio/choices.js/public/assets/styles/choices.min.css";
import "@formio/premium/dist/premium.css";
import "formiojs/dist/formio.full.min.css";
// ---
import { serverBasePath, serverUrl, cloudSpace } from "../config";
import { getData } from "../utilities";
import { Loading } from "components/loading";
import { MarkdownContent } from "components/markdownContent";
import { Welcome } from "routes/welcome";
import { UserDashboard } from "components/userDashboard";
import { ConfirmationDialog } from "components/confirmationDialog";
import { Notifications } from "components/notifications";
import { Helpdesk } from "routes/helpdesk";
import { AllRebates } from "routes/allRebates";
import { NewApplicationForm } from "routes/newApplicationForm";
import { ApplicationForm } from "routes/applicationForm";
import { PaymentRequestForm } from "routes/paymentRequestForm";
import { CloseOutForm } from "routes/closeOutForm";
import { useDialogState, useDialogActions } from "contexts/dialog";
import { EpaUserData, useUserState, useUserDispatch } from "contexts/user";

type Content = {
  siteAlert: string;
  helpdeskIntro: string;
  allRebatesIntro: string;
  allRebatesOutro: string;
  newApplicationDialog: string;
  draftApplicationIntro: string;
  submittedApplicationIntro: string;
  draftPaymentRequestIntro: string;
  submittedPaymentRequestIntro: string;
};

/** Custom hook that returns cached fetched content data */
export function useContentData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Content>(["content"]);
}

/** Custom hook to display a site-wide alert banner */
function useSiteAlertBanner() {
  const content = useContentData();

  useEffect(() => {
    if (!content || content.siteAlert === "") return;

    const container = document.querySelector(".usa-site-alert");
    if (!container) return;

    container.setAttribute("aria-label", "Site alert");
    container.classList.add("usa-site-alert--emergency");

    render(
      <div className="usa-alert">
        <MarkdownContent
          className="usa-alert__body"
          children={content.siteAlert}
          components={{
            h1: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
            h2: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
            h3: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
            p: (props) => <p className="usa-alert__text">{props.children}</p>,
          }}
        />
      </div>,
      container
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
  const { displayDialog, updateDialogDescription } = useDialogActions();

  /** Initial time (seconds) used in the logout countdown timer */
  const oneMinute = 60;

  const [countdownSeconds, setCountdownSeconds] = useState(oneMinute);

  /**
   * One minute less than our intended 15 minute timeout, so `onIdle` is called
   * and displays a 60 second warning modal to keep user logged in.
   */
  const timeout = 14 * 60 * 1000; // 14 minutes in milliseconds

  const { reset } = useIdleTimer({
    timeout,
    onIdle: () => {
      // display 60 second countdown dialog after 14 minutes of idle time
      displayDialog({
        dismissable: false,
        heading: "Inactivity Warning",
        description: (
          <p>
            You will be automatically logged out in {countdownSeconds} seconds
            due to inactivity.
          </p>
        ),
        confirmText: "Stay logged in",
        confirmedAction: () => {
          callback();
          reset();
        },
      });
    },
    onAction: () => {
      if (!dialogShown) {
        /**
         * keep logout timer at initial countdown time (60 seconds) if the
         * dialog isn't shown, so logout timer is ready for the next inactivity
         * warning
         */
        setCountdownSeconds(oneMinute);
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
    /** update inactivity warning dialog's time remaining every second */
    if (dialogShown && heading === "Inactivity Warning") {
      const timeoutID = setTimeout(() => {
        setCountdownSeconds((seconds) => (seconds > 0 ? seconds - 1 : seconds));
        updateDialogDescription(
          <p>
            You will be automatically logged out in {countdownSeconds - 1}{" "}
            seconds due to inactivity.
          </p>
        );
      }, 1000);
      return () => clearTimeout(timeoutID);
    }

    /** log user out from server if inactivity countdown reaches 0 */
    if (countdownSeconds === 0) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=timeout`;
    }
  }, [dialogShown, heading, countdownSeconds, updateDialogDescription]);
}

/** Custom hook to check if user should have access to the helpdesk page */
export function useHelpdeskAccess() {
  const { epaUserData } = useUserState();

  const [helpdeskAccess, setHelpdeskAccess] =
    useState<(typeof epaUserData)["status"]>("idle");

  useEffect(() => {
    if (epaUserData.status === "pending") {
      setHelpdeskAccess("pending");
    }

    if (epaUserData.status === "success") {
      const userRoles = epaUserData.data.memberof.split(",");

      setHelpdeskAccess(
        userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk")
          ? "success"
          : "failure"
      );
    }
  }, [epaUserData]);

  return helpdeskAccess;
}

function ProtectedRoute() {
  const { pathname } = useLocation();
  const { isAuthenticating, isAuthenticated, epaUserData } = useUserState();
  const userDispatch = useUserDispatch();

  const email = epaUserData.status !== "success" ? "" : epaUserData.data.mail;

  /**
   * check if user is already logged in or needs to be logged out (which will
   * redirect them to the "/welcome" route)
   */
  const verifyUser = useCallback(() => {
    getData<EpaUserData>(`${serverUrl}/api/epa-user-data`)
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
    <TooltipProvider>
      <ConfirmationDialog />
      <Notifications />
      <UserDashboard email={email} />
    </TooltipProvider>
  );
}

export function App() {
  useQuery({
    queryKey: ["content"],
    queryFn: () => getData<Content>(`${serverUrl}/api/content`),
    refetchOnWindowFocus: false,
  });

  useSiteAlertBanner();
  useDisclaimerBanner();

  return (
    <BrowserRouter basename={serverBasePath}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<AllRebates />} />
          <Route path="helpdesk" element={<Helpdesk />} />
          <Route path="rebate/new" element={<NewApplicationForm />} />
          <Route path="rebate/:id" element={<ApplicationForm />} />
          <Route path="payment-request/:id" element={<PaymentRequestForm />} />
          <Route path="close-out/:id" element={<CloseOutForm />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
