import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
// ---
import { serverBasePath } from "../index";
import { useApiState, fetchData } from "contexts/api";
import { useUserState, useUserDispatch } from "contexts/user";
import Loading from "components/loading";
import Login from "components/login";
import Dashboard from "components/dashboard";
import RebateForms from "routes/rebateForms";
import RebateForm from "routes/rebateForm";
import NotFound from "routes/notFound";

function ProtectedRoutes({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticated, isAuthenticating } = useUserState();
  const dispatch = useUserDispatch();
  const { apiUrl } = useApiState();

  // Check if user is already logged in or needs to be redirected to /login route
  useEffect(
    function () {
      fetchData(`${apiUrl}/api/v1/user`)
        .then((res) => {
          dispatch({ type: "USER_SIGN_IN" });
          dispatch({
            type: "FETCH_EPA_USER_DATA_SUCCESS",
            payload: { epaUserData: res.epaUserData },
          });
          dispatch({
            type: "FETCH_SAM_USER_DATA_SUCCESS",
            payload: { samUserData: res.samUserData },
          });
        })
        .catch(() => {
          // If API returns error/unauthorized, sign out user from client
          dispatch({ type: "USER_SIGN_OUT" });
        });
    },
    [apiUrl, dispatch]
  );

  if (isAuthenticating) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" state={{ redirectedFrom: pathname }} replace />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter basename={serverBasePath}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        >
          <Route index element={<RebateForms />} />
          <Route path="rebate/:id" element={<RebateForm />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
