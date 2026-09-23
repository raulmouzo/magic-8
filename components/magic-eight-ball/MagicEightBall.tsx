"use client";

// Magic 8-Ball, originally based on cywarr/Magic8Ball
// (https://github.com/cywarr/Magic8Ball, MIT License, Copyright (c) 2020 cywarr)
// and since redesigned. See the Credits section of the README.

import { Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { Ref } from "react";
import { AdditiveBlending, BackSide } from "three";
import { Ball, type BallHandle } from "./Ball";
import { BUTTON_REFLECTION_SHADER, GALAXY_SHADER } from "./materials";
import { BUTTON_POSITION } from "./MagicEightBallScene";
import type { AnswerPicker, BallEvents } from "./MagicEightBallScene";

export type { BallHandle as MagicEightBallHandle };
export { ANSWERS, type AnswerCategory, randomAnswer } from "./answers";

type Props = BallEvents & {
  /** Imperative API: `ref.current.ask()`, `ref.current.ask({ category: "no" })` or `ref.current.ask("Yes")`. */
  ref?: Ref<BallHandle>;
  buttonHighlighted?: boolean;
  /** Used when `ask` gets no answer, including clicks on the ball. */
  pickAnswer?: AnswerPicker;
  /** Called with true while an animation runs and `ask` is ignored. */
  onBusyChange?: (busy: boolean) => void;
  className?: string;
};

// Far along the direction of the button, inside the sky dome.
const BUTTON_REFLECTION_POSITION = BUTTON_POSITION.clone().normalize().multiplyScalar(30);

export function MagicEightBall({ className = "", ...ballProps }: Props) {
  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 32 }}>
        {/* Reflections only; the lighting comes from the scene. */}
        <Environment resolution={512} environmentIntensity={0.6}>
          <mesh scale={50}>
            <sphereGeometry args={[1, 64, 32]} />
            <shaderMaterial args={[GALAXY_SHADER]} side={BackSide} />
          </mesh>
          <mesh
            position={BUTTON_REFLECTION_POSITION}
            scale={[16, 4, 1]}
            onUpdate={(mesh) => mesh.lookAt(0, 0, 0)}
          >
            <planeGeometry />
            {/* Additive, so only the glow counts and the plane's dark corners don't hide the sky. */}
            <shaderMaterial
              args={[BUTTON_REFLECTION_SHADER]}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </Environment>
        <Ball {...ballProps} />
      </Canvas>
    </div>
  );
}
