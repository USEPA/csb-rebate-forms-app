import { StrictMode } from "react";
import { render } from "react-dom";
import reportWebVitals from "./reportWebVitals";
// ---
import { ErrorBoundary } from "components/errorBoundary";
import { Providers } from "components/providers";
import { App } from "components/app";
import "./tailwind-preflight.css";
import "./styles.css";

declare global {
  interface Window {
    csb: any;
  }
}

const container = document.getElementById("root") as HTMLElement;

function Index() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <Providers>
          <App />
        </Providers>
      </ErrorBoundary>
    </StrictMode>
  );
}

render(<Index />, container);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
