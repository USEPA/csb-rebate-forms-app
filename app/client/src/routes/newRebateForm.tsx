import { useRef, useLayoutEffect, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "@formio/react";
import { modal } from "uswds/src/js/components";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import { EPAUserData, SAMUserData, useUserState } from "contexts/user";
import Loading from "components/loading";
import Message from "components/message";

type FormSchemaState =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: object }
  | { status: "failure"; data: null };

type FormioFormProps = {
  samData: SAMUserData | null;
  epaData: EPAUserData | null;
};

function FormioForm({ samData, epaData }: FormioFormProps) {
  const navigate = useNavigate();

  const [formSchema, setFormSchema] = useState<FormSchemaState>({
    status: "idle",
    data: null,
  });

  useEffect(() => {
    setFormSchema({
      status: "pending",
      data: null,
    });

    fetchData(`${serverUrl}/api/v1/rebate-form-schema/`)
      .then((res) => {
        setFormSchema({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setFormSchema({
          status: "failure",
          data: null,
        });
      });
  }, []);

  const [formSubmissionFailed, setformSubmissionFailed] = useState(false);

  if (!samData || !epaData) {
    return null;
  }

  if (formSchema.status === "idle") {
    return null;
  }

  if (formSchema.status === "pending") {
    return <Loading />;
  }

  if (formSchema.status === "failure") {
    return <Message type="error" text="Error loading rebate form." />;
  }

  return (
    <>
      {formSubmissionFailed && (
        <Message type="error" text="Error submitting rebate form." />
      )}

      <Form
        form={formSchema.data}
        submission={{
          data: {
            sam_hidden_name: epaData.mail,
            applicantUEI: samData.uei,
            applicantOrganizationName: samData.ueiEntityName,
          },
        }}
        onSubmit={(submission: object) => {
          setformSubmissionFailed(false);

          fetchData(`${serverUrl}/api/v1/rebate-form-submission/`, submission)
            .then((formSubmission) => {
              navigate("/");
            })
            .catch((err) => {
              setformSubmissionFailed(true);
            });
        }}
      />
    </>
  );
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
  }, []);

  // samData set when user selects table row in modal
  const [samData, setSamData] = useState<SAMUserData | null>(null);

  return (
    <div className="margin-top-2">
      <button
        ref={buttonRef}
        style={{ display: "none" }}
        className="usa-button font-sans-2xs margin-bottom-2"
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
                    <th scope="col" className="font-sans-2xs">
                      &nbsp;
                    </th>
                    <th scope="col" className="font-sans-2xs">
                      UEI
                    </th>
                    <th scope="col" className="font-sans-2xs">
                      EFT
                    </th>
                    <th scope="col" className="font-sans-2xs">
                      UEI Entity Name
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userData.status === "success" &&
                    userData.data.samUserData.map((samData, index) => {
                      return (
                        <tr key={index}>
                          <th scope="row" className="font-sans-2xs">
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
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
                          <th className="font-sans-2xs">{samData.uei}</th>
                          <th className="font-sans-2xs">{samData.eft}</th>
                          <th className="font-sans-2xs">
                            {samData.ueiEntityName}
                          </th>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <FormioForm
        samData={samData}
        epaData={
          userData.status === "success" ? userData.data.epaUserData : null
        }
      />
    </div>
  );
}
