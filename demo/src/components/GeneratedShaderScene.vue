<script setup lang="ts">
import { useLoop, useTres } from "@tresjs/core";
import { Color, Vector2, Vector3 } from "three";
import { watch } from "vue";

const props = defineProps<{
  background: string;
  accent: string;
  glow: string;
  baseAccent: string;
  baseGlow: string;
  audioData: Float32Array;
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
  uniform float uBassHit;
  uniform float uBassAge;
  uniform float uClapHit;
  uniform float uClapAge;
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
    mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);

    for (int octave = 0; octave < 5; octave++) {
      value += valueNoise(point) * amplitude;
      point = rotation * point * 2.03 + 19.17;
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
    float star = smoothstep(0.085, 0.0, distanceToStar);
    return star * smoothstep(threshold, 1.0, seed);
  }

  void main() {
    vec2 point = vUv - 0.5;
    point.x *= uResolution.x / max(uResolution.y, 1.0);

    float time = uTime;
    float intensity = uAudio;
    float stageOne = smoothstep(0.35, 0.95, uStage);
    float stageTwo = smoothstep(1.25, 1.95, uStage);
    float stageThree = smoothstep(2.20, 2.90, uStage);

    float sourceRadius = length(point);
    float shockRadius = uBassAge * (0.90 + uBass * 0.75);
    float shockFront = exp(-abs(sourceRadius - shockRadius) * (42.0 - stageTwo * 10.0));
    float shockWarp = shockFront * uBassHit * (0.025 + stageTwo * 0.035);
    point += point / max(sourceRadius, 0.001) * shockWarp;

    float firstNoise = fbm(
      point * (1.65 + stageTwo * 0.28) +
      vec2(time * (0.035 + intensity * 0.025), -time * 0.028)
    );
    vec2 warp = vec2(
      fbm(point * 2.35 + firstNoise + vec2(time * 0.055, 1.7)),
      fbm(point * 2.10 - firstNoise + vec2(-2.4, time * 0.045))
    );
    vec2 warpedPoint = point +
      (warp - 0.5) * (0.42 + intensity * 0.20 + stageThree * 0.12);

    float radius = length(warpedPoint);
    float angle = atan(warpedPoint.y, warpedPoint.x);
    float spiral = sin(
      angle * (5.0 + stageTwo * 2.0) -
      radius * (18.0 + stageThree * 8.0) +
      time * (0.72 + intensity * 0.58) +
      firstNoise * (5.0 + stageOne * 2.0)
    );
    float ribbon = pow(0.5 + 0.5 * spiral, 9.0 - stageThree * 3.0) *
      exp(-radius * 0.72);

    float crossedWaves = abs(
      sin((warpedPoint.x + warp.y) * (10.0 + stageTwo * 5.0) - time * 0.31) *
      cos((warpedPoint.y - warp.x) * 11.0 + time * 0.27)
    );
    float caustics = pow(crossedWaves, 7.0 - stageThree * 2.5);
    float nebula = smoothstep(
      0.18,
      0.92,
      fbm(warpedPoint * (3.0 + stageOne * 0.6) + time * 0.025)
    );

    float breathingRing = exp(
      -abs(radius - (0.24 + 0.10 * sin(time * 0.55))) *
      (30.0 - uBass * 10.0)
    ) * uBass;
    float bassShock = exp(
      -abs(radius - shockRadius) * (46.0 - stageThree * 15.0)
    ) * uBassHit;

    float shardMask = pow(
      abs(sin(angle * (7.0 + stageTwo * 5.0) + firstNoise * 2.5)),
      18.0 - stageThree * 7.0
    );
    float clapShards = shardMask *
      (1.0 - smoothstep(0.12, 1.08, radius)) *
      uClapHit;
    float clapGrid = pow(
      abs(sin((warpedPoint.x + warpedPoint.y) * 24.0 - uClapAge * 13.0)),
      14.0
    ) * uClapHit * (0.25 + stageTwo * 0.75);

    float prismLattice = pow(
      0.5 + 0.5 * sin(angle * 10.0 + radius * 34.0 - time * 1.6),
      14.0
    ) * stageTwo;
    float overloadRays = pow(
      0.5 + 0.5 * cos(angle * 18.0 - radius * 8.0 + time * 2.2),
      22.0
    ) * stageThree * (0.25 + uTreble);

    vec3 color = uBackground * (0.46 + firstNoise * 0.36);
    color = mix(color, uAccent, nebula * 0.54 + ribbon * (0.58 + stageOne * 0.15));
    color = mix(color, uGlow, caustics * (0.26 + intensity * 0.38));
    color += uAccent * breathingRing * 0.38;
    color += mix(uAccent, uGlow, warp.x) *
      ribbon * (0.16 + intensity * 0.36);
    color += mix(uGlow, vec3(0.82, 0.92, 1.0), 0.45) *
      bassShock * (0.48 + stageThree * 0.34);
    color += mix(uAccent, vec3(1.0), 0.62) *
      clapShards * (0.32 + uMids * 0.42);
    color += uGlow * clapGrid * 0.24;
    color += mix(uAccent, uGlow, 0.5) * prismLattice * 0.20;
    color += mix(vec3(0.72, 0.86, 1.0), uGlow, 0.38) *
      overloadRays * 0.38;
    color += vec3(0.88, 0.94, 1.0) * uClapHit * 0.08;

    float starThreshold = mix(0.982, 0.938, min(1.0, uTreble + stageThree * 0.35));
    float stars = starLayer(
      point + warp * 0.08 + time * 0.002,
      56.0,
      starThreshold
    );
    stars += starLayer(
      point - warp * 0.05 - time * 0.001,
      91.0,
      min(0.992, starThreshold + 0.012)
    ) * 0.72;
    stars += starLayer(point + warp * 0.15, 128.0, 0.987) *
      stageThree * 0.55;
    color += mix(vec3(0.72, 0.84, 1.0), uGlow, 0.35) *
      stars * (0.48 + uTreble * 1.55 + stageTwo * 0.32);

    float vignette = smoothstep(
      1.05 + stageThree * 0.18,
      0.20,
      length(point * vec2(0.76, 1.0))
    );
    color *= 0.36 + vignette * 0.82;
    color *= 1.0 + intensity * 0.16 + stageThree * 0.10;
    color += (
      hash21(gl_FragCoord.xy + floor(time * (24.0 + uTreble * 42.0))) - 0.5
    ) * (0.016 + uTreble * 0.025);

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
  uBassHit: { value: 0 },
  uBassAge: { value: 10 },
  uClapHit: { value: 0 },
  uClapAge: { value: 10 },
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

function stereoBandEnergy(start: number, end: number): number {
  let energy = 0;
  for (let index = start; index <= end; index++) {
    energy +=
      (props.audioData[index] ?? 0) + (props.audioData[index + 64] ?? 0);
  }
  return energy / ((end - start + 1) * 2);
}

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
let detectorWarmup = 0;
let bassBaseline = 0;
let clapBaseline = 0;
let previousBass = 0;
let previousClap = 0;
let bassAge = 10;
let clapAge = 10;
let bassCooldown = 0;
let clapCooldown = 0;
const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, sizes }) => {
  uniforms.uResolution.value.set(sizes.width.value, sizes.height.value);
  if (props.paused) return;

  const frameDelta = Math.min(0.05, delta);
  const sensitivity = props.sensitivity;
  const bass = Math.min(1, stereoBandEnergy(0, 11) * sensitivity * 1.18);
  const mids = Math.min(1, stereoBandEnergy(12, 39) * sensitivity * 1.08);
  const treble = Math.min(1, stereoBandEnergy(40, 63) * sensitivity * 1.22);
  const clap = Math.min(1, mids * 0.68 + treble * 0.62);
  const energy = Math.min(1, bass * 0.45 + mids * 0.35 + treble * 0.28);

  detectorWarmup += frameDelta;
  bassCooldown = Math.max(0, bassCooldown - frameDelta);
  clapCooldown = Math.max(0, clapCooldown - frameDelta);
  bassAge = Math.min(10, bassAge + frameDelta);
  clapAge = Math.min(10, clapAge + frameDelta);

  const bassRise = bass - previousBass;
  const clapRise = clap - previousClap;
  if (
    detectorWarmup > 0.3 &&
    bassCooldown === 0 &&
    bass > Math.max(0.11, bassBaseline * 1.30) &&
    bassRise > Math.max(0.024, bassBaseline * 0.16)
  ) {
    bassAge = 0;
    bassCooldown = 0.15;
  }
  if (
    detectorWarmup > 0.3 &&
    clapCooldown === 0 &&
    clap > Math.max(0.10, clapBaseline * 1.34) &&
    clapRise > Math.max(0.026, clapBaseline * 0.18) &&
    treble + mids > bass * 0.72
  ) {
    clapAge = 0;
    clapCooldown = 0.11;
  }

  const bassBaselineRate = bass > bassBaseline ? 1.20 : 0.38;
  const clapBaselineRate = clap > clapBaseline ? 1.35 : 0.42;
  bassBaseline +=
    (bass - bassBaseline) * (1 - Math.exp(-frameDelta * bassBaselineRate));
  clapBaseline +=
    (clap - clapBaseline) * (1 - Math.exp(-frameDelta * clapBaselineRate));
  previousBass = bass;
  previousClap = clap;

  const bassHit = Math.exp(-bassAge * 5.2);
  const clapHit = Math.exp(-clapAge * 8.5);
  const stageDrive = Math.min(
    1,
    energy * 1.48 + Math.max(bassHit, clapHit) * 0.18,
  );
  const targetStage =
    stageDrive > 0.72 ? 3 : stageDrive > 0.47 ? 2 : stageDrive > 0.20 ? 1 : 0;

  uniforms.uAudio.value = damp(
    uniforms.uAudio.value,
    energy,
    frameDelta,
    10,
    3.2,
  );
  uniforms.uBass.value = damp(
    uniforms.uBass.value,
    bass,
    frameDelta,
    14,
    4,
  );
  uniforms.uMids.value = damp(
    uniforms.uMids.value,
    mids,
    frameDelta,
    13,
    4.5,
  );
  uniforms.uTreble.value = damp(
    uniforms.uTreble.value,
    treble,
    frameDelta,
    16,
    6,
  );
  uniforms.uBassHit.value = bassHit;
  uniforms.uBassAge.value = bassAge;
  uniforms.uClapHit.value = clapHit;
  uniforms.uClapAge.value = clapAge;
  uniforms.uStage.value = damp(
    uniforms.uStage.value,
    targetStage,
    frameDelta,
    5.5,
    1.5,
  );

  const colorTransition = 1 - Math.exp(-frameDelta * 2.8);
  uniforms.uBackground.value.lerp(targetBackground, colorTransition * 0.7);
  uniforms.uAccent.value.lerp(targetAccent, colorTransition);
  uniforms.uGlow.value.lerp(targetGlow, colorTransition);

  shaderTime +=
    frameDelta *
    props.animationSpeed *
    (1 + uniforms.uAudio.value * 0.22 + uniforms.uStage.value * 0.08);
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
