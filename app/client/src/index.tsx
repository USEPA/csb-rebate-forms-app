import { StrictMode } from "react";
import { render } from "react-dom";
import reportWebVitals from "./reportWebVitals";
// ---
import { ContentProvider } from "contexts/content";
import { UserProvider } from "contexts/user";
import { CsbProvider } from "contexts/csb";
import { BapProvider } from "contexts/bap";
import { FormioProvider } from "contexts/formio";
import { DialogProvider } from "contexts/dialog";
import { ErrorBoundary } from "components/errorBoundary";
import { App } from "components/app";
import "./styles.css";

const container = document.getElementById("root") as HTMLElement;

render(
  <StrictMode>
    <ErrorBoundary>
      <ContentProvider>
        <UserProvider>
          <CsbProvider>
            <BapProvider>
              <FormioProvider>
                <DialogProvider>
                  <App />
                </DialogProvider>
              </FormioProvider>
            </BapProvider>
          </CsbProvider>
        </UserProvider>
      </ContentProvider>
    </ErrorBoundary>
  </StrictMode>,
  container
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
