import type { QualityLevel } from "../graphics-quality";
import type { ShaderQuality } from "./materials";

export type BallQuality = ShaderQuality & {
  /** Cap on the canvas pixel ratio. */
  maxDpr: number;
  /** Cap on how often the ball is drawn; animations still advance every frame. */
  maxFps: number;
  /** Real refraction through the lens, or reflections only (no second scene render). */
  refraction: boolean;
  /** Size of the texture the refracting lens samples, relative to the canvas. */
  transmissionScale: number;
};

// "high" is the original look. The lower levels drop what's least visible
// at their pixel ratio first: noise octaves finer than a pixel, then the
// wear details and the lens refraction.
export const BALL_QUALITY: Record<QualityLevel, BallQuality> = {
  high: {
    maxDpr: 2,
    maxFps: Infinity,
    noiseOctaves: 6,
    surfaceWear: true,
    refraction: true,
    transmissionScale: 1,
  },
  medium: {
    maxDpr: 1.5,
    maxFps: 60,
    noiseOctaves: 4,
    surfaceWear: true,
    refraction: true,
    transmissionScale: 0.5,
  },
  low: {
    maxDpr: 1,
    maxFps: 30,
    noiseOctaves: 3,
    surfaceWear: false,
    refraction: false,
    transmissionScale: 0.5,
  },
};
