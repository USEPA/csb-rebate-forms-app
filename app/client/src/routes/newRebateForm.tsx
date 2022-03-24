import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { Form } from "@formio/react";
import { modal } from "uswds/src/js/components";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import { SAMUserData, useUserState } from "contexts/user";
import Loading from "components/loading";
import Message from "components/message";

type State =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: object }
  | { status: "failure"; data: null };

function FormioForm() {
  const [jsonSchema, setJsonSchema] = useState<State>({
    status: "idle",
    data: null,
  });

  useEffect(() => {
    setJsonSchema({
      status: "pending",
      data: null,
    });

    fetchData(`${serverUrl}/api/v1/rebate-form-schema/`)
      .then((res) => {
        setJsonSchema({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setJsonSchema({
          status: "failure",
          data: null,
        });
      });
  }, []);

  if (jsonSchema.status === "idle") {
    return null;
  }

  if (jsonSchema.status === "pending") {
    return <Loading />;
  }

  if (jsonSchema.status === "failure") {
    return <Message type="error" text="Error loading rebate form" />;
  }

  return <Form form={jsonSchema.data} />;
}

export default function NewRebateForm() {
  const { userData } = useUserState();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // trigger modal on component route load (button is hidden)
  useLayoutEffect(() => {
    const buttonEl = buttonRef.current;
    const modalEl = modalRef.current;
    if (!buttonEl || !modalEl) return;

    modal.on(modalEl);
    buttonEl.click();

    return function cleanup() {
      modal.off(modalEl);
    };
  }, [modalRef, buttonRef]);

  // samData set when user selects table row in modal
  const [samData, setSamData] = useState<SAMUserData | null>(null);

  if (userData.status !== "success") return null;

  return (
    <div className="margin-top-2">
      <button
        ref={buttonRef}
        className="usa-button display-none"
        aria-controls="csb-new-rebate-modal"
        data-open-modal
      >
        Select Record
      </button>

      <div ref={modalRef}>
        <div
          id="csb-new-rebate-modal"
          className="usa-modal usa-modal--lg"
          aria-labelledby="csb-new-rebate-modal-heading"
          aria-describedby="csb-new-rebate-modal-description"
          data-force-action
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              <h2
                id="csb-new-rebate-modal-heading"
                className="usa-modal__heading"
              >
                Start a new rebate application
              </h2>

              <div className="usa-prose">
                <p id="csb-new-rebate-modal-description">
                  Please select a record below to begin your new rebate
                  application.
                </p>
              </div>

              <table className="usa-table usa-table--borderless usa-table--striped width-full">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    <th scope="col">UEI</th>
                    <th scope="col">EFT</th>
                    <th scope="col">CAGE</th>
                    <th scope="col">Entity Name</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.data.samUserData.map((samData, index) => {
                    return (
                      <tr key={index}>
                        <th scope="row">
                          <button
                            type="button"
                            className="usa-button usa-button--base font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                            data-close-modal
                            onClick={(ev) => setSamData(samData)}
                          >
                            <span className="display-flex flex-align-center">
                              <svg
                                className="usa-icon"
                                aria-hidden="true"
                                focusable="false"
                                role="img"
                              >
                                <use href={`${icons}#arrow_forward`} />
                              </svg>
                            </span>
                          </button>
                        </th>
                        <th>{samData.uei}</th>
                        <th>{samData.eft}</th>
                        <th>{samData.cage}</th>
                        <th>{samData.entityName}</th>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {samData ? <FormioForm /> : null}
    </div>
  );
}
