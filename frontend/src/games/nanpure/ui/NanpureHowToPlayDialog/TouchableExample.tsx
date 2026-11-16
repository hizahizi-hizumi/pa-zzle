import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  getNanpureExampleMarks,
  judgeNanpureExampleUnit,
  listNanpureExampleConflictKinds,
  listNanpureExampleOtherConflictKinds,
} from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import type { NanpureHowToPlayExample } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/nanpure/ui/NanpureHowToPlayDialog/HowToPlayBoard";
import { GivenVerdictCaption } from "@/games/nanpure/ui/NanpureHowToPlayDialog/TouchableExample/GivenVerdictCaption";
import { InputControls } from "@/games/nanpure/ui/NanpureHowToPlayDialog/TouchableExample/InputControls";
import { UnitVerdictCaption } from "@/games/nanpure/ui/NanpureHowToPlayDialog/TouchableExample/UnitVerdictCaption";
import { useTouchableExample } from "@/games/nanpure/ui/NanpureHowToPlayDialog/use-touchable-example";
import { cn } from "@/lib/utils";

/**
 * 例の下に添える言葉。
 * - `unit`: 形のルールの判定（✓ できる / ✕ できない / 途中）。盤面の範囲の行・列・ブロックで判定する。
 * - `given`: 最初からある数字のルールの判定（✓ 変えられる / ✕ 変えられない）と、2つの数字の色の凡例。
 */
type TouchableExampleCaption = "unit" | "given";

type TouchableExampleProps = {
  example: NanpureHowToPlayExample;
  caption?: TouchableExampleCaption;
};

/**
 * 例のマスの大きさ。狭い画面では 40px（9マスが面に収まらない幅では収まる大きさ）、広い画面では 52px にし、
 * ゴールの盤面のマスと見比べて同じ物に見える大きさにする。入力の段の数字のボタンも、9マスの盤面と同じ幅に並べる。
 * 押す所の手がかりの大きさは、マスを単位にして決める。
 */
const figureCellSizeClassName =
  "[--nanpure-figure-cell:min(40px,calc((100cqw-4px)/9))] lg:[--nanpure-figure-cell:52px] [--how-to-play-unit:var(--nanpure-figure-cell)]";

/**
 * 触れる例の面の中身。盤面を `HowToPlayExample` で並べ、その後に本番と同じ入力の段（数字・消す・メモ）から例に要るボタンを置く。
 * 盤面の並べ方は例を並べる面に任せ、入力の段は面の幅いっぱいの行にして、どの並べ方でも盤面の下に来るようにする。
 * 入力の段も面の子として並べ、面が元に戻すボタンの置き場所を決めるときに、段の大きさも測れるようにする。
 * 本番と同じく、マスを押して選び、ボタンを押して入れる。重なりと答えと違う数字の色は、本番と同じく今の盤面から出す。
 * 次に押す所には、盤面のマスかボタンに手がかりを付ける。
 */
export function TouchableExample({ example, caption }: TouchableExampleProps) {
  const {
    state,
    availability,
    hint,
    selectCell,
    inputDigit,
    erase,
    toggleNotesMode,
  } = useTouchableExample(example.boards, example.hints);

  return (
    <>
      {example.boards.map((definition, boardIndex) => {
        const session = state.sessions[boardIndex];
        if (session === undefined) {
          return null;
        }
        const selectedCellIndex =
          state.selection?.board === boardIndex
            ? state.selection.cellIndex
            : null;
        const marks = getNanpureExampleMarks(session);
        return (
          <HowToPlayExample
            // biome-ignore lint/suspicious/noArrayIndexKey: 面の中の盤面は、並び順そのものが識別になる
            key={boardIndex}
            figure={
              <span className={cn("flex", figureCellSizeClassName)}>
                <HowToPlayBoard
                  region={definition.region}
                  board={session.puzzleState}
                  clues={session.problem.clues}
                  notes={session.notes}
                  selectedCellIndex={selectedCellIndex}
                  conflictCellIndices={marks.conflictCellIndices}
                  mistakeCellIndices={marks.mistakeCellIndices}
                  hintedCellIndex={
                    hint?.kind === "cell" && hint.board === boardIndex
                      ? hint.cellIndex
                      : null
                  }
                  onSelectCell={(cellIndex) =>
                    selectCell(boardIndex, cellIndex)
                  }
                />
              </span>
            }
            caption={
              caption === "unit" ? (
                <UnitVerdictCaption
                  verdict={judgeNanpureExampleUnit(session, definition.region)}
                  otherConflictKinds={listNanpureExampleOtherConflictKinds(
                    session,
                    definition.region,
                  )}
                />
              ) : caption === "given" ? (
                <GivenVerdictCaption
                  changeable={
                    selectedCellIndex === null
                      ? hint?.kind === "cell" &&
                        session.problem.clues[hint.cellIndex] === null
                      : session.problem.clues[selectedCellIndex] === null
                  }
                  conflictKinds={listNanpureExampleConflictKinds(
                    session,
                    definition.region,
                  )}
                />
              ) : undefined
            }
          />
        );
      })}
      <div
        className={cn(
          "flex w-full basis-full justify-center",
          figureCellSizeClassName,
          // 言葉の無い例では、盤面と入力の段の間を、本番の盤面と入力の段の間に近づける。
          caption === undefined && "-mt-6",
        )}
      >
        <InputControls
          controls={example.controls}
          availability={availability}
          notesMode={state.notesMode}
          hint={hint}
          onInputDigit={inputDigit}
          onErase={erase}
          onToggleNotesMode={toggleNotesMode}
        />
      </div>
    </>
  );
}
