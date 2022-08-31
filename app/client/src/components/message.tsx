type Props = {
  type: "info" | "success" | "warning" | "error";
  text: string;
};

export function Message({ type, text }: Props) {
  return (
    <div className={`usa-alert usa-alert--${type}`} role="alert">
      <div className="usa-alert__body">
        <p className="usa-alert__text">{text}</p>
      </div>
    </div>
  );
}
