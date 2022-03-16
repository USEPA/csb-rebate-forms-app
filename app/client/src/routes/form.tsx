import { useParams } from "react-router-dom";
// ---
import { useFormioState } from "contexts/formio";
import NotFound from "routes/notFound";

export default function Form() {
  const { id } = useParams<"id">(); // TODO: use mongodb ID instead of UEI, as multiple forms can use a UEI
  const { formSubmissions } = useFormioState();

  if (formSubmissions.status !== "success") return null;

  const submission = formSubmissions.data.find((d) => d.uei === id);

  if (!submission) return <NotFound />;

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <p className="margin-0">
          <strong>{submission.name}</strong>
          <br />
          (#{submission.uei})
        </p>
      </div>
    </div>
  );
}
