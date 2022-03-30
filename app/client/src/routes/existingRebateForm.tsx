import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Form } from "@formio/react";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";

type SubmissionsState =
  | { status: "idle"; data: { formSchema: null; submissionData: null } }
  | { status: "pending"; data: { formSchema: null; submissionData: null } }
  | { status: "success"; data: { formSchema: object; submissionData: object } }
  | { status: "failure"; data: { formSchema: null; submissionData: null } };

export default function ExistingRebateForm() {
  const { id } = useParams<"id">();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionsState>({
    status: "idle",
    data: {
        formSchema: null,
      submissionData: null,
    },
  });

  useEffect(() => {
    setRebateFormSubmission({
      status: "pending",
      data: {
        formSchema: null,
        submissionData: null,
      },
    });

    fetchData(`${serverUrl}/api/v1/rebate-form-submission/${id}`)
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
            formSchema: null,
            submissionData: null,
          },
        });
      });
  }, [id]);

  if (rebateFormSubmission.status === "idle") {
    return null;
  }

  if (rebateFormSubmission.status === "pending") {
    return <Loading />;
  }

  if (rebateFormSubmission.status === "failure") {
    return <Message type="error" text={`Error loading rebate form ${id}.`} />;
  }

  const { formSchema, submissionData } = rebateFormSubmission.data;

  return (
    <div className="margin-top-2">
      <Form form={formSchema} submission={submissionData} />
    </div>
  );
}
