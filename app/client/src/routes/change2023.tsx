import { useEffect } from "react";
import { useParams } from "react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Form } from "@formio/react";
import icons from "@uswds/uswds/img/sprite.svg";
// ---
import {
  type FormioSchemaAndSubmission,
  type FormioChange2023FormSubmission,
} from "@/types";
import { serverUrl, messages } from "@/config";
import { getData, usePublicConfigData } from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";

type Response = FormioSchemaAndSubmission<FormioChange2023FormSubmission>;

/** Custom hook to fetch Formio submission data */
function useFormioSubmissionQuery(mongoId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["formio/2023/change"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/2023/change/${mongoId}`;

  const query = useQuery({
    queryKey: ["formio/2023/change", { id: mongoId }],
    queryFn: () => getData<Response>(url),
    refetchOnWindowFocus: false,
  });

  return { query };
}

export function Change2023() {
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  const publicConfigData = usePublicConfigData();
  const { staticContent } = publicConfigData || {};

  const { query } = useFormioSubmissionQuery(mongoId);
  const { access, schema, submission } = query.data ?? {};

  if (query.isLoading || !staticContent) {
    return <Loading />;
  }

  if (query.isError || !access || !schema || !submission) {
    return <Message type="error" text={messages.formSubmissionError} />;
  }

  const comboKey = submission.data._bap_entity_combo_key;

  return (
    <div className="margin-top-2">
      <div className="margin-top-4">
        <MarkdownContent children={staticContent.submittedChangeIntro} />
      </div>

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
          src={schema}
          url={`${serverUrl}/api/formio/2023/s3/change/${mongoId}/${comboKey}`}
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
