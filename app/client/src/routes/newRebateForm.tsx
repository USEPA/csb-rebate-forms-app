import { useNavigate } from "react-router-dom";
import { DialogOverlay, DialogContent } from "@reach/dialog";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message, { useMessageState } from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { EPAUserData, SAMUserData, useUserState } from "contexts/user";

function getMatchedContactInfo(samData: SAMUserData, epaData: EPAUserData) {
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

function createNewRebate(samData: SAMUserData, epaData: EPAUserData) {
  const { title, name } = getMatchedContactInfo(samData, epaData);

  return fetchData(`${serverUrl}/api/rebate-form-submission/`, {
    data: {
      last_updated_by: epaData.mail,
      bap_hidden_entity_combo_key: samData.ENTITY_COMBO_KEY__c,
      sam_hidden_applicant_email: epaData.mail,
      sam_hidden_applicant_title: title,
      sam_hidden_applicant_name: name,
      sam_hidden_applicant_efti: samData.ENTITY_EFT_INDICATOR__c,
      sam_hidden_applicant_uei: samData.UNIQUE_ENTITY_ID__c,
      sam_hidden_applicant_organization_name: samData.LEGAL_BUSINESS_NAME__c,
      sam_hidden_applicant_street_address_1: samData.PHYSICAL_ADDRESS_LINE_1__c,
      sam_hidden_applicant_street_address_2: samData.PHYSICAL_ADDRESS_LINE_2__c,
      sam_hidden_applicant_city: samData.PHYSICAL_ADDRESS_CITY__c,
      sam_hidden_applicant_state: samData.PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
      sam_hidden_applicant_zip_code: samData.PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
    },
    state: "draft",
  });
}

export default function NewRebateForm() {
  const navigate = useNavigate();
  const { content } = useContentState();
  const { epaUserData, samUserData } = useUserState();

  const activeSamData =
    samUserData.status === "success" &&
    samUserData.data?.results &&
    samUserData.data?.records.filter((e) => e.ENTITY_STATUS__c === "Active");

  const { message, displayInfoMessage, displayErrorMessage } =
    useMessageState();

  if (epaUserData.status !== "success") {
    return null;
  }

  return (
    <div className="margin-top-2">
      <DialogOverlay isOpen={true} onDismiss={(ev) => navigate("/")}>
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
                      activeSamData.map((samData, index) => (
                        <tr key={index}>
                          <th scope="row" className="font-sans-2xs">
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                              onClick={(ev) => {
                                displayInfoMessage(
                                  "Creating new rebate form application..."
                                );

                                createNewRebate(samData, epaUserData.data)
                                  .then((res) => {
                                    navigate(`/rebate/${res._id}`);
                                  })
                                  .catch((err) => {
                                    displayErrorMessage(
                                      "Error creating new rebate form application."
                                    );
                                  });
                              }}
                            >
                              <span className="usa-sr-only">
                                Create Form with UEI:{" "}
                                {samData.UNIQUE_ENTITY_ID__c} and EFTI:{" "}
                                {samData.ENTITY_EFT_INDICATOR__c}
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
                            {samData.UNIQUE_ENTITY_ID__c}
                          </td>
                          <td className="font-sans-2xs">
                            {samData.ENTITY_EFT_INDICATOR__c}
                          </td>
                          <td className="font-sans-2xs">
                            {samData.LEGAL_BUSINESS_NAME__c}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
    </div>
  );
}
