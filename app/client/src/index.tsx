import { StrictMode } from "react";
import { render } from "react-dom";
// ---
import { ErrorBoundary } from "@/components/errorBoundary";
import { Providers } from "@/components/providers";
import { App } from "@/components/app";
import "@/tailwind-preflight.css";
import "@/styles.css";

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
