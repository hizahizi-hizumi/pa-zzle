import {
  ExtrudeGeometry,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Shape,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import {
  getZukanPieceLightAxis,
  ZUKAN_PIECE_MATERIAL,
} from "@/features/zukan/ui/zukan-piece-material";

/** 結果のピースを立体で描く場面。1つの WebGL の文脈を持ち、`dispose` で文脈ごと手放す。 */
export type ZukanPieceScene = {
  /** 縦の軸まわりに `turn`（ラジアン）だけ回した姿を描く。0 で正面。 */
  render(turn: number): void;
  /** 描く大きさ（CSS の px）と、画素の細かさ。 */
  resize(sizePx: number, pixelRatio: number): void;
  dispose(): void;
};

type ZukanPieceSceneOptions = {
  /** ピースの輪郭。マスの左上を原点、1辺を 1 とする SVG の座標。 */
  path: string;
  /** 面の色。CSS の色の書き方なら何でもよい。 */
  faceColor: string;
};

/** 画面の縦に対する視野の角度（度）。遠くから狭く見て、平面のピースとほとんど同じ見え方にする。 */
const FIELD_OF_VIEW_DEG = 16;
/** 描く範囲の半分の大きさ。平面のピースの SVG と同じく、ピースの1辺の2倍の正方形を描く。 */
const VIEW_HALF = 1;
/** 曲がった辺を分ける細かさと、面のつながりを滑らかに見せる角度の上限。 */
const CURVE_SEGMENTS = 20;
const CREASE_ANGLE_RAD = Math.PI / 6;

const VERTEX_SHADER = /* glsl */ `
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec3 vObjNormal;
void main() {
  vObjNormal = normal;
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  vViewPos = viewPos.xyz;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPos;
}
`;

// 光と陰は線形の色で求め、面の階調と縁の稜線は、平面のピースと同じく sRGB の色の上で白と黒を重ねる。
const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uFace;
uniform vec3 uSide;
uniform vec3 uBack;
uniform vec3 uLight;
uniform vec3 uCenter;
uniform vec2 uAxisFrom;
uniform vec2 uAxisTo;
uniform float uFaceLight;
uniform float uFaceShade;
uniform float uBevelLight;
uniform float uBevelShade;
uniform float uSheen;
uniform float uBevelToward;
uniform float uBevelAway;
uniform float uWindowGlow;
varying vec3 vViewPos;
varying vec3 vViewNormal;
varying vec3 vObjNormal;

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 n = normalize(vViewNormal);
  vec3 v = normalize(-vViewPos);
  float facing = abs(vObjNormal.z);
  bool cap = facing > 0.9;
  bool wall = facing < 0.1;
  bool front = vObjNormal.z > 0.0;
  vec3 albedo = wall ? uSide : (front ? uFace : uBack);

  // 正面を向いた面で 1 になる明るさ。面が光へ向くほど明るく、背くほど暗い。
  float ndl = dot(n, uLight);
  // 面取りの明暗は、下で平面のピースと同じ白と黒の重ね方で付けるので、ここでは明るさを変えない。
  float lit = (cap || wall) ? max(0.0, 1.0 + 0.55 * (ndl - uLight.z)) : 1.0;
  vec3 color = toLinear(albedo) * lit;

  // 斜めから見ると、部屋の白い壁がしっとりと映る。正面では映らない。
  float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  color = mix(color, vec3(0.94), fresnel * uSheen);

  // 高い窓の柔らかい照り。正面を向いたときの照りを差し引き、正面では面の色そのものにする。
  vec3 h = normalize(uLight + v);
  vec3 hFront = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float glow = pow(max(dot(n, h), 0.0), 36.0) - pow(hFront.z, 36.0);
  color += vec3(max(glow, 0.0) * uWindowGlow);

  vec3 srgb = toSrgb(color);

  // 面の広く淡い階調。窓の光は画面に対して決まっているので、画面の上の位置で引く。
  vec2 p = vViewPos.xy - uCenter.xy;
  vec2 axis = uAxisTo - uAxisFrom;
  float t = clamp(dot(p - uAxisFrom, axis) / dot(axis, axis), 0.0, 1.0);
  srgb = mix(srgb, vec3(1.0), uFaceLight * max(0.0, 1.0 - 2.0 * t));
  srgb = mix(srgb, vec3(0.0), uFaceShade * max(0.0, 2.0 * t - 1.0));

  // 面取りは、光へ向く側に明るい稜線、背く側に細い陰。上の辺と下の辺の面取りで、平面のピースの帯と同じ濃さになる。
  if (!cap && !wall) {
    float toward = ndl - uLight.z;
    srgb = mix(srgb, vec3(1.0), uBevelLight * clamp(toward / uBevelToward, 0.0, 1.0));
    srgb = mix(srgb, vec3(0.0), uBevelShade * clamp(-toward / uBevelAway, 0.0, 1.0));
  }
  gl_FragColor = vec4(srgb, 1.0);
}
`;

/** CSS の色を、sRGB の 0〜1 の値にする。 */
function readCssColor(color: string): Vector3 {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (context === null) return new Vector3(0.5, 0.5, 0.5);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 128, g = 128, b = 128] = context.getImageData(0, 0, 1, 1).data;
  return new Vector3(r / 255, g / 255, b / 255);
}

/** sRGB の色を、線形の明るさで `amount` だけ深くする。 */
function deepen(color: Vector3, amount: number): Vector3 {
  const factor = (1 - amount) ** (1 / 2.2);
  return color.clone().multiplyScalar(factor);
}

/** SVG の座標（y が下向き）の輪郭を、ピースの中心を原点とし y が上向きの形にする。 */
function toShape(path: string): Shape {
  const shape = new Shape();
  const commands = path.matchAll(/([MLCZ])([^MLCZ]*)/g);
  for (const [, command, args] of commands) {
    const values = (args ?? "")
      .trim()
      .split(/[\s,]+/)
      .filter((value) => value !== "")
      .map(Number);
    const points: [number, number][] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      points.push([(values[i] ?? 0) - 0.5, 0.5 - (values[i + 1] ?? 0)]);
    }
    if (command === "M" && points[0]) shape.moveTo(...points[0]);
    if (command === "L" && points[0]) shape.lineTo(...points[0]);
    if (command === "C" && points[0] && points[1] && points[2]) {
      shape.bezierCurveTo(...points[0], ...points[1], ...points[2]);
    }
    if (command === "Z") shape.closePath();
  }
  return shape;
}

function createGeometry(path: string) {
  const { thickness, bevelWidth } = ZUKAN_PIECE_MATERIAL;
  const extruded = new ExtrudeGeometry(toShape(path), {
    depth: thickness - bevelWidth * 2,
    curveSegments: CURVE_SEGMENTS,
    bevelEnabled: true,
    bevelThickness: bevelWidth,
    bevelSize: bevelWidth,
    // 面取りを輪郭の内側に取り、横から見た縁を平面のピースの輪郭に合わせる。
    bevelOffset: -bevelWidth,
    bevelSegments: 1,
  });
  extruded.translate(0, 0, -(thickness - bevelWidth * 2) / 2);
  const geometry = toCreasedNormals(extruded, CREASE_ANGLE_RAD);
  extruded.dispose();
  return geometry;
}

/**
 * ピースを立体で描く場面を作る。WebGL が使えなければ `null`。
 * 正面を向いた姿が、同じ大きさの平面のピース（`ZukanPieceSurface`）と重なるように見る。
 */
export function createZukanPieceScene(
  canvas: HTMLCanvasElement,
  { path, faceColor }: ZukanPieceSceneOptions,
): ZukanPieceScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const material = ZUKAN_PIECE_MATERIAL;
  const camera = new PerspectiveCamera(FIELD_OF_VIEW_DEG, 1, 0.1, 100);
  const halfAngle = (FIELD_OF_VIEW_DEG * Math.PI) / 360;
  // 正面の面（手前へ厚みの半分）が、描く範囲にちょうど収まる距離から見る。
  const distance = VIEW_HALF / Math.tan(halfAngle) + material.thickness / 2;
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  const face = readCssColor(faceColor);
  const light = material.lightDirection;
  const sceneLight = new Vector3(light.x, -light.y, light.z).normalize();
  // 上の辺と下の辺の、45度の面取りが光に向く度合い。
  const bevelToward =
    Math.SQRT1_2 * (Math.abs(sceneLight.y) + sceneLight.z) - sceneLight.z;
  const bevelAway =
    sceneLight.z - Math.SQRT1_2 * (sceneLight.z - Math.abs(sceneLight.y));
  const axis = getZukanPieceLightAxis();
  const shader = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uFace: { value: face },
      uSide: { value: deepen(face, material.sideDepth) },
      uBack: { value: deepen(face, material.backDepth) },
      // 場面の座標は y が上向きなので、画面の座標の光の向きの y を返す。
      uLight: { value: sceneLight },
      uBevelToward: { value: bevelToward },
      uBevelAway: { value: bevelAway },
      uCenter: { value: new Vector3(0, 0, -distance) },
      uAxisFrom: { value: new Vector2(axis.from.x - 0.5, 0.5 - axis.from.y) },
      uAxisTo: { value: new Vector2(axis.to.x - 0.5, 0.5 - axis.to.y) },
      uFaceLight: { value: material.faceLight },
      uFaceShade: { value: material.faceShade },
      uBevelLight: { value: material.bevelLight },
      uBevelShade: { value: material.bevelShade },
      uSheen: { value: material.sheen },
      uWindowGlow: { value: material.windowGlow },
    },
  });
  const geometry = createGeometry(path);
  const piece = new Mesh(geometry, shader);
  const scene = new Scene();
  scene.add(piece);

  return {
    render(turn) {
      piece.rotation.y = turn;
      renderer.render(scene, camera);
    },
    resize(sizePx, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(sizePx, sizePx, false);
    },
    dispose() {
      geometry.dispose();
      shader.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
