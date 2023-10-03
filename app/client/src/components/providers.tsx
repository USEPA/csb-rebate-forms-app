import type { ReactNode } from "react";
import { Suspense, lazy, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// ---
import { DialogProvider } from "@/contexts/dialog";
import { NotificationsProvider } from "@/contexts/notifications";
import { RebateYearProvider } from "@/contexts/rebateYear";

declare global {
  interface Window {
    csb: any;
  }
}

const ReactQueryDevtoolsProduction = lazy(() =>
  import("@tanstack/react-query-devtools/build/lib/index.prod.js").then(
    (module) => ({ default: module.ReactQueryDevtools }),
  ),
);

export function Providers(props: { children: ReactNode }) {
  const { children } = props;

  const [queryClient] = useState(() => new QueryClient());
  const [devtoolsDisplayed, setDevtoolsDisplayed] = useState(false);

  useEffect(() => {
    window.csb ??= {};
    window.csb.toggleDevtools = () => setDevtoolsDisplayed((value) => !value);
  });

  return (
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <NotificationsProvider>
          <RebateYearProvider>{children}</RebateYearProvider>
        </NotificationsProvider>
      </DialogProvider>

      {devtoolsDisplayed && (
        <Suspense fallback={null}>
          <ReactQueryDevtoolsProduction />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
