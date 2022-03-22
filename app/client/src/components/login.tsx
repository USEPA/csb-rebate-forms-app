import icons from "uswds/img/sprite.svg";
// ---

export default function Login() {
  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <a
          className="usa-button font-sans-2xs"
          href={`${process.env.REACT_APP_SERVER_URL}/login`}
        >
          <span className="display-flex flex-align-center">
            <span className="margin-right-1">Sign in</span>
            <svg
              className="usa-icon"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#login`} />
            </svg>
          </span>
        </a>
      </div>
    </div>
  );
}
