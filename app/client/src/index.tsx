import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// ---
import { ErrorBoundary } from "@/components/errorBoundary";
import { Providers } from "@/components/providers";
import { App } from "@/components/app";
import "@/styles.css";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

export default function Index() {
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

root.render(<Index />);
