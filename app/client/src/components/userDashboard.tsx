import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Formio } from "@formio/react";
import premium from "@formio/premium";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrlForHrefs, formioBaseUrl, formioProjectUrl } from "../config";
import {
  useCsbQuery,
  useBapSamQuery,
  useCsbData,
  useBapSamData,
} from "../utilities";
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
    <span
      key="text"
      className={`margin-${order === "icon-text" ? "left" : "right"}-1`}
    >
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

  const csbData = useCsbData();
  const bapSamData = useBapSamData();

  const { displayDialog } = useDialogActions();
  const helpdeskAccess = useHelpdeskAccess();

  const onAllRebatesPage = pathname === "/";
  const onHelpdeskPage = pathname === "/helpdesk";
  const onApplicationFormPage = pathname.startsWith("/rebate");
  const onPaymentRequestFormPage = pathname.startsWith("/payment-request");
  const onCloseOutFormPage = pathname.startsWith("/close-out");

  const applicationFormOpen = csbData
    ? csbData.submissionPeriodOpen.application
    : false;

  if (!csbData || !bapSamData) {
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

      <div className="desktop:display-flex flex-justify border-bottom">
        <nav className="desktop:order-last mobile-lg:display-flex flex-align-center flex-justify-end">
          <p className="margin-bottom-1 margin-right-1">
            <span>{email}</span>
          </p>

          <a
            className="margin-bottom-1 usa-button font-sans-2xs margin-right-0"
            href={`${serverUrlForHrefs}/logout`}
          >
            <IconText order="text-icon" icon="logout" text="Sign out" />
          </a>
        </nav>

        <nav>
          {/* --- Your Rebate Forms --- */}
          {onAllRebatesPage ? (
            <button
              className="margin-bottom-1 usa-button font-sans-2xs"
              disabled
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </button>
          ) : (
            <Link
              to="/"
              className="margin-bottom-1 usa-button font-sans-2xs"
              onClick={(ev) => {
                if (
                  onApplicationFormPage ||
                  onPaymentRequestFormPage ||
                  onCloseOutFormPage
                ) {
                  ev.preventDefault();
                  displayDialog({
                    dismissable: true,
                    heading:
                      "Are you sure you want to navigate away from this page?",
                    description: (
                      <p>
                        If you haven’t saved the current form, any changes
                        you’ve made will be lost.
                      </p>
                    ),
                    confirmText: "Yes",
                    dismissText: "Cancel",
                    confirmedAction: () => navigate("/"),
                  });
                }
              }}
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </Link>
          )}

          {/* --- New Application --- */}
          {onApplicationFormPage ||
          onPaymentRequestFormPage ||
          onCloseOutFormPage ||
          !applicationFormOpen ? (
            <button
              className="margin-bottom-1 usa-button font-sans-2xs"
              disabled
            >
              <IconText
                order="icon-text"
                icon="add_circle"
                text="New Application"
              />
            </button>
          ) : (
            <Link
              to="/rebate/new"
              className="margin-bottom-1 usa-button font-sans-2xs"
            >
              <IconText
                order="icon-text"
                icon="add_circle"
                text="New Application"
              />
            </Link>
          )}

          {/* --- Helpdesk --- */}
          {helpdeskAccess === "success" && (
            <>
              {onHelpdeskPage ? (
                <button
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  disabled
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </button>
              ) : (
                <Link
                  to="/helpdesk"
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  onClick={(ev) => {
                    if (
                      onApplicationFormPage ||
                      onPaymentRequestFormPage ||
                      onCloseOutFormPage
                    ) {
                      ev.preventDefault();
                      displayDialog({
                        dismissable: true,
                        heading:
                          "Are you sure you want to navigate away from this page?",
                        description: (
                          <p>
                            If you haven’t saved the current form, any changes
                            you’ve made will be lost.
                          </p>
                        ),
                        confirmText: "Yes",
                        dismissText: "Cancel",
                        confirmedAction: () => navigate("/helpdesk"),
                      });
                    }
                  }}
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </Link>
              )}
            </>
          )}
        </nav>
      </div>

      <Outlet context={{ email }} />
    </div>
  );
}
