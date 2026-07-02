import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  createRoutesFromElements,
  redirect,
  Navigate,
  Route,
  useLocation,
} from "react-router";
import { RouterProvider } from "react-router/dom";
import { useIdleTimer } from "react-idle-timer";
import { TooltipProvider } from "@radix-ui/react-tooltip";
// ---
import { serverBasePath, serverUrl, cloudSpace, messages } from "@/config";
import {
  usePublicConfigQuery,
  usePublicConfigData,
  usePrivateConfigData,
  useUserQuery,
  useUserData,
} from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";
import { Welcome } from "@/routes/welcome";
import { UserLayout } from "@/components/userLayout";
import { ConfirmationDialog } from "@/components/confirmationDialog";
import { Notifications } from "@/components/notifications";
import { Helpdesk } from "@/routes/helpdesk";
import { Dashboard } from "@/routes/dashboard";
import { FRFNew } from "@/routes/frfNew";
import { Change2022 } from "@/routes/change2022";
import { FRF2022 } from "@/routes/frf2022";
import { PRF2022 } from "@/routes/prf2022";
import { CRF2022 } from "@/routes/crf2022";
import { Change2023 } from "@/routes/change2023";
import { FRF2023 } from "@/routes/frf2023";
import { PRF2023 } from "@/routes/prf2023";
import { CRF2023 } from "@/routes/crf2023";
import { Change2024 } from "@/routes/change2024";
import { FRF2024 } from "@/routes/frf2024";
// import { PRF2024 } from "@/routes/prf2024";
// import { CRF2024 } from "@/routes/crf2024";
import { useDialogState, useDialogActions } from "@/contexts/dialog";

/** Custom hook to display a site-wide alert banner */
function useSiteAlertBanner() {
  const publicConfigData = usePublicConfigData();
  const { staticContent } = publicConfigData || {};

  useEffect(() => {
    if (!staticContent || staticContent.siteAlert === "") return;

    const container = document.querySelector(".usa-site-alert");
    if (!container) return;

    container.setAttribute("aria-label", "Site alert");
    container.classList.add("usa-site-alert--emergency");

    const root = createRoot(container);

    root.render(
      <div className="usa-alert">
        <div className="usa-alert__body">
          <div className="usa-alert__content">
            <div className="usa-alert__text">
              <MarkdownContent
                children={staticContent.siteAlert}
                components={{
                  h1: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
                  h2: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
                  h3: (props) => <h3 className="usa-alert__heading">{props.children}</h3>, // prettier-ignore
                }}
              />
            </div>
          </div>
        </div>
      </div>,
    );
  }, [staticContent]);
}

/** Custom hook to display the CSB disclaimer banner for development/staging */
function useDisclaimerBanner() {
  useEffect(() => {
    if (!(cloudSpace === "dev" || cloudSpace === "staging")) return;

    const siteAlert = document.querySelector(".usa-site-alert");
    if (!siteAlert) return;

    /**
     * Ensure the disclaimer banner is only added once to the DOM (fixes double
     * render issue in development since React StrictMode is enabled)
     */
    const existingBanner = document.querySelector("#csb-disclaimer-banner");
    if (existingBanner) return;

    const banner = document.createElement("div");
    banner.setAttribute("id", "csb-disclaimer-banner");
    banner.setAttribute(
      "class",
      "padding-1 text-center text-white bg-secondary-dark",
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
  const privateConfigData = usePrivateConfigData();

  const sixtySeconds = 60;

  const jwtExpirationSeconds = privateConfigData
    ? privateConfigData.jwtExpirationSeconds
    : 15 * sixtySeconds; // fallback to 15 minutes if private config data isn't available

  /** NOTE: One minute initial time used in the logout countdown timer */
  const [countdownSeconds, setCountdownSeconds] = useState(sixtySeconds);

  const { reset } = useIdleTimer({
    /**
     * NOTE: Setting timeout to be two minutes less than the JWT's configured
     * expiration time (set via the `expiresIn` option in the server app's
     * createJWT() middleware function), so `onIdle` is called and displays a
     * one minute countdown in a warning modal prompting user action to remain
     * logged in.
     *
     * When the countdown expires, the user will be logged out.
     *
     * The extra one minute of buffer time is to account for any potential
     * delays bettween the client app's action to refresh the JWT (via the
     * callback function that calls `/api/user`) and the server app's response
     * that updates the JWT's expiration time on the server.
     */
    timeout: (jwtExpirationSeconds - 2 * sixtySeconds) * 1000,
    onIdle: () => {
      /**
       * NOTE: Display a one minute inactivity warning countdown dialog after
       * the idle time reaches the configured timeout.
       */
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
          setCountdownSeconds(sixtySeconds);
          callback();
          reset();
        },
      });
    },
    onAction: () => {
      const inactivityWarningShown =
        dialogShown && heading === "Inactivity Warning";

      if (inactivityWarningShown) {
        return;
      }

      if (!user) return;

      const jwtTimeToExpireInSeconds = user.exp - Date.now() / 1000;

      /**
       * NOTE: If the JWT is set to expire within three minutes, call the
       * callback function (which calls `/api/user`) to refresh the JWT's
       * expiration time on the server.
       */
      if (jwtTimeToExpireInSeconds < 3 * sixtySeconds) {
        setCountdownSeconds(sixtySeconds);
        callback();
        reset();
      }
    },
    debounce: 500,
    crossTab: true,
  });

  useEffect(() => {
    const inactivityWarningShown =
      dialogShown && heading === "Inactivity Warning";

    /** NOTE: Log the user out if the inactivity countdown time reaches zero. */
    if (countdownSeconds <= 0) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=timeout`;
    }

    /**
     * NOTE: Update the inactivity warning's countdown time remaining every
     * second.
     */
    if (inactivityWarningShown) {
      const timeoutID = setTimeout(() => {
        setCountdownSeconds((seconds) => (seconds > 0 ? seconds - 1 : seconds));

        const remainingSeconds =
          countdownSeconds > 0 ? countdownSeconds - 1 : countdownSeconds;

        updateDialogDescription(
          <p>
            You will be automatically logged out in {remainingSeconds} seconds
            due to inactivity.
          </p>,
        );
      }, 1000);

      return () => clearTimeout(timeoutID);
    }
  }, [dialogShown, heading, countdownSeconds, updateDialogDescription]);
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

  if (!data || !data.mail) {
    return null;
  }

  return (
    <TooltipProvider>
      <ConfirmationDialog />
      <Notifications />
      <UserLayout email={data.mail} />
    </TooltipProvider>
  );
}

export function App() {
  usePublicConfigQuery();
  useSiteAlertBanner();
  useDisclaimerBanner();

  const routes = createRoutesFromElements(
    <Route errorElement={<Message type="error" text={messages.genericError} />}>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route index element={<Dashboard />} />

        <Route path="helpdesk" element={<Helpdesk />} />

        {/* Redirect pre-v4 routes to use post-v4 routes */}
        <Route path="rebate/new" loader={(_args) => redirect(`/frf/new`)} />
        <Route
          path="rebate/:id"
          loader={({ params }) => redirect(`/frf/2022/${params.id}`)}
        />
        <Route
          path="payment-request/:id"
          loader={({ params }) => redirect(`/prf/2022/${params.id}`)}
        />
        <Route
          path="close-out/:id"
          loader={({ params }) => redirect(`/crf/2022/${params.id}`)}
        />

        <Route path="frf/new" element={<FRFNew />} />

        <Route path="change/2022/:id" element={<Change2022 />} />
        <Route path="frf/2022/:id" element={<FRF2022 />} />
        <Route path="prf/2022/:id" element={<PRF2022 />} />
        <Route path="crf/2022/:id" element={<CRF2022 />} />

        <Route path="change/2023/:id" element={<Change2023 />} />
        <Route path="frf/2023/:id" element={<FRF2023 />} />
        <Route path="prf/2023/:id" element={<PRF2023 />} />
        <Route path="crf/2023/:id" element={<CRF2023 />} />

        <Route path="change/2024/:id" element={<Change2024 />} />
        <Route path="frf/2024/:id" element={<FRF2024 />} />
        {/* <Route path="prf/2024/:id" element={<PRF2024 />} /> */}
        {/* <Route path="crf/2024/:id" element={<CRF2024 />} /> */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>,
  );

  const router = createBrowserRouter(routes, { basename: serverBasePath });

  return <RouterProvider router={router} />;
}
