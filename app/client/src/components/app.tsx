import { useState, useEffect } from "react";
import { render } from "react-dom";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
  useLocation,
} from "react-router-dom";
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
import { serverBasePath, serverUrlForHrefs, cloudSpace } from "../config";
import {
  useContentQuery,
  useContentData,
  useUserQuery,
  useUserData,
} from "../utilities";
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
  const { dialogShown, heading } = useDialogState();
  const { displayDialog, updateDialogDescription } = useDialogActions();
  const user = useUserData();

  /** NOTE: 1 minute initial time used in the logout countdown timer */
  const [countdownSeconds, setCountdownSeconds] = useState(60);

  const { reset } = useIdleTimer({
    /**
     * NOTE: setting timeout to be one minute less than the JWT's configured 15
     * minute timeout (set via the `expiresIn` option in the server app's
     * createJWT() middleware function), so `onIdle` is called and displays a
     * 1 minute countdown in a warning modal prompting user action to remain
     * logged in.
     */
    timeout: 14 * 60 * 1000,
    onIdle: () => {
      /* display a 1 minute countdown dialog after 14 minutes of idle time. */
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
         * keep the logout timer at 1 minute if the countdown dialog isn't
         * shown, so the logout timer is ready for the next inactivity warning.
         */
        setCountdownSeconds(60);
      }

      if (!user) return;

      const jwtTimeToExpireInSeconds = user.exp - Date.now() / 1000;
      const threeMinutesInSeconds = 3 * 60;

      /**
       * if the user causes action and the JWT is set to expire within 3 minutes,
       * call the callback (access /api/user) to refresh the JWT behind the scenes
       */
      if (jwtTimeToExpireInSeconds < threeMinutesInSeconds) {
        callback();
        reset();
      }
    },
    debounce: 500,
    crossTab: true,
  });

  useEffect(() => {
    /** log the user out if the inactivity countdown reaches zero. */
    if (countdownSeconds <= 0) {
      window.location.href = `${serverUrlForHrefs}/logout?RelayState=/welcome?info=timeout`;
    }

    /** update the inactivity warning's countdown time remaining every second. */
    if (dialogShown && heading === "Inactivity Warning") {
      const timeoutID = setTimeout(() => {
        setCountdownSeconds((seconds) => (seconds > 0 ? seconds - 1 : seconds));
        updateDialogDescription(
          <p>
            You will be automatically logged out in{" "}
            {countdownSeconds > 0 ? countdownSeconds - 1 : countdownSeconds}{" "}
            seconds due to inactivity.
          </p>
        );
      }, 1000);

      return () => clearTimeout(timeoutID);
    }
  }, [dialogShown, heading, countdownSeconds, updateDialogDescription]);
}

/** Custom hook to check if user should have access to the helpdesk page */
export function useHelpdeskAccess() {
  const user = useUserData();
  const userRoles = user?.memberof.split(",") || [];

  return !user
    ? "pending"
    : userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk")
    ? "success"
    : "failure";
}

function ProtectedRoute() {
  const { pathname } = useLocation();

  const { isLoading, isError, data, refetch } = useUserQuery();

  // NOTE: even though `pathname` isn't used in the effect below, it's being
  // included it in the dependency array as we want to verify the user's access
  // any time a route changes
  useEffect(() => {
    refetch();
  }, [refetch, pathname]);

  useInactivityDialog(refetch);

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <TooltipProvider>
      <ConfirmationDialog />
      <Notifications />
      <UserDashboard email={data?.mail || ""} />
    </TooltipProvider>
  );
}

export function App() {
  useContentQuery();
  useSiteAlertBanner();
  useDisclaimerBanner();

  const routes = createRoutesFromElements([
    <Route path="/welcome" element={<Welcome />} />,
    <Route path="/" element={<ProtectedRoute />}>
      <Route index element={<AllRebates />} />
      <Route path="helpdesk" element={<Helpdesk />} />
      <Route path="rebate/new" element={<NewApplicationForm />} />
      <Route path="rebate/:id" element={<ApplicationForm />} />
      <Route path="payment-request/:id" element={<PaymentRequestForm />} />
      <Route path="close-out/:id" element={<CloseOutForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>,
  ]);

  const router = createBrowserRouter(routes, { basename: serverBasePath });

  return <RouterProvider router={router} />;
}
