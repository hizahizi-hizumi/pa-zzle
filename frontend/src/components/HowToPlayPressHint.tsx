import { MouseRight, Pointer } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 破線の枠を引く所。どれも押す物（置き場所）の縁を基準にする。
 * - `inside`: 押す物の内側（単位の 0.1 倍）。マスの縁や格子の線と重ねず、マスの中に収める。
 * - `edge`: 押す物の縁の上。中身が縁の近くまで並ぶ物（メモの数字が並ぶマス・ボタン）で、枠を中身にかけない。
 * - `outside`: 押す物の外（単位の 0.08 倍、4px から）。物の縁取りや動きと重ねない。
 */
export type HowToPlayPressHintFrame = "inside" | "edge" | "outside";

/**
 * 破線の枠の形。押す物の形に沿わせる。
 * - `square`: 角の立った四角（マス・ボタン）。
 * - `rounded`: 角を丸めた四角（角の丸いマス・駒・車）。
 * - `round`: 丸（島・丸い印）。細長い物では両端を丸めた形。
 * - `round-bottom`: 上が四角く底の丸い形（ボトル）。
 */
export type HowToPlayPressHintOutline =
  | "square"
  | "rounded"
  | "round"
  | "round-bottom";

/**
 * 指のアイコンを置く所。押す物の中身（数字・メモ・枚数・文字・駒）を隠さない所を選ぶ。
 * - `center`: 押す物の中央。中身の無い物（空きのマス・閉じたマス）。
 * - `fingertip-on-center`: 指先を押す物の中央にちょうど置く。押す点が決まっている物（線の交わる所・車の真ん中）。
 * - `inside-corner`: 押す物の角（`corner`）の内側に小さく置く。中身が中央にある物（タイルのあるマス・道の通るマス）。
 * - `outside-corner`: 押す物の角（`corner`）に、半分を外へ出して置く。物の形が中身そのものの物（ボトル・矢印の丸）。
 * - `bottom-edge`: 下の縁の中央に、半分を外へ出して置く。角まで中身が並ぶ物（メモの数字が並ぶマス）。
 * - `none`: 指を置かず、破線の枠だけを描く。押す物そのものが指の絵の物（指の絵のボタン）。指を添えると指が2本並んで見えるため。
 */
export type HowToPlayPressHintPointer =
  | "center"
  | "fingertip-on-center"
  | "inside-corner"
  | "outside-corner"
  | "bottom-edge"
  | "none";

type PlacedPointer = Exclude<HowToPlayPressHintPointer, "none">;

/**
 * 角に置く指（`inside-corner`・`outside-corner`）の角。渡さなければ右下にする。
 * 角に字や数のある物（持駒・ストックの右下の枚数）や、矢印など別の印が向かう側の角を避けるときに選ぶ。
 */
export type HowToPlayPressHintCorner =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

/**
 * 押し方。
 * - `press`: 指で押す・なぞり始める。指のアイコン。
 * - `secondary-press`: マウスの右ボタンで押す。右のボタンを示したマウスのアイコン。
 */
export type HowToPlayPressHintGesture = "press" | "secondary-press";

/**
 * 手がかりを描く地。
 * - `theme`: テーマで色の変わる地（例の面・テーマに沿う盤面）。
 * - `light`: テーマによらず明るい地（木の盤など）。
 * - `dark`: テーマによらず暗い地（舗装など）。
 */
export type HowToPlayPressHintGround = "theme" | "light" | "dark";

type HowToPlayPressHintProps = {
  frame?: HowToPlayPressHintFrame;
  outline?: HowToPlayPressHintOutline;
  pointer?: HowToPlayPressHintPointer;
  corner?: HowToPlayPressHintCorner;
  gesture?: HowToPlayPressHintGesture;
  ground?: HowToPlayPressHintGround;
  /**
   * 押すとなる姿（押すと置かれるタイルなど）。細かいポインターを押す物に重ねている間だけ、枠の内側に淡く見せ、指のアイコンを隠す。
   * 重ねたことは手がかりの親の要素で受けるので、渡すときは手がかりを押す物の要素の直下に置く。
   */
  hoverPreview?: ReactNode;
};

/** 指のアイコンの大きさの、単位に対する比。角の内側では中身にかけないよう小さくする。 */
const pointerRatios = {
  center: 0.4,
  "fingertip-on-center": 0.4,
  "inside-corner": 0.3,
  "outside-corner": 0.4,
  "bottom-edge": 0.4,
} as const satisfies Record<PlacedPointer, number>;

/** 指のアイコンの大きさの下限と上限（px）。下限は小さなマスでも指の形が読める大きさ、上限は大きな単位でも中身より目立たない大きさ。 */
const POINTER_MIN_PX = 14;
const POINTER_MAX_PX = 20;

/** lucide の Pointer の人差し指の先の、アイコンの箱の中の位置（箱の幅・高さに対する比）。 */
const FINGERTIP = { x: 0.33, y: 0.08 } as const;

const frameInsets = {
  inside: "calc(var(--how-to-play-hint-unit) * 0.1)",
  edge: "0px",
  outside: "calc(max(4px, var(--how-to-play-hint-unit) * 0.08) * -1)",
} as const satisfies Record<HowToPlayPressHintFrame, string>;

const outlineRadii = {
  square: "2px",
  rounded: "22%",
  round: "9999px",
  "round-bottom": "0 0 9999px 9999px",
} as const satisfies Record<HowToPlayPressHintOutline, string>;

const pointerSize = "var(--how-to-play-hint-pointer)";
const halfPointerOutside = `calc(${pointerSize} * -0.5)`;

const pointerPlacements = {
  center: {
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  },
  "fingertip-on-center": {
    left: "50%",
    top: "50%",
    transform: `translate(-${FINGERTIP.x * 100}%, -${FINGERTIP.y * 100}%)`,
  },
  "inside-corner": null,
  "outside-corner": null,
  "bottom-edge": {
    left: "50%",
    bottom: halfPointerOutside,
    transform: "translateX(-50%)",
  },
} as const satisfies Record<PlacedPointer, CSSProperties | null>;

/** 角に置く指の、角からの間。内側は単位の 0.06 倍、外側は指の半分を外へ出す。 */
const cornerOffsets = {
  "inside-corner": "calc(var(--how-to-play-hint-unit) * 0.06)",
  "outside-corner": halfPointerOutside,
} as const;

const cornerSides = {
  "bottom-right": ["bottom", "right"],
  "bottom-left": ["bottom", "left"],
  "top-right": ["top", "right"],
  "top-left": ["top", "left"],
} as const satisfies Record<
  HowToPlayPressHintCorner,
  readonly ["top" | "bottom", "left" | "right"]
>;

function getPointerPlacement(
  pointer: PlacedPointer,
  corner: HowToPlayPressHintCorner,
): CSSProperties {
  if (pointer !== "inside-corner" && pointer !== "outside-corner") {
    return pointerPlacements[pointer];
  }
  const [vertical, horizontal] = cornerSides[corner];
  const offset = cornerOffsets[pointer];
  return { [vertical]: offset, [horizontal]: offset };
}

const groundClassNames = {
  theme: {
    frame: "border-muted-foreground",
    pointer: "fill-background text-muted-foreground",
  },
  light: {
    frame: "border-black/70",
    pointer: "fill-white text-black/80",
  },
  dark: {
    frame: "border-white/90",
    pointer: "fill-white text-black/80",
  },
} as const satisfies Record<
  HowToPlayPressHintGround,
  { frame: string; pointer: string }
>;

const gestureIcons = {
  press: Pointer,
  "secondary-press": MouseRight,
} as const satisfies Record<HowToPlayPressHintGesture, typeof Pointer>;

/**
 * 触れる例で次に押す所の手がかり。押す物を囲む破線の枠と押し方のアイコンを、動かさずに描く。押せない図には置かない。
 * 押す物の要素（`position: relative` にする）の中に置き、押す物いっぱいに重ねる。押しは下の物へ通し、読み上げない。
 * 枠と指の大きさは単位（マス・ボトルなど、例の中で押す物1つ）に比べて決める。単位は、置き場所の祖先が
 * `--how-to-play-unit` で渡し、渡さなければ押す物の短い辺を単位にする。指は単位の 0.3〜0.4 倍にし、14〜20px に収める。
 * 指は地の色で塗った形にし、どの地の上でも読めるようにする。縁の外に出した指が隣の物の下に隠れないよう、押す物の並びの中で前に出す。
 */
export function HowToPlayPressHint({
  frame = "inside",
  outline = "rounded",
  pointer = "inside-corner",
  corner = "bottom-right",
  gesture = "press",
  ground = "theme",
  hoverPreview,
}: HowToPlayPressHintProps) {
  const Icon = gestureIcons[gesture];
  const tones = groundClassNames[ground];
  const rootStyle = {
    "--how-to-play-hint-unit": "var(--how-to-play-unit, 100cqmin)",
    ...(pointer === "none"
      ? {}
      : {
          "--how-to-play-hint-pointer": `clamp(${POINTER_MIN_PX}px, calc(var(--how-to-play-hint-unit) * ${pointerRatios[pointer]}), ${POINTER_MAX_PX}px)`,
        }),
  } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-how-to-play-press-hint=""
      // 手がかりは押しを通すので重ねたことを自分では受けない。押す物（手がかりの親）に重ねたことを、親の :hover で受ける。
      className="group/how-to-play-press-hint pointer-events-none absolute inset-0 z-10 [container-type:size]"
    >
      <span className="absolute inset-0" style={rootStyle}>
        <span
          className={cn("absolute border border-dashed", tones.frame)}
          style={{
            inset: frameInsets[frame],
            borderRadius: outlineRadii[outline],
          }}
        />
        {hoverPreview === undefined ? null : (
          <span className="absolute inset-[10%] opacity-0 pointer-fine:group-[:hover>&]/how-to-play-press-hint:opacity-30">
            {hoverPreview}
          </span>
        )}
        {pointer === "none" ? null : (
          <Icon
            data-how-to-play-press-hint-pointer={pointer}
            className={cn(
              "absolute",
              tones.pointer,
              hoverPreview !== undefined &&
                "pointer-fine:group-[:hover>&]/how-to-play-press-hint:opacity-0",
            )}
            style={{
              width: pointerSize,
              height: pointerSize,
              ...getPointerPlacement(pointer, corner),
            }}
          />
        )}
      </span>
    </span>
  );
}
