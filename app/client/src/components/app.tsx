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
import Welcome from "components/welcome";
import Dashboard from "components/dashboard";
import ConfirmationDialog from "components/confirmationDialog";
import AllRebateForms from "routes/allRebateForms";
import NewRebateForm from "routes/newRebateForm";
import ExistingRebateForm from "routes/existingRebateForm";
import NotFound from "routes/notFound";
import { useUserState, useUserDispatch } from "contexts/user";
import { useDialogDispatch, useDialogState } from "contexts/dialog";

// Set up inactivity timer to auto-logout if user is inactive for >15 minutes
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
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=timeout`;
    }
  }, [dialogShown, heading, logoutTimer, dispatch]);
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticating, isAuthenticated } = useUserState();
  const dispatch = useUserDispatch();

  // Check if user is already logged in or needs to be redirected to /welcome route
  const verifyUser = useCallback(() => {
    fetchData(`${serverUrl}/api/v1/epa-data`)
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
