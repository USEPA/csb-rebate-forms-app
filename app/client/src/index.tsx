import { Suspense, StrictMode, lazy, useState, useEffect } from "react";
import { render } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import reportWebVitals from "./reportWebVitals";
// ---
import { ErrorBoundary } from "components/errorBoundary";
import { App } from "components/app";
import { DialogProvider } from "contexts/dialog";
import { NotificationsProvider } from "contexts/notifications";
import { RebateYearProvider } from "contexts/rebateYear";
import "./tailwind-preflight.css";
import "./styles.css";

declare global {
  interface Window {
    csb: any;
  }
}

const container = document.getElementById("root") as HTMLElement;

const queryClient = new QueryClient();

const ReactQueryDevtoolsProduction = lazy(() =>
  import("@tanstack/react-query-devtools/build/lib/index.prod.js").then(
    (module) => ({ default: module.ReactQueryDevtools })
  )
);

function Index() {
  const [devtoolsDisplayed, setDevtoolsDisplayed] = useState(false);

  useEffect(() => {
    window.csb ??= {};
    window.csb.toggleDevtools = () => setDevtoolsDisplayed((value) => !value);
  });

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <DialogProvider>
            <NotificationsProvider>
              <RebateYearProvider>
                <App />
              </RebateYearProvider>
            </NotificationsProvider>
          </DialogProvider>
        </ErrorBoundary>

        {devtoolsDisplayed && (
          <Suspense fallback={null}>
            <ReactQueryDevtoolsProduction />
          </Suspense>
        )}
      </QueryClientProvider>
    </StrictMode>
  );
}

render(<Index />, container);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
