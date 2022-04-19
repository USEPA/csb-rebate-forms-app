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
import { useContentState } from "contexts/content";
import { EPAUserData, SAMUserData, useUserState } from "contexts/user";

type FormSchemaState =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: { url: string; json: object } }
  | { status: "failure"; data: null };

type FormioSubmission = {
  // NOTE: more fields are in a form.io submission,
  // but we're only concerned with the fields below
  data: object;
  // (other fields...)
};

function getMatchedContactInfo(
  samData: SAMUserData | null,
  epaData: EPAUserData
) {
  if (!samData) return { title: "", name: "" };

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
    if (
      typeof value === "string" &&
      value.toLowerCase() === epaData.mail.toLowerCase()
    ) {
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

export default function NewRebateForm() {
  const navigate = useNavigate();
  const { content } = useContentState();
  const { epaUserData, samUserData } = useUserState();

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

  const [selectedSamData, setSelectedSamData] = useState<SAMUserData | null>(
    null
  );

  const activeSamData =
    samUserData.status === "success" &&
    samUserData.data?.results &&
    samUserData.data?.records.filter((e) => e.ENTITY_STATUS__c === "Active");

  const { message, displayInfoMessage, displayErrorMessage } =
    useMessageState();

  if (epaUserData.status !== "success") {
    return null;
  }

  const { mail } = epaUserData.data;

  const { title, name } = getMatchedContactInfo(
    selectedSamData,
    epaUserData.data
  );

  return (
    <div className="margin-top-2">
      <DialogOverlay isOpen={true} onDismiss={(ev) => navigate("/")}>
        <DialogContent
          className="usa-modal usa-modal--lg"
          aria-labelledby="csb-new-rebate-modal-heading"
          aria-describedby="csb-new-rebate-modal-description"
        >
          <div className="usa-modal__content">
            {formSchema.status === "idle" || formSchema.status === "pending" ? (
              <div className="margin-bottom-6">
                <Loading />
              </div>
            ) : formSchema.status === "failure" ? (
              <Message type="error" text="Error loading rebate form fields." />
            ) : (
              <div className="usa-modal__main">
                {content.status === "success" && (
                  <MarkdownContent
                    className="margin-top-4"
                    children={content.data?.newRebateFormDialog || ""}
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

                {message.displayed && (
                  <Message type={message.type} text={message.text} />
                )}

                <div className="usa-table-container--scrollable" tabIndex={0}>
                  <table className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full">
                    <thead>
                      <tr className="font-sans-2xs text-no-wrap">
                        <th scope="col">
                          <span className="usa-sr-only">Create</span>
                        </th>
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
                        activeSamData.map((data, index) => (
                          <tr key={index}>
                            <th scope="row" className="font-sans-2xs">
                              <button
                                className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                                onClick={(ev) => {
                                  setSelectedSamData(data);
                                  displayInfoMessage(
                                    "Creating new rebate form application..."
                                  );
                                }}
                              >
                                <span className="usa-sr-only">
                                  Create Form with UEI:{" "}
                                  {data.UNIQUE_ENTITY_ID__c} and EFTI:{" "}
                                  {data.ENTITY_EFT_INDICATOR__c}
                                </span>
                                <span className="display-flex flex-align-center">
                                  <svg
                                    className="usa-icon"
                                    aria-hidden="true"
                                    focusable="false"
                                    role="img"
                                  >
                                    <use href={`${icons}#arrow_forward`} />
                                  </svg>
                                  <span className="mobile-lg:display-none margin-left-1">
                                    New Form
                                  </span>
                                </span>
                              </button>
                            </th>
                            <td className="font-sans-2xs">
                              {data.UNIQUE_ENTITY_ID__c}
                            </td>
                            <td className="font-sans-2xs">
                              {data.ENTITY_EFT_INDICATOR__c}
                            </td>
                            <td className="font-sans-2xs">
                              {data.LEGAL_BUSINESS_NAME__c}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              className="usa-button usa-modal__close"
              aria-label="Close this window"
              onClick={(ev) => navigate("/")}
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

      {formSchema.status === "success" && selectedSamData && (
        <div className="display-none">
          <Form
            form={formSchema.data.json}
            url={formSchema.data.url} // NOTE: used for file uploads
            submission={{
              data: {
                last_updated_by: mail,
                bap_hidden_entity_combo_key:
                  selectedSamData.ENTITY_COMBO_KEY__c,
                sam_hidden_applicant_email: mail,
                sam_hidden_applicant_title: title,
                sam_hidden_applicant_name: name,
                sam_hidden_applicant_efti:
                  selectedSamData.ENTITY_EFT_INDICATOR__c,
                sam_hidden_applicant_uei: selectedSamData.UNIQUE_ENTITY_ID__c,
                sam_hidden_applicant_organization_name:
                  selectedSamData.LEGAL_BUSINESS_NAME__c,
                sam_hidden_applicant_street_address_1:
                  selectedSamData.PHYSICAL_ADDRESS_LINE_1__c,
                sam_hidden_applicant_street_address_2:
                  selectedSamData.PHYSICAL_ADDRESS_LINE_2__c,
                sam_hidden_applicant_city:
                  selectedSamData.PHYSICAL_ADDRESS_CITY__c,
                sam_hidden_applicant_state:
                  selectedSamData.PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
                sam_hidden_applicant_zip_code:
                  selectedSamData.PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
              },
            }}
            onSubmit={(submission: FormioSubmission) => {
              fetchData(`${serverUrl}/api/rebate-form-submission/`, {
                ...submission,
                data: { ...submission.data, ncesDataSource: "" },
                state: "draft",
              })
                .then((res) => {
                  navigate(`/rebate/${res._id}`);
                })
                .catch((err) => {
                  displayErrorMessage(
                    "Error creating new rebate form application."
                  );
                  setSelectedSamData(null);
                });
            }}
            formReady={(form: any) => {
              // NOTE: for some reason formReady gets called before all form
              // submission fields are set, so we need to wait for submission
              // fields to be set (some passed in Form component's `submission`
              // prop, others set conditionally by GSA in the Form's definition
              // code, based on SAM.gov hidden fields provided) before
              // submitting the form
              (function submitWhenReady() {
                if (
                  form.submission.data.last_updated_by &&
                  form.submission.data.bap_hidden_entity_combo_key &&
                  form.submission.data.sam_hidden_applicant_email &&
                  form.submission.data.sam_hidden_applicant_title &&
                  form.submission.data.sam_hidden_applicant_name &&
                  form.submission.data.sam_hidden_applicant_efti &&
                  form.submission.data.sam_hidden_applicant_uei &&
                  form.submission.data.sam_hidden_applicant_organization_name &&
                  // fields set from GSA from SAM.gov hidden fields provided
                  form.submission.data.applicantUEI &&
                  form.submission.data.applicantEfti &&
                  form.submission.data.applicantOrganizationName
                ) {
                  form.submit();
                  return;
                }
                setTimeout(() => submitWhenReady(), 0);
              })();
            }}
          />
        </div>
      )}
    </div>
  );
}
