import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DialogOverlay, DialogContent } from "@reach/dialog";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, fetchData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { SamEntityData, useUserState } from "contexts/user";

function createNewApplication(email: string, entity: SamEntityData) {
  const { title, name } = getUserInfo(email, entity);

  return fetchData(`${serverUrl}/api/application-form-submission/`, {
    data: {
      last_updated_by: email,
      hidden_current_user_email: email,
      hidden_current_user_title: title,
      hidden_current_user_name: name,
      bap_hidden_entity_combo_key: entity.ENTITY_COMBO_KEY__c,
      sam_hidden_applicant_email: email,
      sam_hidden_applicant_title: title,
      sam_hidden_applicant_name: name,
      sam_hidden_applicant_efti: entity.ENTITY_EFT_INDICATOR__c,
      sam_hidden_applicant_uei: entity.UNIQUE_ENTITY_ID__c,
      sam_hidden_applicant_organization_name: entity.LEGAL_BUSINESS_NAME__c,
      sam_hidden_applicant_street_address_1: entity.PHYSICAL_ADDRESS_LINE_1__c,
      sam_hidden_applicant_street_address_2: entity.PHYSICAL_ADDRESS_LINE_2__c,
      sam_hidden_applicant_city: entity.PHYSICAL_ADDRESS_CITY__c,
      sam_hidden_applicant_state: entity.PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
      sam_hidden_applicant_zip_code: entity.PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
    },
    state: "draft",
  });
}

export function NewApplication() {
  const navigate = useNavigate();
  const { content } = useContentState();
  const { csbData, epaUserData, bapUserData } = useUserState();

  const [message, setMessage] = useState<{
    displayed: boolean;
    type: "info" | "success" | "warning" | "error";
    text: string;
  }>({
    displayed: false,
    type: "info",
    text: "",
  });

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    bapUserData.status !== "success"
  ) {
    return <Loading />;
  }

  const email = epaUserData.data.mail;

  const activeSamEntities = bapUserData.data.samEntities.filter((entity) => {
    return entity.ENTITY_STATUS__c === "Active";
  });

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
              {csbData.data.enrollmentClosed ? (
                <Message type="info" text={messages.enrollmentClosed} />
              ) : activeSamEntities.length <= 0 ? (
                <Message type="info" text={messages.noSamResults} />
              ) : (
                <>
                  {content.status === "success" && (
                    <MarkdownContent
                      className="margin-top-4"
                      children={content.data?.newApplicationDialog || ""}
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
                    <table
                      aria-label="SAM.gov Entities"
                      className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full"
                    >
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
                        {activeSamEntities.map((entity, index) => (
                          <tr key={index}>
                            <th scope="row" className="font-sans-2xs">
                              <button
                                className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                                onClick={(ev) => {
                                  setMessage({
                                    displayed: true,
                                    type: "info",
                                    text: "Creating new rebate form application...",
                                  });

                                  createNewApplication(email, entity)
                                    .then((res) => {
                                      navigate(`/rebate/${res._id}`);
                                    })
                                    .catch((err) => {
                                      setMessage({
                                        displayed: true,
                                        type: "error",
                                        text: "Error creating new rebate form application.",
                                      });
                                    });
                                }}
                              >
                                <span className="usa-sr-only">
                                  Create Form with UEI:{" "}
                                  {entity.UNIQUE_ENTITY_ID__c} and EFTI:{" "}
                                  {entity.ENTITY_EFT_INDICATOR__c}
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
                              {entity.UNIQUE_ENTITY_ID__c}
                            </td>
                            <td className="font-sans-2xs">
                              {entity.ENTITY_EFT_INDICATOR__c || "0000"}
                            </td>
                            <td className="font-sans-2xs">
                              {entity.LEGAL_BUSINESS_NAME__c}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
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
