import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Formio } from "@formio/react";
import premium from "@formio/premium";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrlForHrefs, formioBaseUrl, formioProjectUrl } from "../config";
import { useCsbQuery, useBapSamQuery, useBapSamData } from "../utilities";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { useDialogActions } from "contexts/dialog";

Formio.setBaseUrl(formioBaseUrl);
Formio.setProjectUrl(formioProjectUrl);
Formio.use(premium);
Formio.use(uswds);

function IconText(props: {
  order: "icon-text" | "text-icon";
  icon: string;
  text: string;
}) {
  const { order, icon, text } = props;

  const alignment = order === "icon-text" ? "left" : "right";

  const Icon = (
    <svg
      key="icon"
      className="usa-icon"
      aria-hidden="true"
      focusable="false"
      role="img"
    >
      <use href={`${icons}#${icon}`} />
    </svg>
  );

  const Text = (
    <span key="text" className={`margin-${alignment}-1 text-${alignment}`}>
      {text}
    </span>
  );

  return (
    <span className="display-flex flex-align-center">
      {order === "icon-text" ? [Icon, Text] : [Text, Icon]}
    </span>
  );
}

export function UserDashboard(props: { email: string }) {
  const { email } = props;

  const { pathname } = useLocation();
  const navigate = useNavigate();

  useCsbQuery();
  useBapSamQuery();

  const bapSamData = useBapSamData();

  const { displayDialog } = useDialogActions();
  const helpdeskAccess = useHelpdeskAccess();

  const onAllRebatesPage = pathname === "/";
  const onHelpdeskPage = pathname === "/helpdesk";

  const onApplicationFormPage = pathname.startsWith("/rebate");
  const onPaymentRequestFormPage = pathname.startsWith("/payment-request");
  const onCloseOutFormPage = pathname.startsWith("/close-out");

  const onFormPage =
    onApplicationFormPage || onPaymentRequestFormPage || onCloseOutFormPage;

  const btnClassNames =
    "usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs";

  function confirmationNavigation(destination: string) {
    displayDialog({
      dismissable: true,
      heading: "Are you sure you want to navigate away from this page?",
      description: (
        <p>
          If you haven’t saved the current form, any changes you’ve made will be
          lost.
        </p>
      ),
      confirmText: "Yes",
      dismissText: "Cancel",
      confirmedAction: () => navigate(destination),
    });
  }

  if (!bapSamData) {
    return <Loading />;
  }

  return (
    <div>
      <h1 className="margin-bottom-2">Clean School Bus Rebate Forms</h1>

      <ul className="margin-bottom-4">
        <li>
          <a
            href="https://www.epa.gov/cleanschoolbus/school-bus-rebates-clean-school-bus-program"
            target="_blank"
            rel="noopener noreferrer"
          >
            Clean School Bus Rebate Program
          </a>
        </li>
        <li>
          <a
            href="https://www.epa.gov/cleanschoolbus/online-rebate-application-information-clean-school-bus-program"
            target="_blank"
            rel="noopener noreferrer"
          >
            Online Rebate Application Information
          </a>
        </li>
      </ul>

      {/*
      <div className="border-bottom desktop:display-flex">
        <div className="margin-bottom-1 desktop:margin-right-1">
          <label htmlFor="rebate-year" className="margin-right-1 font-sans-2xs">
            Rebate Year:
          </label>
          <select
            id="rebate-year"
            name="rebate-year"
            className="tw-rounded-md tw-border-0 tw-text-sm tw-font-bold tw-leading-4 tw-ring-1 tw-ring-inset tw-ring-gray-300"
          >
            <option>2022</option>
            <option>2023</option>
          </select>
        </div>

        <div className="flex-align-center tablet:display-flex">
          <div className="margin-bottom-1 tablet:margin-right-1">
            <a
              className="usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs"
              href="/"
            >
              <span className="display-flex flex-align-center">
                <svg
                  className="usa-icon"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#list`} />
                </svg>
                <span className="margin-left-1 text-left">
                  Your Rebate Forms
                </span>
              </span>
            </a>
          </div>

          <div className="margin-bottom-1 tablet:margin-right-1">
            <a
              className="usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs"
              href="/helpdesk"
            >
              <span className="display-flex flex-align-center">
                <svg
                  className="usa-icon"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#add_circle`} />
                </svg>
                <span className="margin-left-1 text-left">New Application</span>
              </span>
            </a>
          </div>

          <div className="margin-bottom-1 tablet:margin-right-1">
            <a
              className="usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs"
              href="/helpdesk"
            >
              <span className="display-flex flex-align-center">
                <svg
                  className="usa-icon"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#people`} />
                </svg>
                <span className="margin-left-1 text-left">Helpdesk</span>
              </span>
            </a>
          </div>
        </div>

        <div className="flex-align-center flex-1 tablet:display-flex desktop:flex-justify-end">
          <div className="margin-bottom-1">
            <span className="font-sans-xs">{email}</span>
          </div>

          <div className="margin-bottom-1 tablet:margin-left-1">
            <a
              className="usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs"
              href={`${serverUrlForHrefs}/logout`}
            >
              <span className="display-flex flex-align-center">
                <span className="margin-right-1">Sign out</span>
                <svg
                  className="usa-icon"
                  aria-hidden="true"
                  focusable="false"
                  role="img"
                >
                  <use href={`${icons}#logout`} />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </div>
      */}

      <div className="flex-justify border-bottom tablet:display-flex ">
        <nav className="flex-align-center mobile-lg:display-flex">
          <div className="margin-bottom-1 mobile-lg:margin-right-1">
            {onAllRebatesPage ? (
              <button className={btnClassNames} disabled>
                <IconText order="icon-text" icon="list" text="Dashboard" />
              </button>
            ) : (
              <Link
                to="/"
                className={btnClassNames}
                onClick={(ev) => {
                  if (onFormPage) {
                    ev.preventDefault();
                    confirmationNavigation("/");
                  }
                }}
              >
                <IconText order="icon-text" icon="list" text="Dashboard" />
              </Link>
            )}
          </div>

          {helpdeskAccess === "success" && (
            <div className="margin-bottom-1 mobile-lg:margin-right-1">
              {onHelpdeskPage ? (
                <button className={btnClassNames} disabled>
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </button>
              ) : (
                <Link
                  to="/helpdesk"
                  className={btnClassNames}
                  onClick={(ev) => {
                    if (onFormPage) {
                      ev.preventDefault();
                      confirmationNavigation("/helpdesk");
                    }
                  }}
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </Link>
              )}
            </div>
          )}
        </nav>

        <nav className="flex-align-center mobile-lg:display-flex tablet:flex-justify-end">
          <div className="margin-bottom-1">
            <span className="font-sans-xs">{email}</span>
          </div>

          <div className="margin-bottom-1 mobile-lg:margin-left-1">
            <a className={btnClassNames} href={`${serverUrlForHrefs}/logout`}>
              <IconText order="text-icon" icon="logout" text="Sign out" />
            </a>
          </div>
        </nav>
      </div>

      <Outlet context={{ email }} />
    </div>
  );
}
