import { StrictMode } from "react";
import { render } from "react-dom";
import reportWebVitals from "./reportWebVitals";
// ---
import { ApiProvider } from "contexts/api";
import { UserProvider } from "contexts/user";
import { FormsProvider } from "contexts/forms";
import ErrorBoundary from "components/errorBoundary";
import App from "components/app";

const { NODE_ENV, REACT_APP_SUB_PATH } = process.env;

export const serverUrl =
  NODE_ENV === "development" ? "http://localhost:3001" : window.location.origin;

export const serverBasePath =
  NODE_ENV === "development" ? "" : REACT_APP_SUB_PATH || "/csb";

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
