import { StrictMode } from "react";
import { render } from "react-dom";
import reportWebVitals from "./reportWebVitals";
// ---
import { ApiProvider } from "contexts/api";
import { UserProvider } from "contexts/user";
import ErrorBoundary from "components/errorBoundary";
import App from "components/app";

const rootElement = document.getElementById("root");

render(
  <StrictMode>
    <ErrorBoundary>
      <ApiProvider>
        <UserProvider>
          <App />
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
