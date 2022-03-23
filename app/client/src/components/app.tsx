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
import Loading from "components/loading";
import Login from "components/login";
import Dashboard from "components/dashboard";
import RebateForms from "routes/rebateForms";
import RebateForm from "routes/rebateForm";
import NotFound from "routes/notFound";
import { useApiState, fetchData } from "contexts/api";
import { useUserState, useUserDispatch } from "contexts/user";

function ProtectedRoutes({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { apiUrl } = useApiState();
  const { isAuthenticating, isAuthenticated } = useUserState();
  const dispatch = useUserDispatch();

  // TODO: should we hit "/api/v1/user" every route change after the user's logged in?

  // check if user is already logged in or needs to be redirected to /login route
  useEffect(() => {
    dispatch({ type: "FETCH_USER_DATA_REQUEST" });
    fetchData(`${apiUrl}/api/v1/user`)
      .then((res) => {
        const { epaUserData, samUserData } = res;
        dispatch({ type: "USER_SIGN_IN" });
        dispatch({
          type: "FETCH_USER_DATA_SUCCESS",
          payload: { epaUserData, samUserData },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_USER_DATA_FAILURE" });
        dispatch({ type: "USER_SIGN_OUT" });
      });
  }, [apiUrl, dispatch]);

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
