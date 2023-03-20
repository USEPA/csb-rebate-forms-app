export function Message(props: {
  type: "info" | "success" | "warning" | "error";
  text: string;
}) {
  const { type, text } = props;

  return (
    <div className={`usa-alert usa-alert--${type}`} role="alert">
      <div className="usa-alert__body">
        <p className="usa-alert__text">{text}</p>
      </div>
    </div>
  );
}
