import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DialogOverlay, DialogContent } from "@reach/dialog";
import { Form } from "@formio/react";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { EPAUserData, SAMUserData, useUserState } from "contexts/user";
import { useContentState } from "contexts/content";

type FormSchemaState =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: { url: string; json: object } }
  | { status: "failure"; data: null };

type FormioFormProps = {
  samData: SAMUserData | null;
  epaData: EPAUserData | null;
};

function FormioForm({ samData, epaData }: FormioFormProps) {
  const navigate = useNavigate();
  const { content } = useContentState();

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
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={content.data.newRebateFormIntro}
        />
      )}

      {formSubmissionFailed && (
        <Message type="error" text="Error submitting rebate form." />
      )}

      <Form
        form={formSchema.data.json}
        url={formSchema.data.url} // NOTE: used for file uploads
        submission={{
          data: {
            last_updated_by: epaData.mail,
            // TODO: update fields below only populate the hidden fields (GSA will populate the rest)
            sam_hidden_name: epaData.mail,
            applicantUEI: samData.UNIQUE_ENTITY_ID__c,
            applicantOrganizationName: samData.LEGAL_BUSINESS_NAME__c,
          },
        }}
        onSubmit={(submission: object) => {
          setformSubmissionFailed(false);

          fetchData(`${serverUrl}/api/v1/rebate-form-submission/`, submission)
            .then((res) => {
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
  const navigate = useNavigate();
  const { epaUserData, samUserData } = useUserState();
  const { content } = useContentState();

  const [dialogShown, setDialogShown] = useState(true);

  // samData set when user selects table row in modal
  const [samData, setSamData] = useState<SAMUserData | null>(null);

  const activeSamData =
    samUserData.status === "success" &&
    samUserData.data.filter((entity) => entity.ENTITY_STATUS__c === "Active");

  return (
    <div className="margin-top-2">
      <DialogOverlay
        isOpen={dialogShown}
        onDismiss={(ev) => {
          setDialogShown(false);
          navigate("/");
        }}
      >
        <DialogContent
          className="usa-modal usa-modal--lg"
          aria-labelledby="csb-new-rebate-modal-heading"
          aria-describedby="csb-new-rebate-modal-description"
        >
          <div className="usa-modal__content">
            <div className="usa-modal__main">
              {content.status === "success" && (
                <MarkdownContent
                  className="margin-top-4"
                  children={content.data.newRebateFormDialog}
                  components={{
                    h2: (props) => (
                      <h2
                        id="csb-new-rebate-modal-heading"
                        className="usa-modal__heading text-center"
                      >
                        {props.children}
                      </h2>
                    ),
                    p: (props) => (
                      <p
                        id="csb-new-rebate-modal-description"
                        className="text-center"
                      >
                        {props.children}
                      </p>
                    ),
                  }}
                />
              )}

              <table className="usa-table usa-table--borderless usa-table--striped width-full">
                <thead>
                  <tr className="font-sans-2xs text-no-wrap">
                    <th scope="col">&nbsp;</th>
                    <th scope="col">
                      <TextWithTooltip
                        text="UEI"
                        tooltip="Unique Entity ID from SAM.gov"
                      />
                    </th>
                    <th scope="col">
                      <TextWithTooltip
                        text="EFT"
                        tooltip="Electronic Funds Transfer indicator listing the associated bank account from SAM.gov"
                      />
                    </th>
                    <th scope="col">
                      <TextWithTooltip
                        text="Organization"
                        tooltip="Legal Business Name from SAM.gov for this UEI"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!activeSamData ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="margin-bottom-2">
                          <Loading />
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeSamData.map((samData, index) => {
                      return (
                        <tr key={index}>
                          <th scope="row" className="font-sans-2xs">
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                              onClick={(ev) => {
                                setSamData(samData);
                                setDialogShown(false);
                              }}
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
                          <th className="font-sans-2xs">
                            {samData.UNIQUE_ENTITY_ID__c}
                          </th>
                          <th className="font-sans-2xs">
                            {samData.ENTITY_EFT_INDICATOR__c}
                          </th>
                          <th className="font-sans-2xs">
                            {samData.LEGAL_BUSINESS_NAME__c}
                          </th>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <button
              className="usa-button usa-modal__close"
              aria-label="Close this window"
              onClick={(ev) => {
                setDialogShown(false);
                navigate("/");
              }}
            >
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#close`} />
              </svg>
            </button>
          </div>
        </DialogContent>
      </DialogOverlay>

      <FormioForm
        samData={samData}
        epaData={epaUserData.status === "success" ? epaUserData.data : null}
      />
    </div>
  );
}
