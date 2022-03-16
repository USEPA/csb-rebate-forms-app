import { useParams } from "react-router-dom";
// ---
import { useUserState } from "contexts/user";
import NotFound from "routes/notFound";

export default function Form() {
  const { id } = useParams<"id">();
  const { samUserData } = useUserState();

  if (samUserData.status !== "success") return null;

  const submission = samUserData.fields.find((data) => data.uei === id);

  if (!submission) return <NotFound />;

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <p className="margin-0">
          (Form.io Submission #<strong>{submission.uei}</strong>)
        </p>
      </div>
    </div>
  );
}
