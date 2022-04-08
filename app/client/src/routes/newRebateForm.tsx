import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DialogOverlay, DialogContent } from "@reach/dialog";
import { Form } from "@formio/react";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message, { useMessageState } from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { EPAUserData, SAMUserData, useUserState } from "contexts/user";
import { useContentState } from "contexts/content";

type FormioSubmission = {
  // NOTE: more fields are in a form.io submission,
  // but we're only concerned with the fields below
  data: object;
  state: "submitted" | "draft";
  // (other fields...)
};

type FormioOnNextPageParams = {
  page: number;
  submission: FormioSubmission;
};

type FormSchemaState =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: { url: string; json: object } }
  | { status: "failure"; data: null };

type FormioFormProps = {
  samData: SAMUserData | null;
  epaData: EPAUserData | null;
};

type ContactInfoProps = {
  samData: SAMUserData;
  epaData: EPAUserData;
};

function getMatchedContactInfo({ samData, epaData }: ContactInfoProps) {
  const samEmailFields = [
    "ELEC_BUS_POC_EMAIL__c",
    "ALT_ELEC_BUS_POC_EMAIL__c",
    "GOVT_BUS_POC_EMAIL__c",
    "ALT_GOVT_BUS_POC_EMAIL__c",
  ];

  let matchedEmailField;

  for (const [field, value] of Object.entries(samData)) {
    if (!samEmailFields.includes(field)) continue;
    // NOTE: take the first match only – there shouldn't be a case where the
    // currently logged in user would be listed as multiple POCs for a single record
    if (value === epaData.mail) {
      matchedEmailField = field;
      break;
    }
  }

  const fieldPrefix = matchedEmailField?.split("_EMAIL__c").shift();

  return {
    title: samData[`${fieldPrefix}_TITLE__c` as keyof SAMUserData] as string,
    name: samData[`${fieldPrefix}_NAME__c` as keyof SAMUserData] as string,
  };
}

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

    fetchData(`${serverUrl}/api/rebate-form-schema/`)
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

  const {
    message,
    displayInfoMessage,
    displaySuccessMessage,
    displayErrorMessage,
  } = useMessageState();

  // NOTE: Provided to the <Form /> component's submission prop. Initially
  // empty, it'll be set once the user attemts to submit the form (both
  // succesfully and unsuccesfully) – that way when the form re-renders after
  // the submission attempt, the fields the user filled out will not be lost
  const [savedSubmission, setSavedSubmission] = useState<{ data: object }>({
    data: {},
  });

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

  const {
    ENTITY_COMBO_KEY__c,
    ENTITY_EFT_INDICATOR__c,
    UNIQUE_ENTITY_ID__c,
    LEGAL_BUSINESS_NAME__c,
    PHYSICAL_ADDRESS_LINE_1__c,
    PHYSICAL_ADDRESS_LINE_2__c,
    PHYSICAL_ADDRESS_CITY__c,
    PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
    PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
  } = samData;

  const { title, name } = getMatchedContactInfo({ samData, epaData });

  return (
    <>
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={content.data.newRebateFormIntro}
        />
      )}

      {message.displayed && <Message type={message.type} text={message.text} />}

      <div className="csb-form">
        <Form
          form={formSchema.data.json}
          url={formSchema.data.url} // NOTE: used for file uploads
          submission={{
            data: {
              last_updated_by: epaData.mail,
              bap_hidden_entity_combo_key: ENTITY_COMBO_KEY__c,
              sam_hidden_applicant_email: epaData.mail,
              sam_hidden_applicant_title: title,
              sam_hidden_applicant_name: name,
              sam_hidden_applicant_efti: ENTITY_EFT_INDICATOR__c,
              sam_hidden_applicant_uei: UNIQUE_ENTITY_ID__c,
              sam_hidden_applicant_organization_name: LEGAL_BUSINESS_NAME__c,
              sam_hidden_applicant_street_address_1: PHYSICAL_ADDRESS_LINE_1__c,
              sam_hidden_applicant_street_address_2: PHYSICAL_ADDRESS_LINE_2__c,
              sam_hidden_applicant_city: PHYSICAL_ADDRESS_CITY__c,
              sam_hidden_applicant_state: PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
              sam_hidden_applicant_zip_code: PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
              ...savedSubmission.data,
            },
          }}
          options={{ noAlerts: true }}
          onSubmit={(submission: FormioSubmission) => {
            setSavedSubmission(submission);

            if (submission.state === "submitted") {
              displayInfoMessage("Submitting form...");
            }

            if (submission.state === "draft") {
              displayInfoMessage("Saving form...");
            }

            fetchData(`${serverUrl}/api/rebate-form-submission/`, {
              ...submission,
              data: { ...submission.data, ncesDataSource: "" },
            })
              .then((res) => {
                if (submission.state === "submitted") {
                  displaySuccessMessage("Form succesfully submitted.");
                  setTimeout(() => navigate("/"), 5000);
                  return;
                }

                if (submission.state === "draft") {
                  navigate(`/rebate/${res._id}`);
                }
              })
              .catch((err) => {
                if (submission.state === "submitted") {
                  displayErrorMessage("Error submitting rebate form.");
                }

                if (submission.state === "draft") {
                  displayErrorMessage("Error saving draft rebate form.");
                }
              });
          }}
          onNextPage={({ page, submission }: FormioOnNextPageParams) => {
            setSavedSubmission(submission);

            if (submission.state === "submitted") {
              displayInfoMessage("Submitting form...");
            }

            if (submission.state === "draft") {
              displayInfoMessage("Saving form...");
            }

            fetchData(`${serverUrl}/api/rebate-form-submission/`, {
              ...submission,
              data: { ...submission.data, ncesDataSource: "" },
              state: "draft",
            })
              .then((res) => {
                navigate(`/rebate/${res._id}`);
              })
              .catch((err) => {
                displayErrorMessage("Error saving draft rebate form.");
              });
          }}
        />
      </div>

      {message.displayed && <Message type={message.type} text={message.text} />}
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
    samUserData.data.results &&
    samUserData.data.records.filter((entity) => {
      return entity.ENTITY_STATUS__c === "Active";
    });

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

              <table className="usa-table usa-table--borderless usa-table--striped width-full" data-testid="csb-modal-table">
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
                        text="EFT Indicator"
                        tooltip="Electronic Funds Transfer Indicator listing the associated bank account from SAM.gov"
                      />
                    </th>
                    <th scope="col">
                      <TextWithTooltip
                        text="Applicant"
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
