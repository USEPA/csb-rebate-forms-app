import { StrictMode } from "react";
import { render } from "react-dom";
import reportWebVitals from "./reportWebVitals";
// ---
import { ApiProvider } from "contexts/api";
import { UserProvider } from "contexts/user";
import { FormsProvider } from "contexts/forms";
import ErrorBoundary from "components/errorBoundary";
import App from "components/app";

// deployed Cloud.gov app is currently configured to be served from "/csb"
// subdirectory so defining that as the fallback here, but this can be
// explicitly set by defining the REACT_APP_SUB_PATH environment variable
export const cloudSubPath = process.env.REACT_APP_SUB_PATH || "/csb";

const rootElement = document.getElementById("root");

render(
  <StrictMode>
    <ErrorBoundary>
      <ApiProvider>
        <UserProvider>
          <FormsProvider>
            <App />
          </FormsProvider>
        </UserProvider>
      </ApiProvider>
    </ErrorBoundary>
  </StrictMode>,
  rootElement
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
