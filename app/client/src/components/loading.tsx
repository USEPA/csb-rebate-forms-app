import clsx from "clsx";
// ---
// NOTE: React JSX doesn't support namespaces, so `uswds/img/loader.svg` copied
// into app's `images/loader.svg` with namespace tags removed
import loader from "@/images/loader.svg";
import loaderWhite from "@/images/loader-white.svg";

export function Loading() {
  return (
    <div className="margin-top-2 padding-1 text-center">
      <span className="usa-sr-only">Loading...</span>
      <img src={loader} alt="" className="height-5 is-loading" />
    </div>
  );
}

export function LoadingButtonIcon(props: { position: "start" | "end" }) {
  const { position } = props;
  return (
    <img
      src={loaderWhite}
      alt="Loading..."
      className={clsx(
        "height-2 is-loading margin-y-neg-05",
        position === "start" ? "margin-right-105" : "margin-left-105",
      )}
    />
  );
}
