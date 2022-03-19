import { useParams } from "react-router-dom";
// ---
import { useFormsState } from "contexts/forms";
import NotFound from "routes/notFound";

export default function Form() {
  const { id } = useParams<"id">();
  const { rebateFormSubmissions } = useFormsState();

  const submission = rebateFormSubmissions.data.find((d) => d._id === id);

  if (!submission) return <NotFound />;

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <p className="margin-0">
          <strong>{submission.entityName}</strong>
          <br />
          (#{submission._id})
        </p>
      </div>
    </div>
  );
}
