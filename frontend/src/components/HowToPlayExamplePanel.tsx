import {
  type CSSProperties,
  createContext,
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { HowToPlayExampleResetButton } from "@/components/HowToPlayExampleResetButton";
import { cn } from "@/lib/utils";

/**
 * 例の並べ方。
 * - `side-by-side`: 左にできる形、右にできない形を横に並べる。2つの例の幅と間が面の内側の幅に収まらないときは、縦に並べる。
 * - `stacked`: 1本の行を丸ごと見せる横に長い例や、1つだけの例を、縦に並べて中央に置く。
 */
export type HowToPlayExampleArrangement = "side-by-side" | "stacked";

type HowToPlayExamplePanelProps = {
  /** 例を `HowToPlayExample` などで、並べる順に渡す。 */
  children: ReactNode;
  arrangement?: HowToPlayExampleArrangement;
  /**
   * 触れる例を置く面か。置くときは、面の例をまとめて最初の姿に戻すボタンを、面の縁に置く。
   * 例は `useReportHowToPlayExampleChange` で、最初の姿から変わったかを面に知らせる。
   */
  resettable?: boolean;
};

/**
 * 元に戻すボタンを置く所。どの所も、例の盤面と言葉から 4px 以上離す。
 * 例の横と例の下は、押す物（盤面・駒台・数の列・入力の段など）のすぐ横か真下に来るので、押す物を押そうとしてボタンを押したり、
 * ボタンが押す物の印に見えたりしないよう、盤面からはボタンの押せる範囲で 16px 以上離す。面の角は面の余白に掛かる所なので 4px に
 * とどめ、盤面が角の近くまで届く面でも角に置けるようにする（例の下に置いて、面の下に帯を増やさない）。
 * - `beside-example`: 縦に積んだ例（例1つを含む）のどれにも、その例の横に置ける所（`ResetButtonSpot`）があり、
 *   最後に変えた例の横に置く。ボタンのために高さを取らない。縦に積んだ2つ以上の例のある面で、盤面から 16px 離せる所の無い例は、
 *   盤面から 4px 離れた横の所に置く。面に1つの所に置くと、触った例から離れ、背の高い面では画面の外に出るため。
 * - 横に並べた例のある面と、横に置けない例がある面では、面に1つの所に置く。上から順に、置ける所を選ぶ。
 *   - `beside-caption`: 例の下の言葉の1行目の右（言葉の無い面では、例の下端の右）。ボタンのために高さを取らない。
 *     例が1つの面でだけ選ぶ。例が2つ以上ある面では、最後の例の横に置くとその例だけを戻すボタンに見えるため。
 *   - `top-corner`: 面の右上の角。ボタンのために高さを取らない。
 *   - `below-examples`: 例の下。どちらの角にも例か言葉が届く面で、ボタンの列にある例と言葉の下にボタンの分の高さを取る。
 */
type ResetButtonPlacement =
  | "beside-example"
  | "beside-caption"
  | "top-corner"
  | "below-examples";

/**
 * 例1つの横の、元に戻すボタンの所。`side` は面の左右どちらの縁に置くか、`top` は面の内側の上端からボタンの上端までの高さ（px）。
 * 面の上の余白は置き場所で変わるので、余白によらない面の内側から測る。
 */
type ResetButtonSpot = { side: "left" | "right"; top: number };

/**
 * 元に戻すボタンの置き場所と、例の下に置くときに、ボタンの上に空ける高さ（px）。面の内側の下端から測り、ボタンの列で
 * 面の内側の下端より下に描かれる言葉（判定の下のわけ）の高さと、ボタンの列の盤面からボタンを離す高さの大きい方にする。
 * `belowBoard` は、例の下に置くボタンの真上に来るのが、例の言葉でなく盤面（数の列・入力の段を含む）か。
 */
type ResetButtonPosition = {
  placement: ResetButtonPlacement;
  spaceBelowPx: number;
  belowBoard: boolean;
};

/** 面の置き場所と、面の例ごと（並びの順）の、横に置ける所。横に置けない例は `null`。横に並べた例のある面では空にする。 */
type ResetButtonLayout = ResetButtonPosition & {
  spots: readonly (ResetButtonSpot | null)[];
};

/**
 * 縦に並べた例の間。判定の下に添える2行目の言葉（別に破ったルール・ルールそのもののわけ）を、場所を取らずに例の下に重ねるので、
 * その言葉の高さに、判定と自分の盤面の間より広い間を足して、次の盤面と離す。
 * 横に並べた例どうしは、例の中の単位（マス・ボトルなど）どうしの間の3倍以上を空け、2つの盤面に見えるようにする。
 * 例の幅は盤面と言葉（2行目を含む）の広い方なので、言葉が盤面より広い例でも、隣の例の言葉と重ならない。
 */
const arrangementClassNames = {
  "side-by-side":
    "flex flex-wrap items-end justify-center gap-x-8 gap-y-10 lg:gap-x-10",
  stacked: "flex flex-col items-center gap-10",
} as const satisfies Record<HowToPlayExampleArrangement, string>;

/**
 * 面の上下の内側の余白（`--how-to-play-panel-padding-block` は上の余白）と、元に戻すボタンの置き場所。
 * ボタンは面の内側（`@container` の箱）に置き、面の右の縁から 16px（面の内側の右端）にそろえる。
 * 例の下に置く面でボタンの真上が盤面のものを除き、上の余白は 32px にし、面ごとに例の始まる高さを変えない。
 * - 言葉の行の右: 下の余白を 32px にし、ボタン（36px）を下の縁から 24px に置いて、縦の中心を言葉の1行目（下の余白の上の 24px の行）の
 *   中心にほぼそろえる。
 * - 右上の角: 下の余白を 32px にし、ボタンを上の縁から右と同じ 16px に置く。
 * - 例の下: 下にボタンの分の高さを取る。面の内側の下端から、ボタンの上に空ける高さ（`--how-to-play-reset-space-below`）の下に
 *   4px 空けてボタンを置き、その下に 8px を残す（下の余白は 48px からになる）。ボタンの真上が盤面の面（言葉の無い面や、盤面の下に
 *   入力の段を並べた面）では、触る前に例が上へ寄って下に帯が残らないよう、上の余白も下と同じにする。ボタンの真上が言葉の面は、
 *   言葉が面の下の締めになるので、上の余白は 32px のままにする。
 */
const placementClassNames = {
  "beside-example": {
    panel: "py-8 [--how-to-play-panel-padding-block:--spacing(8)]",
    button: "",
  },
  "beside-caption": {
    panel: "py-8 [--how-to-play-panel-padding-block:--spacing(8)]",
    button: "right-0 -bottom-2",
  },
  "top-corner": {
    panel: "py-8 [--how-to-play-panel-padding-block:--spacing(8)]",
    button: "right-0 -top-4",
  },
  "below-examples": {
    panel:
      "pt-(--how-to-play-panel-padding-block) pb-[calc(var(--how-to-play-reset-space-below)+--spacing(12))] [--how-to-play-panel-padding-block:--spacing(8)] data-[reset-button-below-board]:[--how-to-play-panel-padding-block:calc(var(--how-to-play-reset-space-below)+--spacing(12))]",
    button:
      "right-0 -bottom-[calc(var(--how-to-play-reset-space-below)+--spacing(10))]",
  },
} as const satisfies Record<
  ResetButtonPlacement,
  { panel: string; button: string }
>;

/** 元に戻すボタンの大きさ（px）と、例の盤面と言葉との間に少なくとも空ける幅（px）。 */
const RESET_BUTTON_SIZE_PX = 36;
const RESET_BUTTON_CLEARANCE_PX = 4;
/**
 * 例の横と例の下に置くときの、ボタンの押せる範囲（ボタンの周りへ 4px 広げた 44px 四方、`icon-touch`）と例の盤面の間（px）と、
 * それを満たす、ボタンの見える縁と例の盤面の間（px）。
 */
const RESET_BUTTON_TOUCH_OUTSET_PX = 4;
const RESET_BUTTON_BOARD_CLEARANCE_PX = 16;
const RESET_BUTTON_BOARD_MARGIN_PX =
  RESET_BUTTON_TOUCH_OUTSET_PX + RESET_BUTTON_BOARD_CLEARANCE_PX;

/** 面の上下の内側の余白（px）。例の横に置くときは、少なくともこの余白があるとして、ボタンが面の縁に迫らない所を選ぶ。 */
const PANEL_PADDING_BLOCK_PX = 32;
/** ボタンを面の上下の縁から少なくとも離す幅（px）。 */
const RESET_BUTTON_PANEL_MARGIN_PX = 8;
/** 例の下の言葉の1行目の高さ（px、`HowToPlayExample` の言葉の置き場所の最小の高さ）。 */
const CAPTION_LINE_PX = 24;
/** 例の上端の横に置くとき、ボタンの上端を例の上端から上へ出す高さ（px）。面の右上の角と同じく、面の上の縁から 16px になる。 */
const RESET_BUTTON_ABOVE_FIGURE_PX = 16;

type Box = { left: number; right: number; top: number; bottom: number };

/** 例の言葉の字の矩形（判定の下のわけの行を含む）と、言葉のほかの部分（盤面・駒台・数の列・入力の段など）の矩形。 */
type ExampleBoxes = { captions: readonly Box[]; boards: readonly Box[] };

function overlaps(box: Box, examples: readonly Box[]): boolean {
  return examples.some(
    (example) =>
      example.right > example.left &&
      example.right > box.left &&
      example.left < box.right &&
      example.bottom > box.top &&
      example.top < box.bottom,
  );
}

function expand(box: Box, margin: number): Box {
  return {
    left: box.left - margin,
    right: box.right + margin,
    top: box.top - margin,
    bottom: box.bottom + margin,
  };
}

/**
 * 例の横に置いたボタンが、例の言葉から面の内側の向きに 4px 以上離れ、例の盤面からも離れているか。
 * 盤面からは、`keepsTouchClearance` ならボタンの押せる範囲で 16px 以上、そうでなければ言葉と同じく面の内側の向きに 4px 以上。
 */
function isClearOfExamples(
  button: Box,
  side: "left" | "right",
  { captions, boards }: ExampleBoxes,
  keepsTouchClearance: boolean,
): boolean {
  const inward =
    side === "right"
      ? { ...button, left: button.left - RESET_BUTTON_CLEARANCE_PX }
      : { ...button, right: button.right + RESET_BUTTON_CLEARANCE_PX };
  return (
    !overlaps(inward, captions) &&
    !overlaps(
      keepsTouchClearance
        ? expand(button, RESET_BUTTON_BOARD_MARGIN_PX)
        : inward,
      boards,
    )
  );
}

/**
 * 例1つの横の、元に戻すボタンの所。`content` は面の内側の矩形、`figure` は例の矩形、`caption` は例の下の言葉の置き場所の矩形
 * （言葉の無い例では `null`）、`boardBottom` はその例の盤面の下端（盤面の無い例では `null`）、`examples` は面のすべての例の矩形。
 * 例の中心が面の中心より左なら面の左の縁、そうでなければ右の縁に置く。上から順に、言葉の1行目の横（言葉の無い例では例の下端の横）、
 * 例の上端の横、例の盤面の下（駒台の角などが言葉の横に迫る例）のうち、言葉から 4px・盤面から押せる範囲で 16px
 * （`keepsTouchClearance` でなければ 4px）以上離れ、面の上下の縁から 8px 以上内側に収まる所を選ぶ。どれも無ければ `null`。
 */
function findResetButtonSpot(
  content: Box,
  figure: Box,
  caption: Box | null,
  boardBottom: number | null,
  examples: ExampleBoxes,
  keepsTouchClearance = true,
): ResetButtonSpot | null {
  const side =
    (figure.left + figure.right) / 2 < (content.left + content.right) / 2 - 1
      ? "left"
      : "right";
  const left =
    side === "right" ? content.right - RESET_BUTTON_SIZE_PX : content.left;
  const besideCaption =
    caption === null
      ? figure.bottom - RESET_BUTTON_SIZE_PX
      : caption.top +
        (Math.min(caption.bottom - caption.top, CAPTION_LINE_PX) -
          RESET_BUTTON_SIZE_PX) /
          2;
  const besideTop = figure.top - RESET_BUTTON_ABOVE_FIGURE_PX;
  const belowBoard =
    boardBottom === null ? [] : [boardBottom + RESET_BUTTON_BOARD_MARGIN_PX];
  const top = [besideCaption, besideTop, ...belowBoard].find((candidate) => {
    const button = {
      left,
      right: left + RESET_BUTTON_SIZE_PX,
      top: candidate,
      bottom: candidate + RESET_BUTTON_SIZE_PX,
    };
    return (
      button.top >=
        content.top - PANEL_PADDING_BLOCK_PX + RESET_BUTTON_PANEL_MARGIN_PX &&
      button.bottom <=
        content.bottom +
          PANEL_PADDING_BLOCK_PX -
          RESET_BUTTON_PANEL_MARGIN_PX &&
      isClearOfExamples(button, side, examples, keepsTouchClearance)
    );
  });
  return top === undefined
    ? null
    : { side, top: Math.round(top - content.top) };
}

/**
 * 面の右の角に置いたボタンに、例との間の 4px を左に足した矩形。言葉の行の右は下の縁から 24px（面の内側の下端から内へ 28px・
 * 外へ 8px）、右上の角は上の縁から 16px（面の内側の上端から外へ 16px・内へ 20px）に置く。面の上下の余白は 32px。
 */
function getCornerBox(
  content: Box,
  placement: "beside-caption" | "top-corner",
): Box {
  const top =
    placement === "beside-caption" ? content.bottom - 28 : content.top - 16;
  return {
    left: content.right - RESET_BUTTON_SIZE_PX - RESET_BUTTON_CLEARANCE_PX,
    right: content.right,
    top,
    bottom: top + RESET_BUTTON_SIZE_PX,
  };
}

/**
 * 元に戻すボタンの、面に1つの置き場所。`content` は面の内側の矩形、`examples` は例の矩形、`exampleCount` は面の例の数。
 * 高さを取らない角（例が1つなら言葉の行の右、次に右上）のうち、例の盤面と言葉に重ならない所を選ぶ。
 * どちらも重なれば例の下にし、ボタンの上に空ける高さと、ボタンの真上が盤面かを返す。例が1つならボタンの列の言葉と盤面だけを数え、2つ以上なら、
 * ボタンが最後の例の言葉の横に並んでその例だけを戻すボタンに見えないよう、どの列の言葉と盤面も数えて、それらの下に置く。
 */
function findResetButtonPosition(
  content: Box,
  examples: ExampleBoxes,
  exampleCount = 1,
): ResetButtonPosition {
  const corners =
    exampleCount > 1
      ? (["top-corner"] as const)
      : (["beside-caption", "top-corner"] as const);
  const corner = corners.find(
    (candidate) =>
      !overlaps(getCornerBox(content, candidate), [
        ...examples.captions,
        ...examples.boards,
      ]),
  );
  if (corner !== undefined) {
    return { placement: corner, spaceBelowPx: 0, belowBoard: false };
  }
  const buttonLeft = content.right - RESET_BUTTON_SIZE_PX;
  const inColumn = (margin: number) => (box: Box) =>
    box.right > box.left &&
    (exampleCount > 1 || box.right > buttonLeft - margin);
  const captionSpace = Math.max(
    ...examples.captions
      .filter(inColumn(RESET_BUTTON_CLEARANCE_PX))
      .map(({ bottom }) => Math.ceil(bottom - content.bottom)),
  );
  // ボタンは、空ける高さの下に 4px 空けて置くので、盤面からは押せる範囲で 16px 離れるよう、その差を足す。
  const boardSpace = Math.max(
    ...examples.boards
      .filter(inColumn(RESET_BUTTON_BOARD_MARGIN_PX))
      .map(({ bottom }) =>
        Math.ceil(
          bottom -
            content.bottom +
            RESET_BUTTON_BOARD_MARGIN_PX -
            RESET_BUTTON_CLEARANCE_PX,
        ),
      ),
  );
  return {
    placement: "below-examples",
    spaceBelowPx: Math.max(0, captionSpace, boardSpace),
    belowBoard: boardSpace >= captionSpace,
  };
}

/**
 * ボタンと重なるかを測る、例の部分（盤面と、例の下の言葉の置き場所）。大きさが変わったら測り直すので、これを見張る。
 * 例の中身が出入りするたびに取り直す。
 * 例を包む箱（`display: contents` の箱を含む）は矩形を持たないことがあるので、中の例の図を分けて測る。
 */
function listExampleParts(examples: HTMLElement): HTMLElement[] {
  return Array.from(examples.children).flatMap((child) => {
    if (!(child instanceof HTMLElement)) {
      return [];
    }
    const figures =
      child.tagName === "FIGURE"
        ? [child]
        : Array.from(child.querySelectorAll<HTMLElement>("figure"));
    if (figures.length === 0) {
      return [child];
    }
    return figures.flatMap((figure) =>
      Array.from(figure.children).filter(
        (part): part is HTMLElement => part instanceof HTMLElement,
      ),
    );
  });
}

/**
 * 言葉の置き場所の中で、字と記号が描かれる矩形。置き場所は例の幅いっぱいに広がるので、言葉そのものの幅で測る。
 * 重ねて隠した言葉も、入れ替えると同じ所に出るので数える。読み上げだけの言葉（幅 1px の箱）は数えない。
 */
function listCaptionInkBoxes(caption: HTMLElement): Box[] {
  const boxes: Box[] = Array.from(caption.querySelectorAll("*"))
    .filter((element) => element.childElementCount === 0)
    .map((element) => element.getBoundingClientRect());
  const texts = document.createTreeWalker(caption, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let text = texts.nextNode(); text !== null; text = texts.nextNode()) {
    if (typeof range.getBoundingClientRect !== "function") {
      break;
    }
    // 読み上げだけの言葉は幅 1px の箱で切って隠すので、字の矩形でなく箱の幅で見分ける。
    const holder = text.parentElement?.getBoundingClientRect();
    if (holder === undefined || holder.right - holder.left <= 1) {
      continue;
    }
    range.selectNodeContents(text);
    boxes.push(range.getBoundingClientRect());
  }
  return boxes.filter(({ left, right }) => right - left > 1);
}

/** 判定の下に添えるわけの行の高さ（px）。`text-supporting` の1行。 */
const VERDICT_REASON_LINE_PX = 20;

/**
 * 判定の下に、触った後に出うるわけの行の矩形。わけは判定の下の中央に出るので、判定の幅で言葉の置き場所の下に1行取る。
 * 出たときにボタンを動かさないよう、出ていない間もボタンの置き場所を決めるのに数える。
 */
function listVerdictReasonBoxes(caption: HTMLElement): Box[] {
  const { bottom } = caption.getBoundingClientRect();
  return Array.from(
    caption.querySelectorAll("[data-how-to-play-verdict]"),
    (verdict) => {
      const { left, right } = verdict.getBoundingClientRect();
      return {
        left,
        right,
        top: bottom,
        bottom: bottom + VERDICT_REASON_LINE_PX,
      };
    },
  );
}

/** 例の部分の矩形を、言葉の字（判定の下のわけの行を含む）と、言葉のほかの部分（盤面・駒台・数の列など）に分けて測る。 */
function measureExampleBoxes(parts: readonly HTMLElement[]): ExampleBoxes {
  const captions: Box[] = [];
  const boards: Box[] = [];
  for (const part of parts) {
    if (part.tagName === "FIGCAPTION") {
      captions.push(
        ...listCaptionInkBoxes(part),
        ...listVerdictReasonBoxes(part),
      );
    } else {
      boards.push(part.getBoundingClientRect());
    }
  }
  return { captions, boards };
}

/** 大きさのある例のうち、縦の範囲が重なる（横に並んだ）2つがあるか。 */
function hasExamplesSideBySide(figures: readonly Box[]): boolean {
  const measured = figures.filter(({ top, bottom }) => bottom > top);
  return measured.some((figure, index) =>
    measured
      .slice(index + 1)
      .some((other) => figure.top < other.bottom && other.top < figure.bottom),
  );
}

const initialResetButtonLayout: ResetButtonLayout = {
  placement: "beside-caption",
  spaceBelowPx: 0,
  belowBoard: false,
  spots: [],
};

/**
 * 面の例と面の大きさから、元に戻すボタンの置き場所を決める。
 * 横に並べた例のある面は、どの例を触っても同じ所に出るよう、面に1つの所（`findResetButtonPosition`）に置く。触った例の側の縁へ
 * 移すと、面全体を戻すボタンなのに触るたびに左右に跳び、左の縁では隣の言葉の頭の印にも見えるため。
 * 縦に積んだ面は、どの例にも横に置ける所があれば例の横に置き、高さを取らない。背の高い面でも触った例のそばに出る。
 * 例が2つ以上の面では、盤面から押せる範囲で 16px 離せる所の無い例も、盤面から 4px の所があればその横に置く。
 * 横に置けない例があれば、面に1つの所も決めておき、その例を触ったときはそこに置く。
 */
function measureResetButtonLayout(
  content: HTMLElement,
  examples: HTMLElement,
): ResetButtonLayout {
  const contentBox = content.getBoundingClientRect();
  const exampleBoxes = measureExampleBoxes(listExampleParts(examples));
  const figures = Array.from(examples.querySelectorAll("figure"));
  const figureBoxes = figures.map((figure) => figure.getBoundingClientRect());
  const panelPosition = findResetButtonPosition(
    contentBox,
    exampleBoxes,
    figures.length,
  );
  if (hasExamplesSideBySide(figureBoxes)) {
    return { ...panelPosition, spots: [] };
  }
  const spots = figures.map((figure, index) => {
    const caption = figure.querySelector("figcaption");
    const figureBox = figureBoxes[index];
    const boardBottoms = Array.from(figure.children)
      .filter((part) => part.tagName !== "FIGCAPTION")
      .map((part) => part.getBoundingClientRect())
      .filter(({ top, bottom }) => bottom > top)
      .map(({ bottom }) => bottom);
    if (figureBox === undefined) {
      return null;
    }
    const findSpot = (keepsTouchClearance: boolean) =>
      findResetButtonSpot(
        contentBox,
        figureBox,
        caption === null ? null : caption.getBoundingClientRect(),
        boardBottoms.length === 0 ? null : Math.max(...boardBottoms),
        exampleBoxes,
        keepsTouchClearance,
      );
    return findSpot(true) ?? (figures.length > 1 ? findSpot(false) : null);
  });
  if (spots.length > 0 && spots.every((spot) => spot !== null)) {
    return {
      placement: "beside-example",
      spaceBelowPx: 0,
      belowBoard: false,
      spots,
    };
  }
  return { ...panelPosition, spots };
}

function isSameLayout(left: ResetButtonLayout, right: ResetButtonLayout) {
  return (
    left.placement === right.placement &&
    left.spaceBelowPx === right.spaceBelowPx &&
    left.belowBoard === right.belowBoard &&
    left.spots.length === right.spots.length &&
    left.spots.every((spot, index) => {
      const other = right.spots[index];
      return spot === null || other === null || other === undefined
        ? spot === (other ?? null)
        : spot.side === other.side && spot.top === other.top;
    })
  );
}

type ReportChange = (exampleId: string, changed: boolean) => void;

const ReportChangeContext = createContext<ReportChange | null>(null);

/**
 * 触れる例が、最初の姿から変わったかを、置かれた面に知らせる関数を返す。例を押すたびに、押した後の姿で呼ぶ。
 * 面の外に置いた例では何もしない。
 */
export function useReportHowToPlayExampleChange(): (changed: boolean) => void {
  const report = useContext(ReportChangeContext);
  const exampleId = useId();
  return (changed) => report?.(exampleId, changed);
}

/**
 * 最初の姿から変わっている例と、その例を最後に変えたときに操作した例の図（面の中の `figure` の並びの順）。
 * 図の外の物（盤面の下の入力の段など）だけを操作した例は、前に操作した図のままにする。
 */
type ChangedExample = { exampleId: string; figure: number | null };

/**
 * 例を並べる、背景差だけの面。面はどこでも置き場所の幅いっぱいにそろえ、図は面の中で中央に置く。
 * 図が面の内側の幅に合わせて大きさを決められるよう、余白の内側をコンテナにする。
 * 上の余白は `--how-to-play-panel-padding-block` で中の図に渡し、図が面の中に動く場所を取るときに使えるようにする。
 * 触れる例の面では、面の中のどれかの例が最初の姿と違う間だけ、元に戻すボタンを出す。
 * 縦に積んだ面では、ボタンを、最後に変えた例の横の面の縁（例が面の左寄りなら左、ほかは右）から 16px に、その例の言葉の1行目の横・
 * 例の上端の横・盤面の下のうち、例の言葉と盤面から離れた所に高さを取らずに重ねる。背の高い面でも、変えた例のそばに出し、画面の外に出さない。
 * 横に並べた例のある面と、横に置けない例を変えたときは、面に1つの所（言葉の行の右・面の右上の角・例の下）に置く。
 * ボタンは例が変わったときだけ動かし、指で送る・Tab でフォーカスを送る・弾かれる手を押すなど、例の変わらない操作では動かさない。
 * 置き場所は例と面の大きさから決め、ボタンを出し入れしても変えない。戻すときは面の例を作り直して、最初の姿にする。
 */
export function HowToPlayExamplePanel({
  children,
  arrangement = "side-by-side",
  resettable = false,
}: HowToPlayExamplePanelProps) {
  const [generation, setGeneration] = useState(0);
  const [changedExamples, setChangedExamples] = useState<
    readonly ChangedExample[]
  >([]);
  const [resetButtonLayout, setResetButtonLayout] = useState<ResetButtonLayout>(
    initialResetButtonLayout,
  );
  const operatedFigureRef = useRef<number | null>(null);
  const figureBeforePointerRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const examplesRef = useRef<HTMLDivElement>(null);

  // 例と面の大きさは描いた後にしか分からないので、描いた矩形を測ってボタンの置き場所を決める。
  // 大きさが変わったときと、例の中身が出入りしたとき（後から出る言葉・元に戻して作り直した例）に測り直す。
  useLayoutEffect(() => {
    const content = contentRef.current;
    const examples = examplesRef.current;
    if (!resettable || content === null || examples === null) {
      return;
    }
    const resizes =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    function measure() {
      if (content === null || examples === null) {
        return;
      }
      const next = measureResetButtonLayout(content, examples);
      setResetButtonLayout((current) =>
        isSameLayout(current, next) ? current : next,
      );
    }
    function watchParts() {
      if (resizes === null || content === null || examples === null) {
        return;
      }
      resizes.disconnect();
      resizes.observe(content);
      for (const part of listExampleParts(examples)) {
        resizes.observe(part);
      }
    }
    watchParts();
    measure();
    const mutations = new MutationObserver(() => {
      watchParts();
      measure();
    });
    mutations.observe(examples, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      mutations.disconnect();
      resizes?.disconnect();
    };
  }, [resettable]);

  // 例は押した手の中で知らせるので、知らせた時に覚えている図が、その手で操作した図になる。
  const reportChange = useCallback<ReportChange>((exampleId, changed) => {
    const operatedFigure = operatedFigureRef.current;
    setChangedExamples((current) => {
      const index = current.findIndex(
        (example) => example.exampleId === exampleId,
      );
      const others = current.filter((_, other) => other !== index);
      if (!changed) {
        return index < 0 ? current : others;
      }
      const figure = operatedFigure ?? current[index]?.figure ?? null;
      return index === current.length - 1 && current[index]?.figure === figure
        ? current
        : [...others, { exampleId, figure }];
    });
  }, []);

  function reset() {
    setGeneration((current) => current + 1);
    setChangedExamples([]);
  }

  function findFigure(target: EventTarget): number | null {
    const examples = examplesRef.current;
    const figure = target instanceof Element ? target.closest("figure") : null;
    if (examples === null || figure === null) {
      return null;
    }
    const index = Array.from(examples.querySelectorAll("figure")).indexOf(
      figure,
    );
    return index < 0 ? null : index;
  }

  // 押す・なぞる・キーで操作した図を覚え、例が変わったと知らせたときに、その図をボタンを置く例にする。
  // 例が知らせる前に届くよう、捕まえる段で受ける。指で送り始めた手（pointercancel で終わる手）と、フォーカスを送る Tab は数えない。
  function noteOperatedFigure(event: SyntheticEvent) {
    operatedFigureRef.current =
      findFigure(event.target) ?? operatedFigureRef.current;
  }
  function notePointerDown(event: SyntheticEvent) {
    figureBeforePointerRef.current = operatedFigureRef.current;
    noteOperatedFigure(event);
  }
  function forgetCancelledPointer() {
    operatedFigureRef.current = figureBeforePointerRef.current;
  }
  function noteKeyDown(event: KeyboardEvent) {
    if (event.key !== "Tab") {
      noteOperatedFigure(event);
    }
  }

  const placement = placementClassNames[resetButtonLayout.placement];
  const changedFigure = changedExamples.at(-1)?.figure ?? null;
  const spot =
    (changedFigure === null ? null : resetButtonLayout.spots[changedFigure]) ??
    (resetButtonLayout.placement === "beside-example"
      ? (resetButtonLayout.spots[0] ?? null)
      : null);
  return (
    <div
      data-reset-button-placement={
        resettable ? resetButtonLayout.placement : undefined
      }
      data-reset-button-below-board={
        resettable && resetButtonLayout.belowBoard ? "" : undefined
      }
      className={cn("relative rounded-lg bg-muted px-4", placement.panel)}
      style={
        {
          "--how-to-play-reset-space-below": `${resetButtonLayout.spaceBelowPx}px`,
        } as CSSProperties
      }
    >
      <div ref={contentRef} className="@container relative">
        <div
          ref={examplesRef}
          className={arrangementClassNames[arrangement]}
          onPointerDownCapture={resettable ? notePointerDown : undefined}
          onPointerCancelCapture={
            resettable ? forgetCancelledPointer : undefined
          }
          onClickCapture={resettable ? noteOperatedFigure : undefined}
          onKeyDownCapture={resettable ? noteKeyDown : undefined}
        >
          <ReportChangeContext value={reportChange}>
            <Fragment key={generation}>{children}</Fragment>
          </ReportChangeContext>
        </div>
        {resettable ? (
          <span
            data-reset-button-side={spot?.side}
            className={cn("absolute", spot === null && placement.button)}
            style={
              spot === null ? undefined : { top: spot.top, [spot.side]: 0 }
            }
          >
            <HowToPlayExampleResetButton
              changed={changedExamples.length > 0}
              onPress={reset}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export const _private = { findResetButtonPosition, findResetButtonSpot };
