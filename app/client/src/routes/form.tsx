import { useParams } from "react-router-dom";
// ---
import { useFormsState } from "contexts/forms";
import NotFound from "routes/notFound";

export default function Form() {
  const { id } = useParams<"id">(); // TODO: use mongodb id instead of UEI, as multiple forms can use the same UEI
  const { formSubmissions } = useFormsState();

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
