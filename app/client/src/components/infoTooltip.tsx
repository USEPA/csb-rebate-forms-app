import { Tooltip } from "@reach/tooltip";
import icons from "uswds/img/sprite.svg";

export function InfoTooltip(props: {
  label: string;
  iconName?: string;
  iconClassNames?: string;
}) {
  const { label, iconName, iconClassNames } = props;

  const svgClassNames = iconClassNames
    ? `usa-icon margin-right-05 text-base ${iconClassNames}`
    : `usa-icon margin-right-05 text-base`;

  return (
    <Tooltip
      label={label}
      className="border-0 radius-md padding-y-05 padding-x-105 text-white"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.875)" }}
    >
      <svg
        className={svgClassNames}
        aria-hidden="true"
        focusable="false"
        role="img"
      >
        <use href={`${icons}#${iconName ? iconName : "info"}`} />
      </svg>
    </Tooltip>
  );
}

export function TextWithTooltip(props: {
  text: string;
  tooltip: string;
  iconName?: string;
  iconClassNames?: string;
}) {
  const { text, tooltip, iconName, iconClassNames } = props;

  return (
    <span className="display-inline-flex flex-align-center text-no-wrap">
      <InfoTooltip
        label={tooltip}
        iconName={iconName}
        iconClassNames={iconClassNames}
      />
      {text}
    </span>
  );
}
