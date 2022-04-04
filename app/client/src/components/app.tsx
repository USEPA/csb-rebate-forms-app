import { useState, useEffect, useCallback } from "react";
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
import "choices.js/public/assets/styles/choices.min.css";
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
// ---
import { serverBasePath, serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import ConfirmationDialog from "components/confirmationDialog";
import Welcome from "components/welcome";
import Dashboard from "components/dashboard";
import AllRebateForms from "routes/allRebateForms";
import NewRebateForm from "routes/newRebateForm";
import ExistingRebateForm from "routes/existingRebateForm";
import NotFound from "routes/notFound";
import { useUserState, useUserDispatch } from "contexts/user";
import { Action, useDialogDispatch, useDialogState } from "contexts/dialog";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { epaUserData, isAuthenticating, isAuthenticated } = useUserState();
  const userDispatch = useUserDispatch();

  // Check if user is already logged in or needs to be redirected to /welcome route
  const checkUser = useCallback(() => {
    fetchData(`${serverUrl}/api/v1/epa-data`)
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

  useEffect(() => {
    userDispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });
    checkUser();
  }, [checkUser, userDispatch, pathname]);

  // Set up inactivity timer to auto-logout if user is inactive for >15 minutes
  const { dialogShown, heading } = useDialogState();
  const dialogDispatch = useDialogDispatch();

  function createLogoutWarningDialogAction(): Action {
    return {
      type: "DISPLAY_DIALOG",
      payload: {
        heading: "Inactivity warning",
        description: `You will be automatically logged out in ${logoutTimer} seconds due to inactivity.`,
        confirmText: "Stay logged in",
        forceConfirm: true,
        confirmedAction: () => {
          checkUser();
          reset();
        },
      },
    };
  }

  const warningTime = 60;
  const [logoutTimer, setLogoutTimer] = useState(warningTime);

  const handleOnIdle = () => {
    // Display 60-second countdown dialog after 14 minutes of idle time
    dialogDispatch(createLogoutWarningDialogAction());
  };

  const handleOnAction = () => {
    if (!dialogShown) {
      // Reset logout timer if user confirmed activity (so countdown starts over on next inactive warning)
      setLogoutTimer(warningTime);
    }

    /**
     *  If user makes action and the JWT is set to expire within 3 minutes,
     *  automatically call the /epa-data endpoint to refresh the JWT
     */
    if (epaUserData.status === "success") {
      const jwtRefreshWindow = 180; // in seconds
      const exp = epaUserData.data.exp;
      const timeToExpire = exp - Date.now() / 1000;

      if (timeToExpire < jwtRefreshWindow) {
        checkUser();
        reset();
      }
    }
  };

  /**
   *  Set timeout in ms
   *  Note: use one minute less than our intended timeout (14 instead of 15)
   *  so that the onIdle is called and displays a 60-second warning modal to keep user logged in
   */
  const timeout = 14 * 60 * 1000;

  const { reset } = useIdleTimer({
    timeout,
    onIdle: handleOnIdle,
    onAction: handleOnAction,
    debounce: 500,
    crossTab: { emitOnAllTabs: true },
  });

  useEffect(() => {
    if (dialogShown && heading === "Inactivity warning") {
      setTimeout(() => {
        setLogoutTimer((count: number) => (count > 0 ? count - 1 : count));
        dialogDispatch({
          type: "UPDATE_DESCRIPTION",
          payload: `You will be automatically logged out in ${
            logoutTimer - 1
          } seconds due to inactivity.`,
        });
      }, 1000);
    }
    // Log user out from server if inactivity countdown reaches 0
    if (logoutTimer === 0) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=timeout`;
    }
  }, [dialogDispatch, userDispatch, dialogShown, heading, logoutTimer]);

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
          <Route path="rebate/new" element={<NewRebateForm />} />
          <Route path="rebate/:id" element={<ExistingRebateForm />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
