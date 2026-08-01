import {
  boolProperty,
  colorProperty,
  comboProperty,
  directoryProperty,
  fileProperty,
  sliderProperty,
  textInputProperty,
} from "wallpaper-engine/plugin";

export const properties = {
  backgroundcolor: colorProperty({
    text: "Background color",
    value: "0.025 0.035 0.08",
  }),
  accentcolor: colorProperty({
    text: "Accent color",
    value: "0.35 0.58 1",
  }),
  glowcolor: colorProperty({
    text: "Secondary glow",
    value: "0.69 0.32 1",
  }),
  animationspeed: sliderProperty({
    text: "Animation speed",
    value: 1,
    min: 0.1,
    max: 2.5,
    fraction: true,
    precision: 1,
  }),
  particledensity: sliderProperty({
    text: "Particle density",
    value: 72,
    min: 12,
    max: 180,
  }),
  visualsensitivity: sliderProperty({
    text: "Audio sensitivity",
    value: 1.15,
    min: 0.2,
    max: 3,
    fraction: true,
    precision: 2,
  }),
  visualstyle: comboProperty({
    text: "Audio visualizer",
    value: "bars",
    options: [
      { label: "Prism bars", value: "bars" },
      { label: "Silk wave", value: "wave" },
      { label: "Halo ring", value: "ring" },
      { label: "Hidden", value: "off" },
    ],
  }),
  showclock: boolProperty({ text: "Show clock", value: true }),
  clockformat: comboProperty({
    text: "Clock format",
    value: "twentyfour",
    condition: "showclock.value == true",
    options: [
      { label: "24 hour", value: "twentyfour" },
      { label: "12 hour", value: "twelve" },
    ],
  }),
  showseconds: boolProperty({
    text: "Show seconds",
    value: true,
    condition: "showclock.value == true",
  }),
  showmedia: boolProperty({ text: "Show media card", value: true }),
  usemediacolors: boolProperty({
    text: "Use album artwork colors",
    value: true,
    condition: "showmedia.value == true",
  }),
  greeting: textInputProperty({
    text: "Header text",
    value: "AETHER // LIVE",
  }),
  backgroundsource: comboProperty({
    text: "Background source",
    value: "generated",
    options: [
      { label: "Generated atmosphere", value: "generated" },
      { label: "Custom image", value: "image" },
      { label: "Custom video", value: "video" },
      { label: "Random image directory", value: "randomimage" },
      { label: "Image gallery", value: "imagegallery" },
      { label: "Random video directory", value: "randomvideo" },
      { label: "Video gallery", value: "videogallery" },
    ],
  }),
  customimage: fileProperty({
    text: "Custom image",
    value: "",
    fileType: "image",
    condition: "backgroundsource.value == 'image'",
  }),
  customvideo: fileProperty({
    text: "Custom video",
    value: "",
    fileType: "video",
    condition: "backgroundsource.value == 'video'",
  }),
  randomimages: directoryProperty({
    text: "Random image directory",
    value: "",
    fileType: "image",
    mode: "ondemand",
    condition: "backgroundsource.value == 'randomimage'",
  }),
  imagegallery: directoryProperty({
    text: "Image gallery directory",
    value: "",
    fileType: "image",
    mode: "fetchall",
    condition: "backgroundsource.value == 'imagegallery'",
  }),
  randomvideos: directoryProperty({
    text: "Random video directory",
    value: "",
    fileType: "video",
    mode: "ondemand",
    condition: "backgroundsource.value == 'randomvideo'",
  }),
  videogallery: directoryProperty({
    text: "Video gallery directory",
    value: "",
    fileType: "video",
    mode: "fetchall",
    condition: "backgroundsource.value == 'videogallery'",
  }),
  galleryinterval: sliderProperty({
    text: "Gallery interval (seconds)",
    value: 20,
    min: 5,
    max: 120,
    condition:
      "backgroundsource.value == 'imagegallery' || backgroundsource.value == 'videogallery'",
  }),
};
