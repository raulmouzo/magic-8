import {
  type BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";

export const BALL_RADIUS = 2;

// Polar angle of the window opening, measured from the axis facing the camera.
const WINDOW_ANGLE = 0.47;
const WINDOW_RADIUS = BALL_RADIUS * Math.sin(WINDOW_ANGLE);
const WINDOW_Z = BALL_RADIUS * Math.cos(WINDOW_ANGLE);
const WELL_DEPTH = 0.32;
const WELL_TAPER = 0.92;
export const LIQUID_RADIUS = WINDOW_RADIUS * WELL_TAPER;

// three builds spheres and cylinders around +Y; turn them so +Y faces the camera (+Z).
const facingCamera = <T extends BufferGeometry>(geometry: T): T =>
  geometry.rotateX(Math.PI / 2);

export const createShellGeometry = () =>
  facingCamera(
    new SphereGeometry(BALL_RADIUS, 160, 120, 0, Math.PI * 2, WINDOW_ANGLE, Math.PI - WINDOW_ANGLE),
  );

export const createLensGeometry = () =>
  facingCamera(new SphereGeometry(BALL_RADIUS, 160, 24, 0, Math.PI * 2, 0, WINDOW_ANGLE));

export const createBezelGeometry = () =>
  new TorusGeometry(WINDOW_RADIUS, 0.045, 32, 160).translate(0, 0, WINDOW_Z);

export const createWellGeometry = () =>
  facingCamera(
    new CylinderGeometry(WINDOW_RADIUS, WINDOW_RADIUS * WELL_TAPER, WELL_DEPTH, 160, 1, true),
  ).translate(0, 0, WINDOW_Z - WELL_DEPTH / 2);

export const createLiquidGeometry = () =>
  new CircleGeometry(LIQUID_RADIUS, 160).translate(0, 0, WINDOW_Z - WELL_DEPTH);

/** Its back faces render the halo. */
export const createHaloGeometry = () => new SphereGeometry(BALL_RADIUS * 1.2, 96, 64);
