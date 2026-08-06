<script setup lang="ts">
import { useLoop, useTres } from "@tresjs/core";
import { Color, Vector2, Vector3 } from "three";
import type { AudioAnalyzer } from "wallpaper-engine/helpers";
import { watch } from "vue";

const props = defineProps<{
  background: string;
  accent: string;
  glow: string;
  baseAccent: string;
  baseGlow: string;
  analyzer: AudioAnalyzer;
  sensitivity: number;
  animationSpeed: number;
  paused: boolean;
}>();

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAudio;
  uniform float uBass;
  uniform float uMids;
  uniform float uTreble;
  uniform float uStage;
  uniform vec2 uResolution;
  uniform vec3 uBackground;
  uniform vec3 uAccent;
  uniform vec3 uGlow;

  varying vec2 vUv;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 offset = fract(point);
    offset = offset * offset * (3.0 - 2.0 * offset);

    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), offset.x),
      mix(
        hash21(cell + vec2(0.0, 1.0)),
        hash21(cell + vec2(1.0, 1.0)),
        offset.x
      ),
      offset.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 transform = mat2(0.80, 0.60, -0.60, 0.80);

    for (int octave = 0; octave < 5; octave++) {
      value += valueNoise(point) * amplitude;
      point = transform * point * 2.03 + 19.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float starLayer(vec2 point, float scale, float threshold) {
    vec2 grid = point * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = hash21(cell);
    vec2 jitter = vec2(hash21(cell + 7.3), hash21(cell + 19.1)) - 0.5;
    float distanceToStar = length(local - jitter * 0.55);
    float star = 1.0 - smoothstep(0.0, 0.075, distanceToStar);
    return star * smoothstep(threshold, 1.0, seed);
  }

  void main() {
    vec2 point = vUv - 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    point.x *= aspect;

    float time = uTime;
    float stageGlow = smoothstep(0.25, 2.8, uStage);
    float haze = fbm(
      point * 1.35 +
      vec2(time * 0.018, -time * 0.012)
    );
    float fineHaze = fbm(
      point * 3.1 +
      vec2(-time * 0.012, time * 0.016) +
      haze
    );

    vec3 color = mix(
      uBackground * 0.42,
      mix(uBackground, uAccent, 0.16),
      haze * 0.72
    );
    vec2 haloPoint =
      (point - vec2(0.28, 0.03)) * vec2(0.70, 1.05);
    color += mix(uAccent, uGlow, 0.55) *
      exp(-dot(haloPoint, haloPoint) * 1.45) *
      (0.075 + stageGlow * 0.022);

    float curtainField = 0.0;
    float filamentField = 0.0;
    for (int layer = 0; layer < 5; layer++) {
      float layerIndex = float(layer);
      float depth = layerIndex / 4.0;
      float curveNoise = valueNoise(vec2(
        point.x * (0.82 + depth * 0.20) +
          layerIndex * 3.71 +
          time * (0.018 + depth * 0.007),
        layerIndex * 2.13 + time * 0.011
      )) - 0.5;
      float audioDrift =
        sin(layerIndex * 1.7 + time * 0.65) * uBass * 0.032 +
        (fineHaze - 0.5) * uMids * 0.050;
      float curtainCenter =
        (depth - 0.5) * 0.58 +
        sin(
          point.x * (0.78 + depth * 0.56) +
          layerIndex * 1.36 +
          time * (0.052 + depth * 0.014)
        ) *
        (0.105 + depth * 0.075) +
        curveNoise * 0.17 +
        audioDrift;
      float distanceToCurtain = abs(point.y - curtainCenter);
      float veil = exp(-distanceToCurtain * (5.0 + depth * 3.6));
      float silkEdge = exp(
        -distanceToCurtain * (92.0 + depth * 54.0)
      );
      float glassFringe = exp(
        -abs(distanceToCurtain - 0.026) * (92.0 + depth * 28.0)
      );
      float innerRefraction = exp(
        -abs(distanceToCurtain - 0.008) * (170.0 + depth * 58.0)
      );
      float weave =
        0.72 +
        0.28 *
        sin(
          point.x * (8.0 + depth * 5.0) +
          point.y * 3.2 +
          layerIndex * 2.4 +
          time * 0.14
        );
      float colorPhase = fract(depth * 0.72 + haze * 0.24);
      vec3 silkColor = mix(uAccent, uGlow, colorPhase);
      vec3 pearlColor = mix(silkColor, vec3(0.86, 0.93, 1.0), 0.42);

      color = mix(
        color,
        silkColor,
        veil * (0.018 + depth * 0.018 + uAudio * 0.045)
      );
      color += pearlColor *
        silkEdge *
        weave *
        (
          0.38 +
          depth * 0.24 +
          stageGlow * 0.055 +
          uBass * 0.18 +
          uMids * 0.10
        );
      color += silkColor *
        glassFringe *
        (0.12 + depth * 0.075 + uMids * 0.08);
      color += mix(pearlColor, uGlow, 0.32) *
        innerRefraction *
        (0.12 + depth * 0.075 + uTreble * 0.12);
      curtainField += veil * (0.16 + depth * 0.08);
      filamentField += silkEdge * weave;
    }
    float crystalOffset =
      0.28 * smoothstep(1.10, 1.55, aspect);
    float crystalWidth =
      0.43 * min(1.0, aspect);
    float crystalHeight =
      mix(0.30, 0.35, smoothstep(0.80, 1.30, aspect));
    vec2 crystalPoint = point - vec2(crystalOffset, 0.04);
    vec2 crystalSpace =
      crystalPoint / vec2(crystalWidth, crystalHeight);
    float diamondDistance =
      abs(crystalSpace.x) + abs(crystalSpace.y);
    float crystalInside =
      1.0 - smoothstep(0.92, 1.0, diamondDistance);
    float crystalHalo =
      exp(-abs(diamondDistance - 1.0) * 9.0);
    float crystalEdge =
      exp(-abs(diamondDistance - 1.0) * 168.0);
    float spectralEdge = exp(
      -abs(diamondDistance - 1.025) * 112.0
    );
    float ghostDiamond = exp(
      -abs(diamondDistance / 1.22 - 1.0) * 66.0
    );
    float facetShade =
      0.5 +
      0.5 *
      sin(
        crystalSpace.x * 4.0 -
        crystalSpace.y * 6.0 +
        fineHaze * 2.4 +
        time * 0.055
      );
    float rightFace = step(0.0, crystalSpace.x);
    float upperFace = step(0.0, crystalSpace.y);
    float diagonalFace = step(
      crystalSpace.y * 0.56,
      crystalSpace.x
    );
    float facePhase =
      rightFace * 0.42 + upperFace * 0.18 + diagonalFace * 0.24;
    vec3 crystalFill =
      uBackground * 0.34 +
      mix(uAccent, uGlow, facePhase) *
      (0.14 + facetShade * 0.10);
    color = mix(
      color,
      crystalFill,
      crystalInside * 0.98
    );
    float planeReflection =
      (
        1.0 -
        smoothstep(
          0.08,
          0.82,
          abs(
            crystalSpace.x * 0.72 +
            crystalSpace.y * 0.92 +
            sin(time * 0.045) * 0.10
          )
        )
      ) *
      crystalInside;
    color += mix(uGlow, vec3(0.86, 0.94, 1.0), 0.42) *
      planeReflection *
      (0.145 + stageGlow * 0.020 + uMids * 0.12);

    float facetOne = exp(
      -abs(crystalSpace.x - crystalSpace.y * 0.56) * 76.0
    );
    float facetTwo = exp(
      -abs(crystalSpace.x + crystalSpace.y * 0.72) * 82.0
    );
    float facetThree = exp(
      -abs(crystalSpace.x * 0.22 + crystalSpace.y) * 94.0
    );
    float crystalFacets =
      (facetOne * 0.64 + facetTwo * 0.52 + facetThree * 0.28) *
      crystalInside;
    float coreGlint = exp(-length(crystalSpace) * 48.0);
    vec3 crystalPearl = mix(
      mix(uAccent, uGlow, 0.55),
      vec3(0.91, 0.97, 1.0),
      0.58
    );
    color += mix(uAccent, uGlow, 0.68) *
      ghostDiamond *
      0.020;
    color += mix(uAccent, uGlow, 0.42) *
      crystalHalo *
      (0.060 + stageGlow * 0.018 + uBass * 0.08);
    color += mix(uAccent, uGlow, 0.82) *
      spectralEdge *
      (0.075 + uTreble * 0.10);
    color += crystalPearl *
      crystalEdge *
      (0.94 + stageGlow * 0.050 + uAudio * 0.12);
    color += crystalPearl *
      crystalFacets *
      (0.14 + stageGlow * 0.018 + uMids * 0.18);
    color += crystalPearl *
      coreGlint *
      (0.74 + stageGlow * 0.055 + uBass * 0.12);

    float upperBeam = exp(
      -abs(crystalPoint.y - crystalPoint.x * 0.24 - 0.17) * 46.0
    );
    float lowerBeam = exp(
      -abs(crystalPoint.y + crystalPoint.x * 0.18 + 0.18) * 52.0
    );
    color += mix(uAccent, uGlow, 0.72) *
      (upperBeam + lowerBeam) *
      (1.0 - crystalInside) *
      (0.030 + uTreble * 0.060);

    float prismThread = pow(
      0.5 +
      0.5 *
      sin(
        point.x * 13.0 +
        point.y * 4.2 +
        fineHaze * 3.4 +
        time * 0.11
      ),
      20.0
    ) * min(1.0, curtainField);
    color += mix(uAccent, vec3(0.82, 0.91, 1.0), 0.52) *
      prismThread *
      (1.0 - crystalInside * 0.88) *
      (0.10 + stageGlow * 0.050 + uMids * 0.06 + uTreble * 0.24);

    float horizon = exp(-abs(point.y + 0.37) * 24.0);
    float reflectionTexture = fbm(vec2(
      point.x * 2.2 - time * 0.018,
      point.y * 7.0 + fineHaze * 0.7
    ));
    color += mix(uGlow, uAccent, reflectionTexture) *
      horizon *
      (1.0 - crystalInside * 0.82) *
      (0.075 + uBass * 0.090);

    float stars = starLayer(
      point + vec2(time * 0.0012, 0.0),
      58.0,
      0.983
    );
    stars += starLayer(
      point * vec2(1.0, 0.82) - vec2(time * 0.0007, 0.0),
      93.0,
      0.991
    ) * 0.72;
    color += mix(vec3(0.76, 0.87, 1.0), uGlow, 0.28) *
      stars *
      (1.0 - crystalInside * 0.90) *
      (0.34 + uTreble * 0.50 + stageGlow * 0.06);

    color *= 1.0 + uBass * 0.080;
    color += mix(uAccent, uGlow, 0.5) *
      filamentField *
      uBass *
      0.050;

    float vignette =
      1.0 -
      smoothstep(
        0.14,
        1.18,
        length(point * vec2(0.68, 1.0))
      );
    color *= 0.44 + vignette * 0.74;
    color += (
      hash21(gl_FragCoord.xy + floor(time * 18.0)) - 0.5
    ) * 0.009;

    gl_FragColor = vec4(max(color, 0.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createShaderColor(value: string, fallback = value): Color {
  const fallbackColor = new Color(fallback);
  if (!CSS.supports("color", value)) return fallbackColor;

  const color = new Color(value);
  const luminance =
    color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  const fallbackLuminance =
    fallbackColor.r * 0.2126 +
    fallbackColor.g * 0.7152 +
    fallbackColor.b * 0.0722;
  if (luminance < 0.07 && fallbackLuminance > luminance) {
    const fallbackMix = Math.min(0.82, (0.07 - luminance) / 0.07);
    color.lerp(fallbackColor, fallbackMix);
  }
  return color;
}

const targetBackground = createShaderColor(props.background);
const targetAccent = createShaderColor(props.accent, props.baseAccent);
const targetGlow = createShaderColor(props.glow, props.baseGlow);
const uniforms = {
  uTime: { value: 0 },
  uAudio: { value: 0 },
  uBass: { value: 0 },
  uMids: { value: 0 },
  uTreble: { value: 0 },
  uStage: { value: 0 },
  uResolution: { value: new Vector2(1, 1) },
  uBackground: { value: targetBackground.clone() },
  uAccent: { value: targetAccent.clone() },
  uGlow: { value: targetGlow.clone() },
};
const cameraPosition = new Vector3(0, 0, 1);
const { invalidate } = useTres();

function updateColor(
  target: Color,
  uniform: Color,
  value: string,
  fallback = value,
): void {
  target.copy(createShaderColor(value, fallback));
  if (props.paused) uniform.copy(target);
  invalidate();
}

watch(
  () => props.background,
  (color) =>
    updateColor(targetBackground, uniforms.uBackground.value, color),
);
watch(
  () => [props.accent, props.baseAccent] as const,
  ([color, fallback]) =>
    updateColor(targetAccent, uniforms.uAccent.value, color, fallback),
);
watch(
  () => [props.glow, props.baseGlow] as const,
  ([color, fallback]) =>
    updateColor(targetGlow, uniforms.uGlow.value, color, fallback),
);

function damp(
  current: number,
  target: number,
  delta: number,
  rise: number,
  fall: number,
): number {
  const rate = target > current ? rise : fall;
  return current + (target - current) * (1 - Math.exp(-delta * rate));
}

let shaderTime = 0;
const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, sizes }) => {
  uniforms.uResolution.value.set(sizes.width.value, sizes.height.value);
  if (props.paused) return;

  const frameDelta = Math.min(0.05, delta);
  const sensitivity = props.sensitivity;
  const bass = Math.min(
    1,
    Math.pow(props.analyzer.bass, 0.62) * sensitivity * 1.55,
  );
  const mids = Math.min(
    1,
    Math.pow(props.analyzer.midrange, 0.72) * sensitivity * 1.38,
  );
  const treble = Math.min(
    1,
    Math.pow(props.analyzer.treble, 0.7) * sensitivity * 1.48,
  );
  const level = Math.min(
    1,
    Math.pow(props.analyzer.rmsVolume, 0.72) * sensitivity * 1.4,
  );
  const envelope = Math.min(
    1,
    props.analyzer.decayingPeakVolume * sensitivity,
  );
  const transient = Math.min(
    1,
    (props.analyzer.beat * 0.7 + props.analyzer.onset * 0.3) * sensitivity,
  );
  const energy = Math.min(
    1,
    level * 0.58 +
      envelope * 0.18 +
      bass * 0.12 +
      mids * 0.08 +
      treble * 0.04 +
      transient * 0.18,
  );

  const stageDrive = Math.min(1, energy * 1.45 + transient * 0.65);
  const targetStage = Math.min(3, Math.max(0, (stageDrive - 0.06) * 3.2));

  uniforms.uAudio.value = damp(
    uniforms.uAudio.value,
    energy,
    frameDelta,
    4.0,
    1.8,
  );
  uniforms.uBass.value = damp(
    uniforms.uBass.value,
    bass,
    frameDelta,
    5.0,
    2.2,
  );
  uniforms.uMids.value = damp(
    uniforms.uMids.value,
    mids,
    frameDelta,
    4.0,
    2.0,
  );
  uniforms.uTreble.value = damp(
    uniforms.uTreble.value,
    treble,
    frameDelta,
    4.5,
    2.4,
  );
  uniforms.uStage.value = damp(
    uniforms.uStage.value,
    targetStage,
    frameDelta,
    3.0,
    1.3,
  );

  const colorTransition = 1 - Math.exp(-frameDelta * 2.8);
  uniforms.uBackground.value.lerp(targetBackground, colorTransition * 0.7);
  uniforms.uAccent.value.lerp(targetAccent, colorTransition);
  uniforms.uGlow.value.lerp(targetGlow, colorTransition);

  shaderTime +=
    frameDelta *
    props.animationSpeed *
    (1 + uniforms.uAudio.value * 0.45 + uniforms.uStage.value * 0.12);
  uniforms.uTime.value = shaderTime;
});
</script>

<template>
  <TresOrthographicCamera :args="[-1, 1, 1, -1, 0.1, 10]" :position="cameraPosition" />
  <TresMesh>
    <TresPlaneGeometry :args="[2, 2]" />
    <TresShaderMaterial
      :uniforms="uniforms"
      :vertex-shader="vertexShader"
      :fragment-shader="fragmentShader"
      :depth-test="false"
      :depth-write="false"
    />
  </TresMesh>
</template>
