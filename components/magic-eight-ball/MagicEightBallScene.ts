import {
  type CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  PointLight,
  Vector2,
  type Vector2Like,
  Vector3,
} from "three";
import {
  type AnswerCategory,
  ZOOM_QUIPS,
  createAnswerTexture,
  createSigilTexture,
  randomAnswer,
} from "./answers";
import {
  BALL_RADIUS,
  createBezelGeometry,
  createHaloGeometry,
  createLensGeometry,
  createLiquidGeometry,
  createShellGeometry,
  createWellGeometry,
} from "./geometry";
import {
  PALETTE,
  createBallUniforms,
  createBezelMaterial,
  createHaloMaterial,
  createLensMaterial,
  createLiquidMaterial,
  createShellMaterial,
  createWellMaterial,
} from "./materials";

type Track = {
  target: { value: number };
  from: number;
  to: number;
  start: number; // ms from the start of the timeline
  duration: number; // ms
};

type Cue = { at: number; run: () => void; done?: boolean };

type Timeline = {
  tracks: Track[]; // in start order: a later track overrides an earlier one on the same target
  cues: Cue[];
  end: number;
  startedAt: number | null;
};

type BusyListener = (busy: boolean) => void;
export type AnswerPicker = () => string;
/** What to show: exact text, a random answer from a category, or (omitted) the answer picker's choice. */
export type AskRequest = string | { category: AnswerCategory };
export type BallEvents = {
  onAsk?: () => void;
  onReveal?: (answer: string) => void;
  onRest?: () => void;
};

const TILT = { x: 0.3, y: 0.4 };

const CLOSE_FLOAT = { amplitude: 0.12, period: 3.2 }; // world units, seconds
// Timeline of a question, in ms: when the answer appears and when the ball goes back to rest.
const ANSWER_AT = 3000;
const REST_AT = 7600;
// Zoom share that triggers a quip, and the lower one that removes it (hysteresis).
const QUIP_ZOOM = { show: 0.92, hide: 0.6, delay: 0.4 }; // delay in seconds

const FACE_VIEWER_FOR = 2000;

const KEY_LIGHT = { intensity: 1.4, position: [-4, 5, 6] } as const;

// Not a real light, which would leave a crisp highlight: the shell adds it as
// diffuse light only and the environment shows a blurred reflection of it.
export const BUTTON_POSITION = new Vector3(0, -BALL_RADIUS * 1.8, BALL_RADIUS * 1.1);
const BUTTON_GLOW = { color: PALETTE.accent, strength: 0.45, screenIntensity: 11 };
const BUTTON_HIGHLIGHT_BOOST = 2.4;

// Behind the ball, so from the front they only light its rim.
const SHARD_SWEEP = BALL_RADIUS * 3; // half-width of their path
const SHARD_LIGHTS = [
  { color: PALETTE.accent, intensity: 60, speed: 1.1, y: 1.6, z: -BALL_RADIUS * 1.5, phase: 0 },
  { color: PALETTE.shard, intensity: 45, speed: 0.7, y: -1.4, z: -BALL_RADIUS * 1.7, phase: 0.45 },
  { color: PALETTE.mist, intensity: 25, speed: 0.9, y: 0.3, z: -BALL_RADIUS * 1.4, phase: 0.8 },
];
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Imperative three.js side of the ball: builds the meshes, runs the
 * animations and swaps the answer texture. React only mounts `root`
 * and forwards frames and clicks.
 */
export class MagicEightBallScene {
  readonly root = new Group();
  /** Lights standing in for the page around the ball; they do not tilt with it. */
  readonly lights = new Group();
  private readonly keyLight = new DirectionalLight("#fff4ea", KEY_LIGHT.intensity);
  private readonly buttonColor = new Color(BUTTON_GLOW.color);
  private readonly shardLights = SHARD_LIGHTS.map((l) => new PointLight(l.color, 0));

  private readonly uniforms = createBallUniforms();
  private readonly appear = { value: 0 };
  private readonly approach = { value: 0 };
  private readonly facing = { value: 0 };
  private buttonHighlighted = false;
  private pointerPresent = true;
  private verticalShards = false;
  private approachDistance = BALL_RADIUS * 2;
  /** Scroll zoom amount in 0–1; zoomDistance is how far 1 moves the ball. */
  private zoomDistance = BALL_RADIUS * 3;
  private zoom = 0;
  private zoomTarget = 0;
  private closeZoomTime = 0;
  /** Text to restore once the zoom quip goes away. */
  private textBeforeQuip: (() => CanvasTexture) | null = null;
  private lastQuip = "";
  private buttonBoost = 1;
  private events: BallEvents = {};
  /** True between onAsk and onRest, so listeners are never left waiting. */
  private questionInProgress = false;
  private readonly tilt = new Vector2();
  private drawText: () => CanvasTexture = createSigilTexture;
  private textTexture: CanvasTexture | null = null;
  private pickAnswer: AnswerPicker = () => randomAnswer();
  private timeline: Timeline | null = null;
  // Busy until start(), so nothing can be asked before the ball is on screen.
  private busy = true;
  private busyListener: BusyListener | null = null;

  constructor() {
    this.root.add(
      new Mesh(createShellGeometry(), createShellMaterial(this.uniforms)),
      new Mesh(createBezelGeometry(), createBezelMaterial()),
      new Mesh(createWellGeometry(), createWellMaterial()),
      new Mesh(createLiquidGeometry(), createLiquidMaterial(this.uniforms)),
      new Mesh(createLensGeometry(), createLensMaterial()),
    );

    const halo = new Mesh(createHaloGeometry(), createHaloMaterial(this.uniforms));
    halo.raycast = () => {}; // clicks on the glow should not count as clicks on the ball
    this.root.add(halo);

    this.keyLight.position.set(...KEY_LIGHT.position);
    this.lights.add(this.keyLight, ...this.shardLights);

    this.setText(createSigilTexture);
  }

  /** Plays the entrance; call once the ball is in the scene and ready to render. */
  start(): void {
    this.play(
      [
        { target: this.appear, from: 0, to: 1, start: 0, duration: 1400 },
        { target: this.uniforms.textVisibility, from: 0, to: 1, start: 500, duration: 1200 },
      ],
      [],
    );
  }

  setBusyListener(listener: BusyListener | null): void {
    this.busyListener = listener;
    listener?.(this.busy);
  }

  setApproachDistance(distance: number): void {
    this.approachDistance = distance;
  }

  setZoomDistance(distance: number): void {
    this.zoomDistance = distance;
  }

  zoomBy(amount: number): void {
    this.zoomTarget = MathUtils.clamp(this.zoomTarget + amount, 0, 1);
  }

  /** On phones the background is turned 90°, so the lights behind the ball go top to bottom. */
  setVerticalShards(vertical: boolean): void {
    this.verticalShards = vertical;
  }

  setPointerPresent(present: boolean): void {
    this.pointerPresent = present;
  }

  setButtonHighlighted(highlighted: boolean): void {
    this.buttonHighlighted = highlighted;
  }

  setEvents(events: BallEvents): void {
    this.events = events;
  }

  setAnswerPicker(picker: AnswerPicker | null): void {
    this.pickAnswer = picker ?? (() => randomAnswer());
  }

  /** Redraws the current text, e.g. once the web font has loaded. */
  refreshText(): void {
    this.setText(this.drawText);
  }

  /** Returns false (and does nothing) while animating. */
  ask(request?: AskRequest): boolean {
    if (this.busy) return false;
    this.textBeforeQuip = null;
    const { textVisibility, agitation } = this.uniforms;
    this.play(
      [
        { target: textVisibility, from: textVisibility.value, to: 0, start: 0, duration: 450 },
        { target: this.approach, from: this.approach.value, to: 1, start: 0, duration: 1100 },
        { target: agitation, from: 0, to: 1, start: 0, duration: 350 },
        { target: agitation, from: 1, to: 0, start: 2600, duration: 900 },
        { target: textVisibility, from: 0, to: 1, start: ANSWER_AT + 100, duration: 1300 },
        { target: this.facing, from: this.facing.value, to: 1, start: ANSWER_AT, duration: 500 },
        { target: this.facing, from: 1, to: 0, start: ANSWER_AT + FACE_VIEWER_FOR, duration: 700 },
        { target: this.approach, from: 1, to: 0, start: REST_AT, duration: 1600 },
        { target: textVisibility, from: 1, to: 0, start: REST_AT, duration: 700 },
        { target: textVisibility, from: 0, to: 1, start: REST_AT + 800, duration: 1200 },
      ],
      [
        {
          at: ANSWER_AT,
          run: () => {
            const text =
              request === undefined
                ? this.pickAnswer()
                : typeof request === "string"
                  ? request
                  : randomAnswer(request.category);
            this.setText(() => createAnswerTexture(text));
            this.uniforms.quip.value = 0;
            this.events.onReveal?.(text);
          },
        },
        { at: ANSWER_AT + 1400, run: () => this.setBusy(false) },
        { at: REST_AT, run: () => this.finishQuestion() },
        { at: REST_AT + 750, run: () => this.setText(createSigilTexture) },
      ],
    );
    this.questionInProgress = true;
    this.events.onAsk?.();
    return true;
  }

  /** Call once per frame. `pointer` is in normalised device coordinates. */
  update(elapsedSeconds: number, deltaSeconds: number, pointer: Vector2Like): void {
    const { time, swirl, agitation, haloIntensity } = this.uniforms;
    time.value = elapsedSeconds;
    swirl.value += deltaSeconds * (0.15 + agitation.value * 4);
    this.advance(elapsedSeconds * 1000);

    const follow = 1 - Math.exp(-deltaSeconds * 3);
    const tracking = this.pointerPresent ? 1 - this.facing.value : 0;
    this.tilt.x += (pointer.y * TILT.x * tracking - this.tilt.x) * follow;
    this.tilt.y += (pointer.x * TILT.y * tracking - this.tilt.y) * follow;
    this.root.rotation.set(-this.tilt.x, this.tilt.y, 0);
    const close = MathUtils.smoothstep(this.approach.value, 0.7, 1);
    const float =
      Math.sin((elapsedSeconds * Math.PI * 2) / CLOSE_FLOAT.period) * CLOSE_FLOAT.amplitude * close;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-deltaSeconds * 8));
    this.updateZoomQuip(deltaSeconds);
    // Closest wins, so the answer close-up and the scroll zoom never add up.
    this.root.position.set(
      0,
      Math.sin(elapsedSeconds * 0.9) * 0.06 + float,
      Math.max(this.approach.value * this.approachDistance, this.zoom * this.zoomDistance),
    );
    this.root.scale.setScalar(MathUtils.lerp(0.85, 1, this.appear.value));

    const target = this.buttonHighlighted ? BUTTON_HIGHLIGHT_BOOST : 1;
    this.buttonBoost += (target - this.buttonBoost) * (1 - Math.exp(-deltaSeconds * 6));
    this.updateLights(elapsedSeconds);

    haloIntensity.value =
      this.appear.value * (0.35 + agitation.value * 0.5 + Math.sin(elapsedSeconds * 1.3) * 0.05);
  }

  dispose(): void {
    // Unmounted mid-question (e.g. hot reload): don't leave listeners waiting.
    this.finishQuestion();
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    this.textTexture?.dispose();
  }

  private updateLights(elapsedSeconds: number): void {
    this.updateShardLights(elapsedSeconds);
    const button =
      this.buttonBoost * this.appear.value * (1 + Math.sin(elapsedSeconds * 1.3) * 0.08);

    const { buttonGlow, buttonDirection } = this.uniforms;
    buttonGlow.value.copy(this.buttonColor).multiplyScalar(BUTTON_GLOW.strength * button);
    buttonDirection.value.copy(BUTTON_POSITION).sub(this.root.position).normalize();

    const { keyLightDirection, keyLightColor, pointLightPositions, pointLightColors } = this.uniforms;
    keyLightDirection.value.copy(this.keyLight.position).normalize();
    keyLightColor.value.copy(this.keyLight.color).multiplyScalar(this.keyLight.intensity);
    pointLightPositions.value[0].copy(BUTTON_POSITION);
    pointLightColors.value[0]
      .copy(this.buttonColor)
      .multiplyScalar(BUTTON_GLOW.screenIntensity * button);
    this.shardLights.forEach((light, i) => {
      pointLightPositions.value[i + 1].copy(light.position);
      pointLightColors.value[i + 1].copy(light.color).multiplyScalar(light.intensity);
    });
  }

  private updateShardLights(elapsedSeconds: number): void {
    this.shardLights.forEach((light, i) => {
      const { intensity, speed, y, z, phase } = SHARD_LIGHTS[i];
      const pass = (phase + (elapsedSeconds * speed) / (2 * SHARD_SWEEP)) % 1;
      const along = MathUtils.lerp(-SHARD_SWEEP, SHARD_SWEEP, pass);
      const across = y + Math.sin(elapsedSeconds * 0.6 + phase * 6) * 0.4;
      // A 90° clockwise turn maps left→right onto top→bottom.
      if (this.verticalShards) light.position.set(-across, -along, z);
      else light.position.set(along, across, z);
      light.intensity = intensity * Math.sin(Math.PI * pass) ** 2 * this.appear.value;
    });
  }

  private updateZoomQuip(deltaSeconds: number): void {
    if (this.busy || this.questionInProgress) {
      this.closeZoomTime = 0;
      return;
    }
    if (!this.textBeforeQuip) {
      this.closeZoomTime = this.zoom > QUIP_ZOOM.show ? this.closeZoomTime + deltaSeconds : 0;
      if (this.closeZoomTime < QUIP_ZOOM.delay) return;
      this.closeZoomTime = 0;
      const options = ZOOM_QUIPS.filter((quip) => quip !== this.lastQuip);
      const quip = options[Math.floor(Math.random() * options.length)];
      this.lastQuip = quip;
      this.textBeforeQuip = this.drawText;
      this.swapText(() => createAnswerTexture(quip, { exclaim: true }), true);
    } else if (this.zoom < QUIP_ZOOM.hide) {
      const previous = this.textBeforeQuip;
      this.textBeforeQuip = null;
      this.swapText(previous, false);
    }
  }

  private swapText(draw: () => CanvasTexture, quip: boolean): void {
    const { textVisibility } = this.uniforms;
    this.play(
      [
        { target: textVisibility, from: textVisibility.value, to: 0, start: 0, duration: 400 },
        { target: textVisibility, from: 0, to: 1, start: 500, duration: 800 },
      ],
      [
        {
          at: 450,
          run: () => {
            this.setText(draw);
            this.uniforms.quip.value = quip ? 1 : 0;
          },
        },
      ],
    );
  }

  private finishQuestion(): void {
    if (!this.questionInProgress) return;
    this.questionInProgress = false;
    this.events.onRest?.();
  }

  private setText(draw: () => CanvasTexture): void {
    this.textTexture?.dispose();
    this.drawText = draw;
    this.textTexture = draw();
    this.uniforms.text.value = this.textTexture;
  }

  private play(tracks: Track[], cues: Cue[]): void {
    const end = Math.max(...tracks.map((t) => t.start + t.duration), ...cues.map((c) => c.at));
    this.timeline = { tracks, cues, end, startedAt: null };
    this.setBusy(true);
  }

  private advance(now: number): void {
    const tl = this.timeline;
    if (!tl) return;

    tl.startedAt ??= now;
    const elapsed = now - tl.startedAt;

    for (const track of tl.tracks) {
      if (elapsed < track.start) continue;
      const progress = Math.min((elapsed - track.start) / track.duration, 1);
      track.target.value = MathUtils.lerp(track.from, track.to, easeInOut(progress));
    }
    for (const cue of tl.cues) {
      if (cue.done || elapsed < cue.at) continue;
      cue.done = true;
      cue.run();
    }

    if (elapsed >= tl.end) {
      this.timeline = null;
      if (this.busy) this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.busyListener?.(busy);
  }
}
