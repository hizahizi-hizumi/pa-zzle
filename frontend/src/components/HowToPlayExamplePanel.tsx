import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useState,
} from "react";

import { HowToPlayExampleResetButton } from "@/components/HowToPlayExampleResetButton";

/**
 * 例の並べ方。
 * - `side-by-side`: 左にできる形、右にできない形を横に並べる。2つの例の実際の幅と間が、面の幅から元に戻すボタンの分を除いた幅に収まらないときは、縦に並べる。
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
};

/**
 * 縦に並べた例の間。判定の下に添える2行目の言葉（例が教えるルールとは別に破ったルール）を、場所を取らずに例の下に重ねるので、
 * その言葉の高さに、判定と自分の盤面の間より広い間を足して、次の盤面と離す。
 * 横に並べるときは、左右に元に戻すボタンと間の分（40px）を空けた幅に2つの例が収まるときだけ1行に並べ、収まらなければ折り返す。
 * 右の例の右端は面の内側の右端から 40px 以上離れるので、右下の角の元に戻すボタン（36px）は、どの幅でも例の言葉と重ならない。
 */
const arrangementClassNames = {
  "side-by-side":
    "flex flex-wrap items-end justify-center gap-x-3 gap-y-10 px-10",
  stacked: "flex flex-col items-center gap-10",
} as const satisfies Record<HowToPlayExampleArrangement, string>;

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
 * 例を並べる、背景差だけの面。面はどこでも置き場所の幅いっぱいにそろえ、内側の余白も同じにし、図は面の中で中央に置く。
 * 図が面の内側の幅に合わせて大きさを決められるよう、余白の内側をコンテナにする。
 * 上下の余白は `--how-to-play-panel-padding-block` で中の図に渡し、図が面の中に動く場所を取るときに使えるようにする。
 * 触れる例の面では、面の中のどれかの例が最初の姿と違う間だけ、面の右下の角に元に戻すボタンを出す。
 * ボタンは面の内側の余白の右端にそろえて角に重ね、そのための行の高さを取らない。例の図と言葉は中央に寄せるので、ボタンは長い言葉や盤面と重ならない。
 * 戻すときは面の例を作り直して、最初の姿にする。
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

  return (
    <div className="relative rounded-lg bg-muted px-4 py-(--how-to-play-panel-padding-block) [--how-to-play-panel-padding-block:--spacing(8)]">
      <div className="@container">
        <div className={arrangementClassNames[arrangement]}>
          <ReportChangeContext value={reportChange}>
            <Fragment key={generation}>{children}</Fragment>
          </ReportChangeContext>
        </div>
      </div>
      {resettable ? (
        // ボタン（36px）の縦の中心を、例の下の言葉の1行目（面の下の余白の上の 24px の行）の中心にそろえる。
        <span className="absolute right-4 bottom-[calc(var(--how-to-play-panel-padding-block)-6px)]">
          <HowToPlayExampleResetButton
            changed={changedExampleIds.size > 0}
            onPress={reset}
          />
        </span>
      ) : null}
    </div>
  );
}
