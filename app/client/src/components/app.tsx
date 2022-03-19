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
import { cloudSubPath } from "../index";
import { useUserState } from "contexts/user";
import Login from "components/login";
import Dashboard from "components/dashboard";
import Forms from "routes/forms";
import Form from "routes/form";
import NotFound from "routes/notFound";

function ProtectedRoutes({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  const { isAuthenticated } = useUserState();

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" state={{ redirectedFrom: pathname }} replace />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter
      basename={process.env.NODE_ENV === "development" ? "/" : cloudSubPath}
    >
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
          <Route index element={<Forms />} />
          <Route path="rebate/:id" element={<Form />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
