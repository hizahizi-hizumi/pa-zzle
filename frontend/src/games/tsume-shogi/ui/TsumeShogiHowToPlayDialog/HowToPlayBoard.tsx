import { type CSSProperties, useRef } from "react";

import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import { useTouchTap } from "@/components/touch-tap";
import {
  formatTsumeShogiSquareKey,
  type TsumeShogiPlayedMove,
} from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  isSameTsumeShogiSquare,
  type TsumeShogiBoardPiece,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import type {
  TsumeShogiPromotionChoice,
  TsumeShogiRejection,
  TsumeShogiSelection,
} from "@/games/tsume-shogi/session/session";
import {
  findTsumeShogiBoardPiece,
  getTsumeShogiSquareHighlight,
  TSUME_SHOGI_SELECTED_PIECE_GLYPH_SELECTOR,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard";
import { TsumeShogiBoardWood } from "@/games/tsume-shogi/ui/board/TsumeShogiBoardWood";
import { TsumeShogiCoordinateLabel } from "@/games/tsume-shogi/ui/board/TsumeShogiCoordinateLabel";
import { TsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiPromotionPicker";
import { TsumeShogiSquareButton } from "@/games/tsume-shogi/ui/board/TsumeShogiSquareButton";
import { formatTsumeShogiRank } from "@/games/tsume-shogi/ui/piece-label";
import type {
  TsumeShogiCandidateMark,
  TsumeShogiExampleHint,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import type { TsumeShogiFigureCrop } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useRejectedPieceFeedback } from "@/games/tsume-shogi/ui/use-rejected-piece-feedback";
import { cn } from "@/lib/utils";

type HowToPlayBoardProps = {
  crop: TsumeShogiFigureCrop;
  /**
   * 盤の上と右の縁に、本番と同じ筋と段を書くか。書かない小さな図（採点の流れのコマ）は、縁を細い木の帯にする。
   */
  coordinates: boolean;
  boardPieces: readonly TsumeShogiBoardPiece[];
  boardPieceIds: ReadonlyMap<string, string>;
  selection: TsumeShogiSelection | null;
  shownMoves: readonly TsumeShogiPlayedMove[];
  shownMovesRestored: boolean;
  promotionChoice: TsumeShogiPromotionChoice | null;
  rejection: TsumeShogiRejection | null;
  mated: boolean;
  /** 本番の盤面と同じく、玉方の応手を待つ間や詰んだ後に押せなくする。 */
  interactionDisabled?: boolean;
  /** 渡すと、本番の盤面と同じく升を押せる。渡さない盤面は、本番の盤面の押せない間と同じに描く。 */
  onSelectSquare?: (square: TsumeShogiSquare) => void;
  onChoosePromotion?: (promote: boolean) => void;
  /** 次に押す升か、成るかの選択肢の手がかり。持駒の手がかりは駒台が描く。 */
  hint?: TsumeShogiExampleHint | null;
  /** 選んでいる駒の行き先ごとの ✓ / ✕ の札。 */
  candidateMarks?: readonly TsumeShogiCandidateMark[];
  /** 押せない図で、その前の操作で駒を指した升。押した所を囲む無彩の枠で示す。 */
  operatedSquare?: TsumeShogiSquare | null;
};

/** 升の幅（`--tsume-shogi-figure-square`）から決める、升の高さと縁の幅。升は本番と同じ縦長（横 35.2 : 縦 38.6）。 */
const squareHeight = "calc(var(--tsume-shogi-figure-square) * 386 / 352)";
/** 筋と段を書く縁のいちばん広い幅（px）。盤の大きさを置き場所から決める図は、この幅を除いて升の幅を決める。 */
export const TSUME_SHOGI_FIGURE_LABELED_FRAME_MAX_PX = 21;

const frameWidths = {
  labeled: `clamp(16px, calc(var(--tsume-shogi-figure-square) * 0.34), ${TSUME_SHOGI_FIGURE_LABELED_FRAME_MAX_PX}px)`,
  plain: "clamp(3px, calc(var(--tsume-shogi-figure-square) * 0.16), 6px)",
} as const;

/**
 * 切り出した左と下の端に見せる、淡く消えていく升の幅の、升の幅に対する比。小さな図は、コマを並べる幅を取るよう細くする。
 */
const fadeRatios = { labeled: 0.5, plain: 0.25 } as const;

/** 切り出した左と下の端へ、盤の木と罫線を淡く消していく。 */
function createFadeMaskStyle(fadeWidth: string, fadeHeight: string) {
  return {
    maskImage: `linear-gradient(to right, transparent, #000 ${fadeWidth}), linear-gradient(to top, transparent, #000 ${fadeHeight})`,
    maskComposite: "intersect",
    WebkitMaskComposite: "source-in",
  } as CSSProperties;
}

function ignoreSquare() {}

function ignorePromotion() {}

/**
 * 遊び方の盤面。本番の盤の右上の隅を切り出し、本番の升・駒・木・筋と段の字・成るかの選択肢・揺れ・指した駒の動き・詰みの姿で描く。
 * 盤の本当の端（上と右）には本番と同じ縁と筋・段を置き、切り出した左と下の端は、升を半分だけ淡く消して盤が続くことを見せる。
 * 消えていく升は飾りで、押せない。手がかりと行き先の札は、盤面の升の上に重ね、周りの並びを動かさない。
 * 詰みの演出（`TsumeShogiClearAnimation`）は、本番と同じく `data-board-squares` の升のボタンを探すので、包めば同じに動く。
 */
export function HowToPlayBoard({
  crop,
  coordinates,
  boardPieces,
  boardPieceIds,
  selection,
  shownMoves,
  shownMovesRestored,
  promotionChoice,
  rejection,
  mated,
  interactionDisabled = false,
  onSelectSquare,
  onChoosePromotion,
  hint = null,
  candidateMarks = [],
  operatedSquare = null,
}: HowToPlayBoardProps) {
  const { getTapHandlers } = useTouchTap();
  const squaresRef = useRef<HTMLDivElement>(null);
  const files = Array.from(
    { length: crop.files },
    (_, index) => crop.files - index,
  );
  const ranks = Array.from({ length: crop.ranks }, (_, index) => index + 1);
  const lastMove = shownMoves.at(-1) ?? null;
  const interactive = onSelectSquare !== undefined;
  const rejectedPieceFlashing = useRejectedPieceFeedback(
    rejection,
    squaresRef,
    TSUME_SHOGI_SELECTED_PIECE_GLYPH_SELECTOR,
  );
  const highlightSource = {
    boardPieces,
    selection,
    lastMove,
    mated,
    rejectedPieceFlashing,
  };
  const promotingPiece = promotionChoice
    ? findTsumeShogiBoardPiece(boardPieces, promotionChoice.from)
    : null;
  const frameKind = coordinates ? "labeled" : "plain";
  const frameWidth = frameWidths[frameKind];
  const fadeWidth = `calc(var(--tsume-shogi-figure-square) * ${fadeRatios[frameKind]})`;
  const fadeHeight = `calc(${squareHeight} * ${fadeRatios[frameKind]})`;
  const gridStyle = {
    "--board-thickness": "0px",
    // 押す所の手がかりの枠と指の大きさを、升の幅に比べて決めさせる。
    "--how-to-play-unit": "var(--tsume-shogi-figure-square)",
    gridTemplateColumns: `${fadeWidth} calc(var(--tsume-shogi-figure-square) * ${crop.files}) ${frameWidth}`,
    gridTemplateRows: `${frameWidth} calc(${squareHeight} * ${crop.ranks}) ${fadeHeight} 0px`,
  } as CSSProperties;

  function placeOnSquare(square: TsumeShogiSquare): CSSProperties {
    return {
      left: `${((crop.files - square.file) * 100) / crop.files}%`,
      top: `${((square.rank - 1) * 100) / crop.ranks}%`,
      width: `${100 / crop.files}%`,
      height: `${100 / crop.ranks}%`,
    };
  }

  const hintedSquare = hint?.type === "square" ? hint.square : null;
  const hintedPromotion = hint?.type === "promotion" ? hint.promote : null;

  return (
    // 成るかの選択肢や持ち上げた駒の重なり順を盤面の中に閉じ、遊び方の層が上に留めるタブの列の上に描かないようにする。
    <div className="relative isolate grid w-fit" style={gridStyle}>
      {/* 盤の木と、消えていく升の罫線を、切り出した端へ淡く消す。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none col-start-1 col-end-4 row-start-1 row-end-5 grid grid-cols-subgrid grid-rows-subgrid"
        style={createFadeMaskStyle(fadeWidth, fadeHeight)}
      >
        <TsumeShogiBoardWood />
        <div
          className="col-start-1 row-start-2 grid"
          style={{ gridTemplateRows: `repeat(${crop.ranks}, minmax(0, 1fr))` }}
        >
          {ranks.map((rank) => (
            <span
              key={rank}
              className={cn(
                "border-r border-b",
                rank === 1 && "border-t",
                tsumeShogiToneClassNames.boardLine,
              )}
            />
          ))}
        </div>
        <div
          className="col-start-2 row-start-3 grid"
          style={{
            gridTemplateColumns: `repeat(${crop.files}, minmax(0, 1fr))`,
          }}
        >
          {files.map((file) => (
            <span
              key={file}
              className={cn("border-r", tsumeShogiToneClassNames.boardLine)}
            />
          ))}
        </div>
        <span
          className={cn(
            "col-start-1 row-start-3 border-r",
            tsumeShogiToneClassNames.boardLine,
          )}
        />
      </div>
      {coordinates ? (
        <>
          <div
            aria-hidden="true"
            className={cn(
              "relative col-start-2 row-start-1 grid items-center text-[0.75rem] leading-none",
              tsumeShogiToneClassNames.coordinate,
            )}
            style={{
              gridTemplateColumns: `repeat(${crop.files}, minmax(0, 1fr))`,
            }}
          >
            {files.map((file) => (
              <TsumeShogiCoordinateLabel key={file} text={String(file)} />
            ))}
          </div>
          <div
            aria-hidden="true"
            className={cn(
              "relative col-start-3 row-start-2 grid text-[0.75rem] leading-none",
              tsumeShogiToneClassNames.coordinate,
            )}
            style={{
              gridTemplateRows: `repeat(${crop.ranks}, minmax(0, 1fr))`,
            }}
          >
            {ranks.map((rank) => (
              <span key={rank} className="flex items-center justify-center">
                <TsumeShogiCoordinateLabel text={formatTsumeShogiRank(rank)} />
              </span>
            ))}
          </div>
        </>
      ) : null}
      <div
        ref={squaresRef}
        data-board-squares=""
        role="group"
        aria-label="盤"
        className="relative col-start-2 row-start-2 grid"
        style={{
          gridTemplateColumns: `repeat(${crop.files}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${crop.ranks}, minmax(0, 1fr))`,
        }}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = { file, rank };
            const arrivedMove =
              lastMove &&
              !shownMovesRestored &&
              isSameTsumeShogiSquare(lastMove.move.to, square)
                ? lastMove
                : null;
            return (
              <TsumeShogiSquareButton
                key={`${file}-${rank}`}
                square={square}
                piece={findTsumeShogiBoardPiece(boardPieces, square)}
                pieceId={
                  boardPieceIds.get(formatTsumeShogiSquareKey(square)) ?? null
                }
                clearGlow={mated}
                arrivedMove={arrivedMove}
                highlight={getTsumeShogiSquareHighlight(
                  highlightSource,
                  square,
                )}
                tutorialMarkRecallId={undefined}
                spotlit={false}
                disabled={!interactive || interactionDisabled}
                tapHandlers={getTapHandlers(() =>
                  (onSelectSquare ?? ignoreSquare)(square),
                )}
                onLeftEdge={false}
                onTopEdge={rank === 1}
              />
            );
          }),
        )}
        {crop.files >= 4 && crop.ranks >= 4 ? (
          // 星。3筋と4筋の境と、三段と四段の境が交わる点。
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute size-[clamp(3px,calc(var(--tsume-shogi-figure-square)*0.08),4px)] -translate-1/2 rounded-full",
              tsumeShogiToneClassNames.boardStar,
            )}
            style={{
              left: `${((crop.files - 3) * 100) / crop.files}%`,
              top: `${(3 * 100) / crop.ranks}%`,
            }}
          />
        ) : null}
        {candidateMarks.map(({ square, allowed }) => (
          <span
            key={formatTsumeShogiSquareKey(square)}
            className="pointer-events-none absolute z-10 flex items-center justify-center"
            style={placeOnSquare(square)}
          >
            {/* 札は升の幅の半分ほどにし、下の駒と罫線を札の分だけ隠す。 */}
            <span className="flex size-[52%]">
              <HowToPlayVerdictMark
                verdict={allowed ? "allowed" : "disallowed"}
                placement="board-tag"
              />
            </span>
          </span>
        ))}
        {operatedSquare ? (
          <span
            aria-hidden="true"
            data-operated-square=""
            className={cn(
              "pointer-events-none absolute border-2",
              tsumeShogiToneClassNames.howToPlayOperatedFrame,
            )}
            style={placeOnSquare(operatedSquare)}
          />
        ) : null}
        {hintedSquare ? (
          <span
            className="pointer-events-none absolute"
            style={placeOnSquare(hintedSquare)}
          >
            {/* 升の中央の駒を隠さないよう、指は升の角に半分外へ出して置く。 */}
            <HowToPlayPressHint
              ground="light"
              outline="square"
              pointer="outside-corner"
            />
          </span>
        ) : null}
        {promotionChoice && promotingPiece ? (
          // 成・不成の選択肢は本番の盤（9筋×9段）の中の位置で置くので、切り出した盤の右上にそろえた本番の盤の大きさの箱に置く。
          <div
            className="pointer-events-none absolute top-0 right-0 z-20 [&>[role=group]]:pointer-events-auto"
            style={{
              width: `${(9 * 100) / crop.files}%`,
              height: `${(9 * 100) / crop.ranks}%`,
            }}
          >
            <TsumeShogiPromotionPicker
              to={promotionChoice.to}
              pieceType={promotingPiece.type}
              optionTapHandlers={{
                promote: getTapHandlers(() =>
                  (onChoosePromotion ?? ignorePromotion)(true),
                ),
                keep: getTapHandlers(() =>
                  (onChoosePromotion ?? ignorePromotion)(false),
                ),
              }}
              optionMarks={
                hintedPromotion === null
                  ? {}
                  : {
                      // 選択肢の下の端の「成」「不成」の字に枠の線をかけないよう、枠は選択肢の外に引く。
                      // 指は字の無い上の角のうち、もう一方の選択肢から離れた外側の角に置く。
                      [hintedPromotion ? "promote" : "keep"]: (
                        <HowToPlayPressHint
                          ground="light"
                          frame="outside"
                          outline="square"
                          pointer="outside-corner"
                          corner={hintedPromotion ? "top-left" : "top-right"}
                        />
                      ),
                    }
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
