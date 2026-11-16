import type { CSSProperties } from "react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
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
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  board: HitofudePuzzleBoardState;
  path: readonly number[];
  isDeadEnd: boolean;
  solved: boolean;
  clearing: boolean;
  blockedMove: HitofudePuzzleBlockedMove | null;
  /** 押す所の手がかりを付けるマス。マスの内側に沿う破線の枠と、マスの右下の角の内側の指のアイコンを、動かさずに描く。 */
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
 * マスの中央に置く手ごとの印の大きさ。まだ通っていないマスと穴の中央に、読める大きさ（マス幅の 0.38 倍）で置く。
 * 押す所の手がかりの指は、マスの右下の角から 0.06 マス内側に、14px を下限に置かれる。マスが 40px より小さい狭い画面では、
 * 0.38 倍の ✕ の腕の端がその指の人差し指に届くので（幅 320px の 36px のマスで描いて確かめた）、腕の端が指の 2px 手前で止まる
 * 「マス幅の 1.76 倍 − 53px」までに小さくする。式は、14px の指の人差し指の左の線（指の箱の左から 0.21）と ✕ の腕の端（印の 0.75 と線の太さ）から求めた。
 */
const markSide =
  "min(calc(var(--hitofude-figure-cell) * 0.38), calc(var(--hitofude-figure-cell) * 1.76 - 53px))";

const centerMarkStyle: CSSProperties = {
  top: "50%",
  left: "50%",
  width: markSide,
  height: markSide,
  transform: "translate(-50%, -50%)",
};

/**
 * 道が通ったマスの印の置き場所。マスの中央には道の線と始点の印があるので、印で隠さないよう左上の角に寄せる。
 * 道の線（中央の 0.35〜0.65 マス）と始点の印（中央から半径約 0.24 マス）に届かない、角から 0.06 マス・マス幅の 0.26 倍にする。
 * 右下の角の手がかりの指とは反対の角なので、指にも触れない。
 */
const cornerMarkStyle: CSSProperties = {
  top: "calc(var(--hitofude-figure-cell) * 0.06)",
  left: "calc(var(--hitofude-figure-cell) * 0.06)",
  width: "calc(var(--hitofude-figure-cell) * 0.26)",
  height: "calc(var(--hitofude-figure-cell) * 0.26)",
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
 * 手ごとの印は、まだ通っていないマスと穴では中央に置き、道が通ったマスでは道の線と始点の印を隠さないよう左上の角に置く。
 * 本番の×（阻まれた手）はマスの中央に点くので、今の道から弾かれた手の×が点いている間はそのマスの印を消す。
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
          touchScrollLock="stroke-start"
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
                className="absolute flex"
                style={path.includes(cell) ? cornerMarkStyle : centerMarkStyle}
              >
                <HowToPlayVerdictMark
                  verdict={rejection === null ? "allowed" : "disallowed"}
                  placement="board-halo"
                />
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
            <HowToPlayPressHint
              frame="inside"
              outline="rounded"
              pointer="inside-corner"
            />
          </span>
        )}
      </div>
    </div>
  );
}
