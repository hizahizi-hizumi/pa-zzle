import {
  type CSSProperties,
  createContext,
  Fragment,
  type ReactNode,
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
   * 触れる例を置く面か。置くときは、面の例をまとめて最初の姿に戻すボタンを面の右下の角に置く。
   * 例は `useReportHowToPlayExampleChange` で、最初の姿から変わったかを面に知らせる。
   */
  resettable?: boolean;
  /**
   * 面に敷く地。渡すと、背景差の色の代わりに、面いっぱいにこの地を敷く。本番の盤面が地の上に描かれるゲームが、例の盤面を
   * 地の箱で囲まずに、面そのものを盤面の地にするときに渡す。
   */
  ground?: ReactNode;
};

/**
 * 元に戻すボタンを置く所。上から順に、例と言葉に重ならない所を選ぶ。
 * - `beside-caption`: 例の下の言葉の1行目の右（言葉の無い面では、例の下端の右）。ボタンのために高さを取らない。
 * - `top-corner`: 面の右上の角。例の下の右に置くと例か言葉に届き、右上には例が届かない面で、ボタンのために高さを取らない。
 * - `below-examples`: 例の下。どちらの角にも例か言葉が届く面で、ボタンの列にある例と言葉の下にボタンの分の高さを取る。
 */
type ResetButtonPlacement = "beside-caption" | "top-corner" | "below-examples";

/**
 * 元に戻すボタンの置き場所と、例の下に置くときに、ボタンの列で面の内側の下端より下に描かれる言葉（判定の下のわけ）の高さ（px）。
 */
type ResetButtonPosition = {
  placement: ResetButtonPlacement;
  inkBelowPx: number;
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
 * - 言葉の行の右と右上の角: 上下を 32px にそろえる。ボタン（36px）の縦の中心を、下では言葉の1行目（下の余白の上の 24px の行）の
 *   中心に、上では同じ間だけ上の余白から下げた所にそろえ、どちらの角でも面の縁から同じ所に置く。
 * - 例の下: ボタンの列で面の内側の下端より下に描かれる言葉（`--how-to-play-reset-ink-below`）の下に、4px 空けてボタンを置き、
 *   その下に 6px を残す（下の余白は 46px からになる）。言葉の無い面では、上の余白も同じにしてそろえる。
 */
const placementClassNames = {
  "beside-caption": {
    panel:
      "py-(--how-to-play-panel-padding-block) [--how-to-play-panel-padding-block:--spacing(8)]",
    button: "bottom-[calc(var(--how-to-play-panel-padding-block)-6px)]",
  },
  "top-corner": {
    panel:
      "py-(--how-to-play-panel-padding-block) [--how-to-play-panel-padding-block:--spacing(8)]",
    button: "top-[calc(var(--how-to-play-panel-padding-block)-6px)]",
  },
  "below-examples": {
    panel:
      "pt-(--how-to-play-panel-padding-block) pb-[calc(var(--how-to-play-reset-ink-below)+46px)] [--how-to-play-panel-padding-block:calc(var(--how-to-play-reset-ink-below)+46px)] has-[figcaption]:[--how-to-play-panel-padding-block:--spacing(8)]",
    button: "bottom-1.5",
  },
} as const satisfies Record<
  ResetButtonPlacement,
  { panel: string; button: string }
>;

/** 元に戻すボタンの大きさ（px）と、例との間に空ける幅（px）。 */
const RESET_BUTTON_SIZE_PX = 36;
const RESET_BUTTON_CLEARANCE_PX = 4;

/** 角に置いたボタンが、面の内側の上端・下端から内へ届く高さと、外へはみ出す高さ（px）。 */
const RESET_BUTTON_REACH_INSIDE_PX = 30;
const RESET_BUTTON_REACH_OUTSIDE_PX = 6;

type Box = { left: number; right: number; top: number; bottom: number };

/** 面の内側の右の、ボタンを置く角の矩形。ボタンは面の内側の右端にそろえ、例との間を取る。 */
function getResetButtonBox(
  content: Box,
  placement: Exclude<ResetButtonPlacement, "below-examples">,
): Box {
  const left = content.right - RESET_BUTTON_SIZE_PX - RESET_BUTTON_CLEARANCE_PX;
  if (placement === "beside-caption") {
    return {
      left,
      right: content.right,
      top: content.bottom - RESET_BUTTON_REACH_INSIDE_PX,
      bottom: content.bottom + RESET_BUTTON_REACH_OUTSIDE_PX,
    };
  }
  return {
    left,
    right: content.right,
    top: content.top - RESET_BUTTON_REACH_OUTSIDE_PX,
    bottom: content.top + RESET_BUTTON_REACH_INSIDE_PX,
  };
}

function overlaps(box: Box, examples: readonly Box[]): boolean {
  return examples.some(
    (example) =>
      example.right > example.left &&
      example.right > box.left &&
      example.bottom > box.top &&
      example.top < box.bottom,
  );
}

/**
 * 元に戻すボタンの置き場所。`content` は面の内側の矩形、`examples` は例の盤面と言葉の矩形。
 * 高さを取らない角（言葉の行の右、次に右上）のうち、例と言葉に重ならない所を選ぶ。
 * どちらも重なれば例の下にし、ボタンの列で面の内側の下端より下に描かれる言葉の高さを返す。
 */
function findResetButtonPosition(
  content: Box,
  examples: readonly Box[],
): ResetButtonPosition {
  const corners = ["beside-caption", "top-corner"] as const;
  const corner = corners.find(
    (candidate) => !overlaps(getResetButtonBox(content, candidate), examples),
  );
  if (corner !== undefined) {
    return { placement: corner, inkBelowPx: 0 };
  }
  const columnLeft =
    content.right - RESET_BUTTON_SIZE_PX - RESET_BUTTON_CLEARANCE_PX;
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

const initialResetButtonPosition: ResetButtonPosition = {
  placement: "beside-caption",
  inkBelowPx: 0,
};

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
 * 上の余白は `--how-to-play-panel-padding-block` で中の図に渡し、図が面の中に動く場所を取るときに使えるようにする。
 * 触れる例の面では、面の中のどれかの例が最初の姿と違う間だけ、面の右下の角に元に戻すボタンを出す。
 * ボタンは面の内側の右端にそろえ、言葉の行の右か面の右上の角に、例と言葉に重ならなければ高さを取らずに重ね、どちらも重なれば例の下に置く。
 * 置き場所は例と面の大きさから決め、ボタンを出し入れしても変えない。戻すときは面の例を作り直して、最初の姿にする。
 */
export function HowToPlayExamplePanel({
  children,
  arrangement = "side-by-side",
  resettable = false,
  ground,
}: HowToPlayExamplePanelProps) {
  const [generation, setGeneration] = useState(0);
  const [changedExampleIds, setChangedExampleIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [resetButtonPosition, setResetButtonPosition] =
    useState<ResetButtonPosition>(initialResetButtonPosition);
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
      const next = findResetButtonPosition(
        content.getBoundingClientRect(),
        measureExampleBoxes(listExampleParts(examples)),
      );
      setResetButtonPosition((current) =>
        current.placement === next.placement &&
        current.inkBelowPx === next.inkBelowPx
          ? current
          : next,
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
  }

  const placement = placementClassNames[resetButtonPosition.placement];
  return (
    <div
      data-reset-button-placement={
        resettable ? resetButtonPosition.placement : undefined
      }
      className={cn(
        "relative isolate rounded-lg px-4",
        ground === undefined && "bg-muted",
        placement.panel,
      )}
      style={
        {
          "--how-to-play-reset-ink-below": `${resetButtonPosition.inkBelowPx}px`,
        } as CSSProperties
      }
    >
      {ground === undefined ? null : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 overflow-hidden rounded-lg"
        >
          {ground}
        </div>
      )}
      <div ref={contentRef} className="@container">
        <div ref={examplesRef} className={arrangementClassNames[arrangement]}>
          <ReportChangeContext value={reportChange}>
            <Fragment key={generation}>{children}</Fragment>
          </ReportChangeContext>
        </div>
      </div>
      {resettable ? (
        <span className={cn("absolute right-4", placement.button)}>
          <HowToPlayExampleResetButton
            changed={changedExampleIds.size > 0}
            onPress={reset}
          />
        </span>
      ) : null}
    </div>
  );
}

export const _private = { findResetButtonPosition };
