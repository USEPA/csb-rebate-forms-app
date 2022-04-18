import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Formio } from "@formio/react";
import premium from "@formio/premium";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, formioProjectUrl, fetchData } from "../config";
import { useHelpdeskAccess } from "components/app";
import Loading from "components/loading";
import { useUserState, useUserDispatch } from "contexts/user";
import { Action, useDialogDispatch } from "contexts/dialog";

Formio.setProjectUrl(formioProjectUrl);
Formio.use(premium);
Formio.use(uswds);

// Custom hook to fetch SAM.gov data
function useFetchedSamData() {
  const dispatch = useUserDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_SAM_USER_DATA_REQUEST" });
    fetchData(`${serverUrl}/api/sam-data`)
      .then((res) => {
        if (res.results) {
          dispatch({
            type: "FETCH_SAM_USER_DATA_SUCCESS",
            payload: { samUserData: res },
          });
        } else {
          window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=sam-results`;
        }
      })
      .catch((err) => {
        dispatch({ type: "FETCH_SAM_USER_DATA_FAILURE" });
        window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=sam-fetch`;
      });
  }, [dispatch]);
}

type IconTextProps = {
  order: "icon-text" | "text-icon";
  icon: string;
  text: string;
};

function IconText({ order, icon, text }: IconTextProps) {
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

export default function Dashboard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { epaUserData, samUserData } = useUserState();
  const dispatch = useDialogDispatch();
  const helpdeskAccess = useHelpdeskAccess();

  useFetchedSamData();

  /**
   * When provided a destination location to navigate to, creates an action
   * object that can be dispatched to the `DialogProvider` context component,
   * which the `ConfirmationDialog` component (rendered in the `App` component's
   * `ProtectedRoute` component) uses to display the provided info.
   */
  function createDialogNavAction(destination: string): Action {
    return {
      type: "DISPLAY_DIALOG",
      payload: {
        dismissable: true,
        heading: "Are you sure you want to navigate away from this page?",
        description:
          "If you haven’t saved the current form, any changes you’ve made will be lost.",
        confirmText: "Yes",
        cancelText: "Cancel",
        confirmedAction: () => navigate(destination),
      },
    };
  }

  if (samUserData.status !== "success") {
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
            <span>
              {epaUserData.status === "success" && epaUserData.data?.mail}
            </span>
          </p>

          <a
            className="margin-bottom-1 usa-button font-sans-2xs margin-right-0"
            href={`${serverUrl}/logout`}
          >
            <IconText order="text-icon" icon="logout" text="Sign out" />
          </a>
        </nav>

        <nav>
          {pathname === "/" ? (
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
            <a
              href="/"
              className="margin-bottom-1 usa-button font-sans-2xs"
              onClick={(ev) => {
                if (pathname.startsWith("/rebate")) {
                  ev.preventDefault();
                  const action = createDialogNavAction("/");
                  dispatch(action);
                }
              }}
            >
              <IconText
                order="icon-text"
                icon="list"
                text="Your Rebate Forms"
              />
            </a>
          )}

          {pathname.startsWith("/rebate") ? (
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

          {helpdeskAccess === "success" && (
            <>
              {pathname === "/helpdesk" ? (
                <button
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  disabled
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </button>
              ) : (
                <a
                  href="/helpdesk"
                  className="margin-bottom-1 usa-button font-sans-2xs"
                  onClick={(ev) => {
                    if (pathname.startsWith("/rebate")) {
                      ev.preventDefault();
                      const action = createDialogNavAction("/helpdesk");
                      dispatch(action);
                    }
                  }}
                >
                  <IconText order="icon-text" icon="people" text="Helpdesk" />
                </a>
              )}
            </>
          )}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
