import { createRoot } from "react-dom/client";
import reportWebVitals from "./reportWebVitals";
// ---
import { ContentProvider } from "contexts/content";
import { UserProvider } from "contexts/user";
import { FormsProvider } from "contexts/forms";
import { DialogProvider } from "contexts/dialog";
import ErrorBoundary from "components/errorBoundary";
import App from "components/app";
import "./styles.css";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <ErrorBoundary>
    <ContentProvider>
      <UserProvider>
        <FormsProvider>
          <DialogProvider>
            <App />
          </DialogProvider>
        </FormsProvider>
      </UserProvider>
    </ContentProvider>
  </ErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
