import {
  type CSSProperties,
  createContext,
  Fragment,
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
   * 触れる例を置く面か。置くときは、面の例をまとめて最初の姿に戻すボタンを、最後に触った例の近くの面の縁に置く。
   * 例は `useReportHowToPlayExampleChange` で、最初の姿から変わったかを面に知らせる。
   */
  resettable?: boolean;
};

/**
 * 元に戻すボタンを置く所。
 * - `beside-example`: どの例にも、その例の横に例と言葉に重ならない所（`ResetButtonSpot`）があり、最後に触った例の横に置く。
 *   ボタンのために高さを取らない。
 * - 横に置けない例がある面では、面に1つの所に置く。上から順に、例と言葉に重ならない所を選ぶ。
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
 * 例1つの横の、元に戻すボタンの所。`side` は面の左右どちらの縁に置くか、`top` は面の上端からボタンの上端までの高さ（px）。
 */
type ResetButtonSpot = { side: "left" | "right"; top: number };

/**
 * 元に戻すボタンの置き場所と、例の下に置くときに、ボタンの列で面の内側の下端より下に描かれる言葉（判定の下のわけ）の高さ（px）。
 */
type ResetButtonPosition = {
  placement: ResetButtonPlacement;
  inkBelowPx: number;
};

/** 面の置き場所と、面の例ごと（並びの順）の、横に置ける所。横に置けない例は `null`。 */
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
 * どの置き場所でも上の余白は 32px にし、面ごとに例の始まる高さを変えない。ボタンは面の右の縁から 16px に置く。
 * - 言葉の行の右: 下の余白を 32px にし、ボタン（36px）を下の縁から 24px に置いて、縦の中心を言葉の1行目（下の余白の上の 24px の行）の
 *   中心にほぼそろえる。
 * - 右上の角: 下の余白を 32px にし、ボタンを上の縁から右と同じ 16px に置く。
 * - 例の下: 下にだけボタンの分の高さを取る。ボタンの列で面の内側の下端より下に描かれる言葉（`--how-to-play-reset-ink-below`）の下に
 *   4px 空けてボタンを置き、その下に 8px を残す（下の余白は 48px からになる）。
 */
const placementClassNames = {
  "beside-example": {
    panel: "py-8",
    button: "",
  },
  "beside-caption": {
    panel: "py-8",
    button: "bottom-6",
  },
  "top-corner": {
    panel: "py-8",
    button: "top-4",
  },
  "below-examples": {
    panel: "pt-8 pb-[calc(var(--how-to-play-reset-ink-below)+--spacing(12))]",
    button: "bottom-2",
  },
} as const satisfies Record<
  ResetButtonPlacement,
  { panel: string; button: string }
>;

/** 元に戻すボタンの大きさ（px）と、例との間に空ける幅（px）。 */
const RESET_BUTTON_SIZE_PX = 36;
const RESET_BUTTON_CLEARANCE_PX = 4;

/** 面の上下の内側の余白（px）。例の横に置くときは、どの置き場所でも同じ上の余白を前提に、面の上端からの高さを決める。 */
const PANEL_PADDING_BLOCK_PX = 32;
/** ボタンを面の左右の縁から離す幅（px、`px-4` と同じ）と、面の上下の縁から少なくとも離す幅（px）。 */
const RESET_BUTTON_EDGE_PX = 16;
const RESET_BUTTON_PANEL_MARGIN_PX = 8;
/** 例の下の言葉の1行目の高さ（px、`HowToPlayExample` の言葉の置き場所の最小の高さ）。 */
const CAPTION_LINE_PX = 24;

/**
 * 角に置いたボタンが、面の内側の端から内へ届く高さと、外へはみ出す高さ（px）。面の上下の余白は 32px。
 * 下の角は下の縁から 24px（内へ 28px・外へ 8px）、上の角は上の縁から 16px（内へ 20px・外へ 16px）に置く。
 */
const RESET_BUTTON_REACH = {
  "beside-caption": { inside: 28, outside: 8 },
  "top-corner": { inside: 20, outside: 16 },
} as const;

type Box = { left: number; right: number; top: number; bottom: number };

/** 面の内側の右の、ボタンを置く角の矩形。ボタンは面の内側の右端にそろえ、例との間を取る。 */
function getResetButtonBox(
  content: Box,
  placement: keyof typeof RESET_BUTTON_REACH,
): Box {
  const left = content.right - RESET_BUTTON_SIZE_PX - RESET_BUTTON_CLEARANCE_PX;
  const { inside, outside } = RESET_BUTTON_REACH[placement];
  if (placement === "beside-caption") {
    return {
      left,
      right: content.right,
      top: content.bottom - inside,
      bottom: content.bottom + outside,
    };
  }
  return {
    left,
    right: content.right,
    top: content.top - outside,
    bottom: content.top + inside,
  };
}

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

/**
 * 例1つの横の、元に戻すボタンの所。`content` は面の内側の矩形、`figure` は例の矩形、`caption` は例の下の言葉の置き場所の矩形
 * （言葉の無い例では `null`）、`examples` は面のすべての例の盤面と言葉の矩形。
 * 例の中心が面の中心より左なら面の左の縁、そうでなければ右の縁に置く。上から順に、言葉の1行目の横（言葉の無い例では例の下端の横）、
 * 例の上端の横のうち、どの例と言葉にも重ならず、面の上下の縁から 8px 以上内側に収まる所を選ぶ。どちらも無ければ `null`。
 */
function findResetButtonSpot(
  content: Box,
  figure: Box,
  caption: Box | null,
  examples: readonly Box[],
): ResetButtonSpot | null {
  const side =
    (figure.left + figure.right) / 2 < (content.left + content.right) / 2 - 1
      ? "left"
      : "right";
  const inner = RESET_BUTTON_SIZE_PX + RESET_BUTTON_CLEARANCE_PX;
  const left = side === "right" ? content.right - inner : content.left;
  const right = side === "right" ? content.right : content.left + inner;
  const panelTop = content.top - PANEL_PADDING_BLOCK_PX;
  const panelBottom = content.bottom + PANEL_PADDING_BLOCK_PX;
  const besideCaption =
    caption === null
      ? figure.bottom - RESET_BUTTON_SIZE_PX
      : caption.top +
        (Math.min(caption.bottom - caption.top, CAPTION_LINE_PX) -
          RESET_BUTTON_SIZE_PX) /
          2;
  const besideTop = figure.top - RESET_BUTTON_EDGE_PX;
  const top = [besideCaption, besideTop].find((candidate) => {
    const box = {
      left,
      right,
      top: candidate,
      bottom: candidate + RESET_BUTTON_SIZE_PX,
    };
    return (
      box.top >= panelTop + RESET_BUTTON_PANEL_MARGIN_PX &&
      box.bottom <= panelBottom - RESET_BUTTON_PANEL_MARGIN_PX &&
      !overlaps(box, examples)
    );
  });
  return top === undefined ? null : { side, top: Math.round(top - panelTop) };
}

/**
 * 元に戻すボタンの置き場所。`content` は面の内側の矩形、`examples` は例の盤面と言葉の矩形、`exampleCount` は面の例の数。
 * 高さを取らない角（例が1つなら言葉の行の右、次に右上）のうち、例と言葉に重ならない所を選ぶ。
 * どれも重なれば例の下にし、面の内側の下端より下に描かれる言葉の高さを返す。例が1つならボタンの列に描かれる言葉だけを数え、
 * 2つ以上なら、ボタンが最後の例の言葉の横に並んでその例だけを戻すボタンに見えないよう、どの列の言葉も数えて、言葉の下に置く。
 */
function findResetButtonPosition(
  content: Box,
  examples: readonly Box[],
  exampleCount = 1,
): ResetButtonPosition {
  const corners =
    exampleCount > 1
      ? (["top-corner"] as const)
      : (["beside-caption", "top-corner"] as const);
  const corner = corners.find(
    (candidate) => !overlaps(getResetButtonBox(content, candidate), examples),
  );
  if (corner !== undefined) {
    return { placement: corner, inkBelowPx: 0 };
  }
  const columnLeft =
    exampleCount > 1
      ? content.left
      : content.right - RESET_BUTTON_SIZE_PX - RESET_BUTTON_CLEARANCE_PX;
  const inkBelowPx = Math.max(
    0,
    ...examples
      .filter(({ left, right }) => right > left && right > columnLeft)
      .map(({ bottom }) => Math.ceil(bottom - content.bottom)),
  );
  return { placement: "below-examples", inkBelowPx };
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

function measureExampleBoxes(parts: readonly HTMLElement[]): Box[] {
  return parts.flatMap((part) =>
    part.tagName === "FIGCAPTION"
      ? [...listCaptionInkBoxes(part), ...listVerdictReasonBoxes(part)]
      : [part.getBoundingClientRect()],
  );
}

const initialResetButtonLayout: ResetButtonLayout = {
  placement: "beside-caption",
  inkBelowPx: 0,
  spots: [],
};

/**
 * 面の例と面の大きさから、元に戻すボタンの置き場所を決める。どの例にも横に置ける所があれば、例の横に置き、高さを取らない。
 * 横に置けない例があれば、面に1つの所（`findResetButtonPosition`）も決めておき、その例を触ったときはそこに置く。
 */
function measureResetButtonLayout(
  content: HTMLElement,
  examples: HTMLElement,
): ResetButtonLayout {
  const contentBox = content.getBoundingClientRect();
  const exampleBoxes = measureExampleBoxes(listExampleParts(examples));
  const figures = Array.from(examples.querySelectorAll("figure"));
  const spots = figures.map((figure) => {
    const caption = figure.querySelector("figcaption");
    return findResetButtonSpot(
      contentBox,
      figure.getBoundingClientRect(),
      caption === null ? null : caption.getBoundingClientRect(),
      exampleBoxes,
    );
  });
  if (spots.length > 0 && spots.every((spot) => spot !== null)) {
    return { placement: "beside-example", inkBelowPx: 0, spots };
  }
  return {
    ...findResetButtonPosition(contentBox, exampleBoxes, figures.length),
    spots,
  };
}

function isSameLayout(left: ResetButtonLayout, right: ResetButtonLayout) {
  return (
    left.placement === right.placement &&
    left.inkBelowPx === right.inkBelowPx &&
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
 * 例を並べる、背景差だけの面。面はどこでも置き場所の幅いっぱいにそろえ、図は面の中で中央に置く。
 * 図が面の内側の幅に合わせて大きさを決められるよう、余白の内側をコンテナにする。
 * 上の余白（32px）は `--how-to-play-panel-padding-block` で中の図に渡し、図が面の中に動く場所を取るときに使えるようにする。
 * 触れる例の面では、面の中のどれかの例が最初の姿と違う間だけ、元に戻すボタンを出す。
 * ボタンは、最後に触った例の横の面の縁（例が面の左寄りなら左、ほかは右）から 16px に、その例の言葉の1行目の横か例の上端の横で、
 * 例と言葉に重ならない所に高さを取らずに重ねる。縦に積んだ例でも横に並べた例でも、触った例のそばに出し、画面の外に出さない。
 * 横に置けない例を触ったときは、面に1つの所（言葉の行の右・面の右上の角・例の下）に置く。
 * 置き場所は例と面の大きさから決め、ボタンを出し入れしても変えない。戻すときは面の例を作り直して、最初の姿にする。
 */
export function HowToPlayExamplePanel({
  children,
  arrangement = "side-by-side",
  resettable = false,
}: HowToPlayExamplePanelProps) {
  const [generation, setGeneration] = useState(0);
  const [changedExampleIds, setChangedExampleIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [resetButtonLayout, setResetButtonLayout] = useState<ResetButtonLayout>(
    initialResetButtonLayout,
  );
  const [touchedFigure, setTouchedFigure] = useState<number | null>(null);
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

  const reportChange = useCallback<ReportChange>((exampleId, changed) => {
    setChangedExampleIds((current) => {
      if (current.has(exampleId) === changed) {
        return current;
      }
      const next = new Set(current);
      if (changed) {
        next.add(exampleId);
      } else {
        next.delete(exampleId);
      }
      return next;
    });
  }, []);

  function reset() {
    setGeneration((current) => current + 1);
    setChangedExampleIds(new Set());
    setTouchedFigure(null);
  }

  // 押す・なぞる・キーで操作した例を、ボタンを置く例として覚える。例が変わったと知らせる前に届くよう、捕まえる段で受ける。
  function noteTouchedFigure(event: SyntheticEvent) {
    const examples = examplesRef.current;
    const figure =
      event.target instanceof Element ? event.target.closest("figure") : null;
    if (examples === null || figure === null) {
      return;
    }
    const index = Array.from(examples.querySelectorAll("figure")).indexOf(
      figure,
    );
    if (index >= 0) {
      setTouchedFigure(index);
    }
  }

  const placement = placementClassNames[resetButtonLayout.placement];
  const spot =
    (touchedFigure === null ? null : resetButtonLayout.spots[touchedFigure]) ??
    (resetButtonLayout.placement === "beside-example"
      ? (resetButtonLayout.spots[0] ?? null)
      : null);
  return (
    <div
      data-reset-button-placement={
        resettable ? resetButtonLayout.placement : undefined
      }
      className={cn(
        "relative rounded-lg bg-muted px-4 [--how-to-play-panel-padding-block:--spacing(8)]",
        placement.panel,
      )}
      style={
        {
          "--how-to-play-reset-ink-below": `${resetButtonLayout.inkBelowPx}px`,
        } as CSSProperties
      }
    >
      <div ref={contentRef} className="@container">
        <div
          ref={examplesRef}
          className={arrangementClassNames[arrangement]}
          onPointerDownCapture={resettable ? noteTouchedFigure : undefined}
          onClickCapture={resettable ? noteTouchedFigure : undefined}
          onKeyDownCapture={resettable ? noteTouchedFigure : undefined}
        >
          <ReportChangeContext value={reportChange}>
            <Fragment key={generation}>{children}</Fragment>
          </ReportChangeContext>
        </div>
      </div>
      {resettable ? (
        <span
          data-reset-button-side={spot?.side}
          className={cn(
            "absolute",
            spot === null && ["right-4", placement.button],
          )}
          style={
            spot === null
              ? undefined
              : { top: spot.top, [spot.side]: RESET_BUTTON_EDGE_PX }
          }
        >
          <HowToPlayExampleResetButton
            changed={changedExampleIds.size > 0}
            onPress={reset}
          />
        </span>
      ) : null}
    </div>
  );
}

export const _private = { findResetButtonPosition, findResetButtonSpot };
