import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  const { isAuthenticated } = useUserState();

  if (!isAuthenticated) return <Login />;

  return (
    <BrowserRouter
      basename={process.env.NODE_ENV === "development" ? "/" : cloudSubPath}
    >
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<Forms />} />
          <Route path="rebate/:id" element={<Form />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
