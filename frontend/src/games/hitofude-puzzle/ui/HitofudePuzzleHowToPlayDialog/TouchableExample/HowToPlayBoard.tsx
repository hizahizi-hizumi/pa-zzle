import { Pointer } from "lucide-react";
import type { CSSProperties } from "react";

import type { HitofudePuzzleBlockedMove } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleBoard as HitofudePuzzleBoardState } from "@/games/hitofude-puzzle/puzzle/board";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard";
import { hitofudePuzzleGroundClassName } from "@/games/hitofude-puzzle/ui/HitofudePuzzleGround";
import type { HitofudePuzzleExampleCandidate } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/example-board";
import {
  getHitofudePuzzleFigureCellBoxStyle,
  getHitofudePuzzleFigureSide,
  hitofudePuzzleFigureCellClassNames,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-size";
import { CandidateMark } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/TouchableExample/CandidateMark";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  board: HitofudePuzzleBoardState;
  path: readonly number[];
  isDeadEnd: boolean;
  solved: boolean;
  clearing: boolean;
  blockedMove: HitofudePuzzleBlockedMove | null;
  /** 押す所の手がかりを付けるマス。マスの内側の破線の枠と指のアイコンを、動かさずに描く。 */
  hintedCell: number | null;
  /** 手ごとに通れるかの印を付ける、先端の隣のマス。 */
  candidates?: readonly HitofudePuzzleExampleCandidate[];
  /** 残ったマスの印を付ける、まだ通っていないマス。判定の下で残りのマスの数を言う間だけ渡す。 */
  remainingCells?: readonly number[];
  /** 今の道から弾かれた手の、本番の×が点いているマス。そのマスの手ごとの印を、×と重ねないよう消す。 */
  blockedMarkCell?: number | null;
  /** 盤面の左から何列を見せるか。見せない右の列は、どれも穴にする。渡さなければ全部の列を見せる。 */
  visibleColumns?: number;
  onBeginStroke: (cell: number) => void;
  onTraceStroke: (step: HitofudePuzzleTraceStep) => void;
  onEndStroke: () => void;
  onClearAnimationComplete: () => void;
};

/**
 * 手ごとの印の置き場所の大きさ（マス幅に対する比）。マスの中央に、道の線（太さ 0.3 マス）を縁取りで隠して読める大きさで置き、
 * 記号の線がマスの内側の手がかりの枠（マスの辺から 0.1 マス）と、マスの右下の指（`hintPointerStyle`）に届かない大きさにする。
 */
const MARK_RATIO = 0.38;

/**
 * 手がかりの指の大きさと置き場所。マス幅の 0.3 倍（20px まで）にし、マスの右下の角から 0.06 マス内側に置く。
 * 指はマスの線と盤面の縁の内側に収まり、置き場所は 0.64 マスからになるので、中央の印の記号（0.31〜0.69 マスの置き場所の中で、
 * 線が角まで届かない ✓ / ✕）にも触れない。
 */
const hintPointerStyle: CSSProperties = {
  width: "min(20px, calc(var(--hitofude-figure-cell) * 0.3))",
  height: "min(20px, calc(var(--hitofude-figure-cell) * 0.3))",
  right: "calc(var(--hitofude-figure-cell) * 0.06)",
  bottom: "calc(var(--hitofude-figure-cell) * 0.06)",
};

const markPlacementStyle: CSSProperties = {
  width: `calc(var(--hitofude-figure-cell) * ${MARK_RATIO})`,
  height: `calc(var(--hitofude-figure-cell) * ${MARK_RATIO})`,
};

/** 残ったマスの印の大きさ。マスの中央に置く、手がかりの枠より小さな点。 */
const remainingMarkStyle: CSSProperties = {
  width: "calc(var(--hitofude-figure-cell) * 0.2)",
  height: "calc(var(--hitofude-figure-cell) * 0.2)",
};

/**
 * 触れる例の盤面。本番の盤面部品をそのまま使い、なぞる・押す・阻まれる・行き止まり・完成の反応を本番と同じにする。
 * 盤面の下にプレイ画面と同じ地を敷き、穴と縁の欠けを本番と同じ色で見せる。
 * マスは、ゴールの盤面のマスと同じ物に見える大きさ（`hitofudePuzzleFigureCellClassNames.example`）で描く。
 * 右の列がどれも穴の盤面は、その列を切り落として見せ、狭い画面でも例を横に並べられるようにする。切り落とした列のマスは、
 * 盤面部品が見えなくし、押しても受けない。
 * 手ごとの印は、どのマスでも中央に置き、どのマスの印かがひと目で分かるようにする。印は下の道の線を地の縁取りで隠す。
 * 本番の×（阻まれた手）もマスの中央に点くので、今の道から弾かれた手の×が点いている間はそのマスの印を消す。
 * 印は通ったマスや穴の上に置くので、通れないわけ（道が通っている・穴）が印の周りから押す前に読める。
 * 押す所の手がかりの枠と指は、印に触れないよう、枠はマスの縁に沿わせ、指はマスの右下の内側に小さく置く。
 * 判定の下で残りのマスの数を言う間は、まだ通っていないマスの中央に点を置き、どのマスが残ったかを盤面で示す。
 * 完成したら、本番と同じく受け付けない。
 */
export function HowToPlayBoard({
  board,
  path,
  isDeadEnd,
  solved,
  clearing,
  blockedMove,
  hintedCell,
  candidates = [],
  remainingCells = [],
  blockedMarkCell = null,
  visibleColumns = board.size,
  onBeginStroke,
  onTraceStroke,
  onEndStroke,
  onClearAnimationComplete,
}: HowToPlayBoardProps) {
  const side = getHitofudePuzzleFigureSide(board.size);
  const cropped = visibleColumns < board.size;
  return (
    <div
      className={cn(
        "relative shrink-0",
        hitofudePuzzleFigureCellClassNames.example,
      )}
      style={{
        width: getHitofudePuzzleFigureSide(visibleColumns),
        height: side,
        // 切り落とした列は描かない。外形の線は盤面の縁の外へ少しはみ出して描かれるので、その分は残す。
        clipPath: cropped ? "inset(-4px)" : undefined,
      }}
    >
      <div
        aria-hidden="true"
        className={cn("absolute inset-0", hitofudePuzzleGroundClassName)}
      />
      <div
        className="absolute top-0 left-0"
        style={{ width: side, height: side }}
      >
        <HitofudePuzzleBoard
          board={board}
          path={path}
          isDeadEnd={isDeadEnd}
          blockedMove={blockedMove}
          solved={solved}
          clearing={clearing}
          interactionDisabled={solved}
          visibleColumns={visibleColumns}
          onBeginStroke={onBeginStroke}
          onTraceStroke={onTraceStroke}
          onEndStroke={onEndStroke}
          onClearAnimationComplete={onClearAnimationComplete}
        />
        {candidates
          .filter(({ cell }) => cell !== blockedMarkCell)
          .map(({ cell, rejection }) => (
            <span
              key={cell}
              aria-hidden="true"
              data-candidate-cell={cell}
              data-candidate-verdict={
                rejection === null ? "allowed" : "disallowed"
              }
              className="pointer-events-none absolute"
              style={getHitofudePuzzleFigureCellBoxStyle(board.size, cell)}
            >
              <span
                data-candidate-mark=""
                className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2"
                style={markPlacementStyle}
              >
                <CandidateMark allowed={rejection === null} size="cell" />
              </span>
            </span>
          ))}
        {remainingCells.map((cell) => (
          <span
            key={cell}
            aria-hidden="true"
            data-remaining-cell={cell}
            className="pointer-events-none absolute flex items-center justify-center"
            style={getHitofudePuzzleFigureCellBoxStyle(board.size, cell)}
          >
            <span
              className="rounded-full bg-muted-foreground"
              style={remainingMarkStyle}
            />
          </span>
        ))}
        {hintedCell === null ? null : (
          <span
            aria-hidden="true"
            data-hinted-cell={hintedCell}
            className="pointer-events-none absolute"
            style={getHitofudePuzzleFigureCellBoxStyle(board.size, hintedCell)}
          >
            <span
              data-hint-frame=""
              className="absolute inset-[10%] rounded-[22%] border border-muted-foreground border-dashed"
            />
            <Pointer
              data-hint-pointer=""
              className="absolute fill-background text-muted-foreground"
              style={hintPointerStyle}
            />
          </span>
        )}
      </div>
    </div>
  );
}
