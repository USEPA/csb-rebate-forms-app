import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Form } from "@formio/react";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { useUserState } from "contexts/user";
import { useContentState } from "contexts/content";

type SubmissionsState =
  | {
      status: "idle";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "pending";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "success";
      data:
        | {
            userAccess: true;
            formSchema: { url: string; json: object };
            submissionData: { data: object; state: "submitted" | "draft" };
          }
        | {
            userAccess: false;
            formSchema: null;
            submissionData: null;
          };
    }
  | {
      status: "failure";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    };

export default function ExistingRebateForm() {
  const { id } = useParams<"id">();
  const { epaUserData, samUserData } = useUserState();
  const { content } = useContentState();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionsState>({
      status: "idle",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

  useEffect(() => {
    if (samUserData.status !== "success") return;

    const bapComboKeys = samUserData.data.map((e) => e.ENTITY_COMBO_KEY__c);

    setRebateFormSubmission({
      status: "pending",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

    fetchData(`${serverUrl}/api/v1/rebate-form-submission/${id}`, {
      bapComboKeys,
    })
      .then((res) => {
        setRebateFormSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setRebateFormSubmission({
          status: "failure",
          data: {
            userAccess: false,
            formSchema: null,
            submissionData: null,
          },
        });
      });
  }, [samUserData, id]);

  if (rebateFormSubmission.status === "idle") {
    return null;
  }

  if (rebateFormSubmission.status === "pending") {
    return <Loading />;
  }

  if (rebateFormSubmission.status === "failure") {
    return <Message type="error" text={`Error loading rebate form ${id}.`} />;
  }

  const { userAccess, formSchema, submissionData } = rebateFormSubmission.data;

  if (!userAccess) {
    return (
      <Message
        type="warning"
        text="You don’t have access to this form. Please contact support if you believe this is a mistake."
      />
    );
  }

  if (epaUserData.status !== "success") {
    return <Loading />;
  }

  return (
    <div className="margin-top-2">
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submissionData?.state === "draft"
              ? content.data.existingDraftRebateFormIntro
              : submissionData?.state === "submitted"
              ? content.data.existingSubmittedRebateFormIntro
              : ""
          }
        />
      )}

      <Form
        form={formSchema?.json}
        url={formSchema?.url} // NOTE: used for file uploads
        submission={{
          ...submissionData,
          data: {
            ...submissionData?.data,
            last_updated_by: epaUserData.data.mail,
          },
        }}
      />
    </div>
  );
}
