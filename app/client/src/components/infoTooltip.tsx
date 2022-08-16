import Tooltip from "@reach/tooltip";
import icons from "uswds/img/sprite.svg";

type InfoTooltipProps = {
  label: string;
};

export function InfoTooltip({ label }: InfoTooltipProps) {
  return (
    <Tooltip
      label={label}
      className="border-0 radius-md padding-y-05 padding-x-105 text-white"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.875)" }}
    >
      <svg
        className="usa-icon margin-right-05 text-base"
        aria-hidden="true"
        focusable="false"
        role="img"
      >
        <use href={`${icons}#info`} />
      </svg>
    </Tooltip>
  );
}

type TextWithTooltipProps = {
  text: string;
  tooltip: string;
};

export function TextWithTooltip({ text, tooltip }: TextWithTooltipProps) {
  return (
    <span className="display-flex flex-align-center text-no-wrap">
      <InfoTooltip label={tooltip} />
      {text}
    </span>
  );
}
