import { Root, Trigger, Portal, Content, Arrow } from "@radix-ui/react-tooltip";
import icons from "uswds/img/sprite.svg";

export function TextWithTooltip(props: {
  text: string;
  tooltip: string;
  iconName?: string;
  iconClassNames?: string;
}) {
  const { text, tooltip, iconName, iconClassNames } = props;

  const svgClassNames = iconClassNames
    ? `usa-icon text-base ${iconClassNames}`
    : `usa-icon text-base`;

  return (
    <span className="display-inline-flex flex-align-center text-no-wrap">
      <Root delayDuration={0}>
        <Trigger asChild>
          <button className="tw-m-0 tw-flex tw-rounded-full tw-border-0 tw-bg-transparent tw-p-0">
            <svg
              className={svgClassNames}
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#${iconName ? iconName : "info"}`} />
            </svg>
          </button>
        </Trigger>

        <Portal>
          <Content
            className="border-0 radius-md padding-y-05 padding-x-105 font-sans-2xs text-white"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.875)" }}
            align="start"
            alignOffset={-5}
            side="bottom"
            sideOffset={5}
          >
            {tooltip}

            <Arrow />
          </Content>
        </Portal>
      </Root>

      <span className="margin-left-05">{text}</span>
    </span>
  );
}
