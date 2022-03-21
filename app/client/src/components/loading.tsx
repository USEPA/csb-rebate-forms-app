// NOTE: React JSX doesn't support namespaces, so `uswds/img/loader.svg` copied
// into app's `images/loader.svg` with namespace tags removed
import loader from "images/loader.svg";

export default function Loading() {
  return (
    <div className="margin-top-2 padding-1 text-center">
      <img src={loader} alt="" className="height-5 is-loading" />
    </div>
  );
}
