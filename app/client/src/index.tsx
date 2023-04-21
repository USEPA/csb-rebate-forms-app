import { StrictMode } from "react";
import { render } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import reportWebVitals from "./reportWebVitals";
// ---
import { ErrorBoundary } from "components/errorBoundary";
import { App } from "components/app";
import { DialogProvider } from "contexts/dialog";
import { NotificationsProvider } from "contexts/notifications";
import { UserProvider } from "contexts/user";
import "./tailwind-preflight.css";
import "./styles.css";

const queryClient = new QueryClient();
const container = document.getElementById("root") as HTMLElement;

render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <DialogProvider>
          <NotificationsProvider>
            <UserProvider>
              <App />
            </UserProvider>
          </NotificationsProvider>
        </DialogProvider>
      </ErrorBoundary>

      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>,
  container
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
