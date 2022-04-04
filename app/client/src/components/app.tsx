import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "@reach/dialog/styles.css";
import "@reach/tooltip/styles.css";
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
import "formiojs/dist/formio.full.min.css";
import "@formio/uswds/dist/uswds.min.css";
import "@formio/choices.js/public/assets/styles/choices.min.css";
// ---
import { serverBasePath, serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Welcome from "components/welcome";
import Dashboard from "components/dashboard";
import AllRebateForms from "routes/allRebateForms";
import NewRebateForm from "routes/newRebateForm";
import ExistingRebateForm from "routes/existingRebateForm";
import NotFound from "routes/notFound";
import { useUserState, useUserDispatch } from "contexts/user";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticating, isAuthenticated } = useUserState();
  const dispatch = useUserDispatch();

  // check if user is already logged in or needs to be redirected to /welcome route
  useEffect(() => {
    dispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });
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
  }, [dispatch, pathname]);

  if (isAuthenticating) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/welcome" state={{ redirectedFrom: pathname }} replace />
    );
  }

  return children;
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
