import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Form } from "@formio/react";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "@/config";
import {
  type FormioChange2023Submission,
  getData,
  useContentData,
} from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";

type ServerResponse =
  | {
      userAccess: false;
      formSchema: null;
      submission: null;
    }
  | {
      userAccess: true;
      formSchema: { url: string; json: object };
      submission: FormioChange2023Submission;
    };

/** Custom hook to fetch Formio submission data */
function useFormioSubmissionQuery(mongoId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["formio/2023/change"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/2023/change/${mongoId}`;

  const query = useQuery({
    queryKey: ["formio/2023/change", { id: mongoId }],
    queryFn: () => getData<ServerResponse>(url),
    refetchOnWindowFocus: false,
  });

  return { query };
}

export function Change2023() {
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  const content = useContentData();

  const { query } = useFormioSubmissionQuery(mongoId);
  const { userAccess, formSchema, submission } = query.data ?? {};

  if (query.isInitialLoading) {
    return <Loading />;
  }

  if (query.isError || !userAccess || !formSchema || !submission) {
    return <Message type="error" text={messages.formSubmissionError} />;
  }

  return (
    <div className="margin-top-2">
      {content && (
        <MarkdownContent
          className="margin-top-4"
          children={content.submittedChangeIntro}
        />
      )}

      <ul className="usa-icon-list">
        <li className="usa-icon-list__item">
          <div className="usa-icon-list__icon text-primary">
            <svg className="usa-icon" aria-hidden="true" role="img">
              <use href={`${icons}#local_offer`} />
            </svg>
          </div>
          <div className="usa-icon-list__content">
            <strong>Change Request ID:</strong> {submission._id}
          </div>
        </li>
      </ul>

      <div className="csb-form">
        <Form
          form={formSchema.json}
          url={formSchema.url} // NOTE: used for file uploads
          submission={submission}
          options={{
            readOnly: true,
            noAlerts: true,
          }}
        />
      </div>
    </div>
  );
}
