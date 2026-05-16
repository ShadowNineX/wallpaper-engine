import {
  colorProperty,
  boolProperty,
  textInputProperty,
} from "wallpaper-engine/plugin";

export const properties = {
  bgColor: colorProperty({ text: "Background Color", value: "0 0 0.05" }),
  accentColor: colorProperty({ text: "Accent Color", value: "0.4 0 1" }),
  label: textInputProperty({ text: "Label Text", value: "WALLPAPER ENGINE" }),
  showLabel: boolProperty({ text: "Show Label", value: true }),
};
