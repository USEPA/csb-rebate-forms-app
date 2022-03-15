import { useParams } from "react-router-dom";
// ---
import { useUserState } from "contexts/user";
import NotFound from "routes/notFound";

function Form() {
  const { id } = useParams<"id">();
  const { samData } = useUserState();

  const submission = samData.find((data) => data.uid === id);
  if (!submission) return <NotFound />;

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <p className="margin-0">
          (Form.io Submission #<strong>{submission.uid}</strong>)
        </p>
      </div>
    </div>
  );
}

export default Form;
