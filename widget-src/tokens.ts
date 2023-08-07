// Widget UI constants

export const metrics = {
  padding: 16,
  framePadding: 32,
  buttonPadding: { horizontal: 12, vertical: 8 },
  headerPadding: {
    left: 8,
    right: 8,
    top: 8,
  },
  detailPadding: { horizontal: 16, vertical: 8 },

  width: 720,
  widthName: 300,

  cornerRadius: 8,
  resultSpacing: 64,

  iconWidth: 30,
  iconHeight: 35,
  infoIconSize: 16,

  textHeight: 23,
  textOffset: 1, // 16
  textBoxWidth: 300,
};

export const colors = {
  bg: "#fcf6e5",
  bgDark: "#2f2746",
  bgDetail: "#ffffff",
  bgError: "#a93218",

  text: "#5c6d73",
  textDark: "#fdfdfd",
  textDetail: "#0d0d0d",
  textButton: "#ffffff",
  textSecondary: "#7f7f7f",

  placeholder: "#5ba29c",
  stroke: "#B1D3D0",

  error: "#F24822",
  disabled: "#E5E5E5",

  separator: "#E5E5E5",

  play: "#00B268",
  pause: "#F24822",
  format: "#0D99FF",
};

export interface BadgeStyle {
  fill: WidgetJSX.Color | string;
  textFill: WidgetJSX.Color | string;
}

export const badges = {
  SUCCESS: <BadgeStyle>{
    fill: { r: 27 / 255, g: 196 / 255, b: 125 / 255, a: 0.16 },
    textFill: "#00B268",
  },
  ERROR: <BadgeStyle>{
    fill: { r: 169 / 255, g: 50 / 255, b: 24 / 255, a: 0.16 },
    textFill: "#F24822",
  },
  RUNNING: <BadgeStyle>{
    fill: { r: 24 / 255, g: 160 / 255, b: 251 / 255, a: 0.16 },
    textFill: "#0D99FF",
  },
  FORMATTING: <BadgeStyle>{
    fill: { r: 24 / 255, g: 160 / 255, b: 251 / 255, a: 0.16 },
    textFill: "#0D99FF",
  },
  EMPTY: <BadgeStyle>{
    fill: { r: 252 / 255, g: 186 / 255, b: 3 / 255, a: 0.16 },
    textFill: "#FCBA03",
  },
};
