import {
  AdditiveBlending,
  BackSide,
  Color,
  type IUniform,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  type Texture,
  Vector3,
} from "three";
import { LIQUID_RADIUS } from "./geometry";
import { fbm } from "./shaders";

// Matches the AeroShards background defaults so the ball feels part of it.
export const PALETTE = {
  body: "#6f5c9c",
  ink: "#07040d",
  nebula: "#3b1d6e",
  face: "#1c1236",
  shard: "#896ABD",
  accent: "#A855F7",
  mist: "#F3E8FF",
  pearl: "#b9aad6",
  quip: "#FBBF24",
};

export type BallUniforms = {
  time: IUniform<number>;
  swirl: IUniform<number>;
  agitation: IUniform<number>;
  textVisibility: IUniform<number>;
  text: IUniform<Texture | null>;
  haloIntensity: IUniform<number>;
  /** Scene lights, mirrored every frame so the unlit liquid shader can react to them. */
  keyLightDirection: IUniform<Vector3>;
  keyLightColor: IUniform<Color>;
  pointLightPositions: IUniform<Vector3[]>;
  pointLightColors: IUniform<Color[]>;
  /** 1 while the window shows a zoom quip instead of an answer: its glow turns amber. */
  quip: IUniform<number>;
  /** Violet bounce from the ask button, added to the shell's diffuse light only. */
  buttonGlow: IUniform<Color>;
  buttonDirection: IUniform<Vector3>;
};

export const POINT_LIGHT_COUNT = 4;

export const createBallUniforms = (): BallUniforms => ({
  time: { value: 0 },
  swirl: { value: 0 },
  agitation: { value: 0 },
  textVisibility: { value: 0 },
  text: { value: null },
  haloIntensity: { value: 0 },
  keyLightDirection: { value: new Vector3(0, 0, 1) },
  keyLightColor: { value: new Color(0) },
  pointLightPositions: { value: Array.from({ length: POINT_LIGHT_COUNT }, () => new Vector3()) },
  pointLightColors: { value: Array.from({ length: POINT_LIGHT_COUNT }, () => new Color(0)) },
  quip: { value: 0 },
  buttonGlow: { value: new Color(0) },
  buttonDirection: { value: new Vector3(0, -1, 0) },
});

// Perturbs a view-space normal by the screen-space slope of a height value.
// Adapted from three.js's bumpmap_pars_fragment chunk (perturbNormalArb, MIT).
const bumpNormal = /* glsl */ `
  vec3 bumpNormal(vec3 surfacePosition, vec3 surfaceNormal, float height) {
    vec3 sigmaX = dFdx(surfacePosition);
    vec3 sigmaY = dFdy(surfacePosition);
    vec3 r1 = cross(sigmaY, surfaceNormal);
    vec3 r2 = cross(surfaceNormal, sigmaX);
    float det = dot(sigmaX, r1);
    vec3 grad = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
    return normalize(abs(det) * surfaceNormal - grad);
  }
`;

// Surface wear. Scratches: some cells of a 3D grid hold a short segment,
// visible where it crosses the surface.
const wear = /* glsl */ `
  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float surfaceScratches(vec3 p) {
    const float cell = 0.35;
    vec3 base = floor(p / cell);
    float pixel = length(fwidth(p));
    float scratch = 0.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 id = base + vec3(x, y, z);
      vec3 h = hash33(id);
      vec3 k = hash33(id + 19.19);

      if (k.x < 0.3) {
        vec3 center = (id + h) * cell;
        vec3 dir = normalize(hash33(id + 7.3) * 2.0 - 1.0);
        float halfLength = mix(0.08, 0.3, k.y);
        vec3 rel = p - center;
        float t = clamp(dot(rel, dir), -halfLength, halfLength);
        float d = length(rel - dir * t);
        float width = mix(0.003, 0.008, k.z) * (1.0 - abs(t) / halfLength);
        // Fade scratches thinner than a pixel instead of letting them shimmer.
        float line = (1.0 - smoothstep(0.0, width + pixel, d)) * clamp(width / pixel, 0.0, 1.0);
        scratch = max(scratch, line * mix(0.35, 1.0, h.x));
      }

    }
    return scratch;
  }

  float surfaceNicks(vec3 p, float pixel) {
    const float cell = 0.3;
    vec3 base = floor(p / cell);
    float nick = 0.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 id = base + vec3(x, y, z);
      vec3 k = hash33(id + 83.0);
      if (k.x > 0.15) continue;

      vec3 center = (id + hash33(id + 89.0)) * cell;
      vec3 dir = normalize(hash33(id + 97.0) * 2.0 - 1.0);
      vec3 rel = p - center;
      float along = dot(rel, dir);
      float d = length(rel - dir * along + dir * along / mix(1.0, 2.5, k.z));
      float radius = mix(0.005, 0.025, k.y * k.y * k.y) * (0.7 + noise(p * 90.0 + id) * 0.6);
      nick = max(nick, (1.0 - smoothstep(radius * 0.6, radius + pixel, d)) * mix(0.5, 1.0, k.z));
    }
    return nick;
  }

  float surfaceHaze(vec3 p) {
    float areas = smoothstep(0.55, 0.8, fbm(p * 1.5 + 20.0));
    float streaks = fbm(vec3(p.x * 12.0, p.y * 3.0, p.z * 12.0));
    return areas * (0.5 + streaks * 0.5);
  }
`;

/** The clearcoat keeps the smooth normal, like varnish over a textured body. */
export const createShellMaterial = (uniforms: BallUniforms) => {
  const material = new MeshPhysicalMaterial({
    color: PALETTE.body,
    roughness: 0.6,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    sheen: 0.25,
    sheenColor: new Color(PALETTE.shard),
    sheenRoughness: 0.6,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.buttonGlow = uniforms.buttonGlow;
    shader.uniforms.buttonDirection = uniforms.buttonDirection;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjectPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjectPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vObjectPosition;
        uniform vec3 buttonGlow;
        uniform vec3 buttonDirection;
        ${fbm}
        ${bumpNormal}
        ${wear}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= 0.9 + fbm(vObjectPosition * 1.6) * 0.2;
        float wearPixel = length(fwidth(vObjectPosition));
        // x: scratches, y: nicks, z: haze.
        vec3 wearAmount = vec3(
          surfaceScratches(vObjectPosition),
          surfaceNicks(vObjectPosition, wearPixel),
          surfaceHaze(vObjectPosition)
        );
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.5 + 0.04, wearAmount.x * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.6 + 0.3, wearAmount.y * 0.6);
        diffuseColor.rgb += wearAmount.z * 0.05;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (fbm(vObjectPosition * 3.0) - 0.5) * 0.25, 0.0, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.35, wearAmount.x * 0.5);
        roughnessFactor = mix(roughnessFactor, 0.75, wearAmount.y);
        roughnessFactor = min(roughnessFactor + wearAmount.z * 0.15, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float grain = fbm(vObjectPosition * 18.0) * 0.65 + fbm(vObjectPosition * 55.0) * 0.35;
        float surfaceHeight = grain * 0.0035 - wearAmount.x * 0.0015 - wearAmount.y * 0.002;
        normal = bumpNormal(-vViewPosition, normal, surfaceHeight);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
        material.clearcoat *= 1.0 - wearAmount.y;
        material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.7, wearAmount.z);`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        float buttonFacing = max(dot(inverseTransformDirection(normal, viewMatrix), buttonDirection) * 0.5 + 0.5, 0.0);
        reflectedLight.indirectDiffuse += material.diffuseColor * buttonGlow * pow(buttonFacing, 3.0);`,
      );
  };
  return material;
};

/** Rust under the paint: it only shows as small blisters, never as colour. */
export const createBezelMaterial = () => {
  const material = new MeshPhysicalMaterial({
    color: PALETTE.pearl,
    metalness: 0.6,
    roughness: 0.5,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjectPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjectPosition = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vObjectPosition;
        ${fbm}
        ${bumpNormal}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float rust = smoothstep(0.6, 0.72, fbm(vObjectPosition * 22.0 + 3.0));
        float pits = fbm(vObjectPosition * 70.0);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.75, rust * 0.6);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        normal = bumpNormal(-vViewPosition, normal, rust * (0.5 + pits * 0.5) * 0.0035);`,
      );
  };
  return material;
};

export const createWellMaterial = () =>
  new MeshStandardMaterial({
    color: PALETTE.ink,
    roughness: 0.5,
    metalness: 0.2,
    side: BackSide,
  });

export const createLensMaterial = () =>
  new MeshPhysicalMaterial({
    transmission: 1,
    thickness: 0.4,
    ior: 1.45,
    roughness: 0.07,
    clearcoat: 0.5,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.6,
    specularIntensity: 0.7,
    attenuationColor: new Color(PALETTE.mist),
  });

/** The die's outline layers are offset by the view angle so it reads as depth. */
export const createLiquidMaterial = (uniforms: BallUniforms) =>
  new ShaderMaterial({
    uniforms: {
      time: uniforms.time,
      swirl: uniforms.swirl,
      agitation: uniforms.agitation,
      textVisibility: uniforms.textVisibility,
      text: uniforms.text,
      quip: uniforms.quip,
      quipColor: { value: new Color(PALETTE.quip) },
      keyLightDirection: uniforms.keyLightDirection,
      keyLightColor: uniforms.keyLightColor,
      pointLightPositions: uniforms.pointLightPositions,
      pointLightColors: uniforms.pointLightColors,
      liquidRadius: { value: LIQUID_RADIUS },
      inkColor: { value: new Color(PALETTE.ink) },
      nebulaColor: { value: new Color(PALETTE.nebula) },
      faceColor: { value: new Color(PALETTE.face) },
      glowColor: { value: new Color(PALETTE.accent) },
      textColor: { value: new Color(PALETTE.mist) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewDir;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
        // View ray in object space, where the liquid disc faces +Z.
        vec3 objectCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        vViewDir = position - objectCamera;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #define LAYERS 5
      #define POINT_LIGHTS ${POINT_LIGHT_COUNT}
      #define TRIANGLE_SIZE 0.52
      #define TEXT_SCALE 2.1

      uniform float time;
      uniform float swirl;
      uniform float agitation;
      uniform float textVisibility;
      uniform sampler2D text;
      uniform float liquidRadius;
      uniform vec3 inkColor;
      uniform vec3 nebulaColor;
      uniform vec3 faceColor;
      uniform vec3 glowColor;
      uniform vec3 textColor;
      uniform float quip;
      uniform vec3 quipColor;
      uniform vec3 keyLightDirection;
      uniform vec3 keyLightColor;
      uniform vec3 pointLightPositions[POINT_LIGHTS];
      uniform vec3 pointLightColors[POINT_LIGHTS];
      varying vec2 vUv;
      varying vec3 vViewDir;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      ${fbm}

      // Wrap-around so low lights like the button's still reach the screen.
      vec3 incomingLight() {
        vec3 n = normalize(vWorldNormal);
        vec3 light = keyLightColor * (0.4 + 0.6 * max(dot(n, keyLightDirection), 0.0));
        for (int i = 0; i < POINT_LIGHTS; i++) {
          vec3 toLight = pointLightPositions[i] - vWorldPosition;
          float distanceSq = max(dot(toLight, toLight), 0.25);
          float wrap = max(dot(n, toLight * inversesqrt(distanceSq)) * 0.5 + 0.5, 0.0);
          light += pointLightColors[i] * wrap * wrap / distanceSq;
        }
        return light;
      }

      // Signed distance to an equilateral triangle pointing up, centred on its centroid.
      // Adapted from Inigo Quilez, https://iquilezles.org/articles/distfunctions2d/ (MIT).
      float sdTriangle(vec2 p, float r) {
        const float k = 1.7320508;
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
      }

      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;

        float a = atan(p.y, p.x) + swirl + r * (1.5 + agitation * 2.0);
        vec2 q = vec2(cos(a), sin(a)) * r;
        float n = fbm(vec3(q * 1.8, time * 0.12 + swirl * 0.2));
        vec3 col = mix(inkColor, nebulaColor, smoothstep(0.15, 0.85, n));
        col += glowColor * pow(n, 4.0) * (0.2 + agitation * 0.6);

        // Die: sinks to 0.45 units under the glass when hidden, floats at 0.05 when shown.
        float hidden = 1.0 - textVisibility;
        float depth = mix(0.05, 0.45, hidden);
        float murk = smoothstep(0.05, 0.42, depth);
        vec3 view = normalize(vViewDir);
        vec2 parallax = view.xy / max(-view.z, 0.25) / (2.0 * liquidRadius);
        float tilt = sin(time * 0.5) * 0.05;
        mat2 rotation = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
        vec2 drift = vec2(sin(time * 0.43), sin(time * 0.71)) * 0.006 + (n - 0.5) * 0.04 * hidden;

        // Quips glow amber so they don't read as answers.
        vec3 dieGlow = mix(glowColor, quipColor, quip);
        vec3 glow = vec3(0.0);
        float face = 0.0;
        vec2 faceUv = vUv;
        for (int i = LAYERS - 1; i >= 0; i--) {
          vec2 uv = vUv + drift + parallax * (depth + float(i) * 0.035);
          vec2 d = rotation * ((uv - 0.5) * 2.0);
          float sd = sdTriangle(vec2(d.x, -d.y), TRIANGLE_SIZE) - 0.05;
          float fw = fwidth(sd);
          float outline = 1.0 - smoothstep(0.0, fw * 1.5 + 0.004, abs(sd));
          float halo = exp(-abs(sd) * 35.0) * 0.35;
          float weight = (1.0 - float(i) / float(LAYERS)) * (i == 0 ? 1.0 : 0.4);
          glow += dieGlow * (outline + halo) * weight;
          if (i == 0) {
            face = 1.0 - smoothstep(-fw, fw, sd);
            faceUv = uv;
          }
        }

        vec2 fd = rotation * (faceUv - 0.5);
        vec3 faceShade = faceColor * mix(0.7, 1.35, smoothstep(-0.25, 0.3, fd.y));
        vec2 tuv = fd * TEXT_SCALE + vec2(0.5, 0.46);
        // Negative LOD bias: the texture is shown shrunk, so pick a sharper mip level.
        float glyph = texture2D(text, tuv, -0.75).a * face;
        // Only the faint outer halo takes the glow colour; the letters themselves stay solid.
        vec3 ink = mix(dieGlow, textColor, smoothstep(0.35, 0.65, glyph));

        vec3 light = incomingLight();
        col *= 0.7 + light * 0.45;
        faceShade *= 0.55 + light * 0.75;

        float clarity = 1.0 - murk;
        col = mix(col, faceShade, face * 0.9 * clarity);
        col += glow * clarity;
        col = mix(col, ink, glyph * clarity);

        col *= 1.0 - smoothstep(0.55, 1.0, r) * 0.85;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

export const createHaloMaterial = (uniforms: BallUniforms) =>
  new ShaderMaterial({
    uniforms: {
      intensity: uniforms.haloIntensity,
      color: { value: new Color(PALETTE.accent) },
    },
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float intensity;
      uniform vec3 color;
      varying vec3 vNormal;
      void main() {
        // Back faces: z is about -0.55 at the ball's edge and 0 at the halo's edge.
        float rim = pow(clamp(-vNormal.z * 1.9, 0.0, 1.0), 3.0) * intensity;
        gl_FragColor = vec4(color * rim, rim);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

/** Environment map sky, only ever seen in reflections. */
export const GALAXY_SHADER = {
  uniforms: {
    spaceColor: { value: new Color("#05030a") },
    nebulaColor: { value: new Color(PALETTE.nebula) },
    dustColor: { value: new Color(PALETTE.shard) },
    glowColor: { value: new Color(PALETTE.accent) },
    coreColor: { value: new Color(PALETTE.mist) },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDirection;
    void main() {
      vDirection = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 spaceColor;
    uniform vec3 nebulaColor;
    uniform vec3 dustColor;
    uniform vec3 glowColor;
    uniform vec3 coreColor;
    varying vec3 vDirection;

    ${fbm}

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
      vec3 d = normalize(vDirection);

      float plane = dot(d, normalize(vec3(0.45, 1.0, 0.15)));
      float clouds = fbm(d * 3.0 + 7.0);
      float band = exp(-pow(plane * (3.2 - clouds * 1.6), 2.0));

      vec3 col = spaceColor;
      col = mix(col, nebulaColor * 1.4, band * smoothstep(0.3, 0.75, clouds));
      col += dustColor * band * pow(fbm(d * 8.0), 3.0) * 1.2;
      col += glowColor * band * pow(clouds, 4.0) * 2.0;

      // Core up-left, matching the key light.
      float core = max(dot(d, normalize(vec3(-0.45, 0.5, 0.75))), 0.0);
      col += coreColor * pow(core, 60.0) * 3.0 + glowColor * pow(core, 12.0) * 0.8;

      vec3 cell = floor(d * 180.0);
      float star = step(0.992, hash(cell)) * (0.6 + hash(cell + 3.1) * 2.4);
      col += coreColor * star * (0.4 + band);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** The button in the environment: feathered so its reflection stays soft. */
export const BUTTON_REFLECTION_SHADER = {
  uniforms: {
    color: { value: new Color(PALETTE.accent) },
    intensity: { value: 6 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(4.0, 1.0);
      float d = length(vec2(max(abs(p.x) - 1.3, 0.0), p.y)) - 0.25;
      float glow = 1.0 - smoothstep(-0.2, 0.25, d);
      gl_FragColor = vec4(color * intensity * glow * glow, 1.0);
    }
  `,
};
