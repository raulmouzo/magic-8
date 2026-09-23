"use client";
// @refresh reset -- the three.js scene lives in state; remount it on every edit instead of keeping a stale instance.

import { useCursor } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MathUtils, type PerspectiveCamera } from "three";
import { loadWindowFont } from "./answers";
import { useDeviceTilt, useIsTouch } from "./motion";
import { BALL_RADIUS } from "./geometry";
import {
  type AnswerPicker,
  type AskRequest,
  type BallEvents,
  MagicEightBallScene,
} from "./MagicEightBallScene";

export type BallHandle = {
  /** Exact text, `{ category }`, or `pickAnswer`'s choice. False while animating. */
  ask: (request?: AskRequest) => boolean;
};

type Props = BallEvents & {
  ref?: Ref<BallHandle>;
  /** Hold the entrance until true, e.g. until the background has faded in. */
  canStart?: boolean;
  buttonHighlighted?: boolean;
  pickAnswer?: AnswerPicker;
  onBusyChange?: (busy: boolean) => void;
};

// Share of the viewport's shorter side taken by the ball, halo included.
const VIEWPORT_FILL = {
  mobile: { rest: 0.85, approach: 1.3, zoom: 1.4 },
  tablet: { rest: 0.6, approach: 0.85, zoom: 1.05 },
  desktop: { rest: 0.45, approach: 0.58, zoom: 0.82 },
};
// Share of the zoom range covered by one notch of a mouse wheel (deltaY ≈ 100).
const ZOOM_PER_PIXEL = 0.0015;
// Tailwind's md and lg breakpoints, in CSS pixels.
const TABLET_MIN_WIDTH = 768;
const DESKTOP_MIN_WIDTH = 1024;
const HALO_SCALE = 1.15;

/** Places the camera for the rest size; returns how far the ball travels for the close-ups. */
function fitCamera(
  camera: PerspectiveCamera,
  width: number,
  height: number,
): { approach: number; zoom: number } {
  const aspect = width / height;
  const fill =
    width >= DESKTOP_MIN_WIDTH
      ? VIEWPORT_FILL.desktop
      : width >= TABLET_MIN_WIDTH
        ? VIEWPORT_FILL.tablet
        : VIEWPORT_FILL.mobile;
  const visibleHeight = (2 * BALL_RADIUS * HALO_SCALE) / (fill.rest * Math.min(1, aspect));
  const distance = visibleHeight / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, 0, distance);
  camera.updateProjectionMatrix();
  // On-screen size is inversely proportional to the distance to the camera.
  return {
    approach: distance * (1 - fill.rest / fill.approach),
    zoom: distance * (1 - fill.rest / fill.zoom),
  };
}

export function Ball({
  ref,
  canStart = true,
  buttonHighlighted = false,
  pickAnswer,
  onBusyChange,
  onAsk,
  onReveal,
  onRest,
}: Props) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const canvas = gl.domElement;
  const threeScene = useThree((state) => state.scene);
  const [compiled, setCompiled] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const compileStarted = useRef(false);
  const ready = compiled && fontLoaded;
  // Touch screens have no hover: the ball leans with the phone instead of the pointer.
  const touch = useIsTouch();
  const deviceTilt = useRef({ x: 0, y: 0 });
  useDeviceTilt(deviceTilt, touch);
  const size = useThree((state) => state.size);
  const [scene] = useState(() => new MagicEightBallScene());
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useEffect(() => () => scene.dispose(), [scene]);

  useEffect(() => {
    scene.setBusyListener(onBusyChange ?? null);
    return () => scene.setBusyListener(null);
  }, [scene, onBusyChange]);

  useEffect(() => {
    scene.setAnswerPicker(pickAnswer ?? null);
  }, [scene, pickAnswer]);

  useEffect(() => {
    scene.setButtonHighlighted(buttonHighlighted);
  }, [scene, buttonHighlighted]);

  useEffect(() => {
    scene.setEvents({ onAsk, onReveal, onRest });
  }, [scene, onAsk, onReveal, onRest]);

  useEffect(() => {
    let cancelled = false;
    loadWindowFont()
      .catch(() => {}) // fall back to whatever font is available
      .then(() => {
        if (cancelled) return;
        scene.refreshText();
        setFontLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scene]);

  // Compile the ball's shaders in the background, as if it were already in the
  // scene (same lights and environment), so it never stalls a frame on screen.
  // The environment map changes the shaders, so wait until it exists.
  useFrame(({ camera: frameCamera }) => {
    if (compileStarted.current || !threeScene.environment) return;
    compileStarted.current = true;
    gl.compileAsync(scene.root, frameCamera, threeScene)
      .catch(() => {}) // worst case it compiles on first render instead
      .then(() => setCompiled(true));
  });

  const started = ready && canStart;
  useEffect(() => {
    if (started) scene.start();
  }, [started, scene]);

  useEffect(() => {
    const travel = fitCamera(camera as PerspectiveCamera, size.width, size.height);
    scene.setApproachDistance(travel.approach);
    scene.setZoomDistance(travel.zoom);
    scene.setVerticalShards(size.width < TABLET_MIN_WIDTH);
  }, [camera, scene, size]);

  // Back to centre when the pointer leaves the window or the window loses focus.
  useEffect(() => {
    scene.setPointerPresent(true);
    if (touch) return;
    const handleMove = () => scene.setPointerPresent(true);
    const handleOut = (event: PointerEvent) => {
      if (!event.relatedTarget) scene.setPointerPresent(false);
    };
    const handleBlur = () => scene.setPointerPresent(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerout", handleOut);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerout", handleOut);
      window.removeEventListener("blur", handleBlur);
    };
  }, [scene, touch]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      scene.zoomBy(-event.deltaY * ZOOM_PER_PIXEL);
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [canvas, scene]);

  useImperativeHandle(ref, () => ({ ask: (request) => scene.ask(request) }), [scene]);

  useFrame(({ clock, pointer }, delta) =>
    scene.update(clock.elapsedTime, delta, touch ? deviceTilt.current : pointer),
  );

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    scene.ask();
  };

  return (
    <>
      {started && (
        <primitive
          object={scene.root}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        />
      )}
      <primitive object={scene.lights} />
    </>
  );
}
