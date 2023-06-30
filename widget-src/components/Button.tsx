import { colors, metrics } from "../tokens";
import { icons } from "../../shared/icons";

const { AutoLayout, SVG, Text } = figma.widget;

interface Props {
  name: string;
  onClick?: (event: WidgetClickEvent) => Promise<void> | void;
  enabled: boolean;
}

export function Button({ name, onClick, enabled }: Props) {
  const onClickWrapper = enabled ? onClick : undefined;
  return (
    <AutoLayout
      verticalAlignItems="center"
      padding={metrics.buttonPadding}
      fill={colors[name]}
      cornerRadius={metrics.cornerRadius}
      stroke={colors.textButton}
      strokeWidth={2}
      hoverStyle={{ stroke: colors.stroke }} // color?
      effect={{
        type: "drop-shadow",
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offset: { x: 0, y: 0 },
        blur: 2,
        spread: 2,
      }}
      onClick={onClickWrapper}
    >
      <SVG src={icons[name]} />
      <Text
        fill={enabled ? colors[name] : colors.disabled}
        horizontalAlignText="center"
      >
        {name}
      </Text>
    </AutoLayout>
  );
}
