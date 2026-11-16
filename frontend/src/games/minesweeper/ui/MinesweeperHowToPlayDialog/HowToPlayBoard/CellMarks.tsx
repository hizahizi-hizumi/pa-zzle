import {
  HowToPlayPressHint,
  type HowToPlayPressHintGesture,
} from "@/components/HowToPlayPressHint";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import type { MinesweeperExampleCandidate } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";

type CellMarksProps = {
  candidate?: MinesweeperExampleCandidate;
  hint?: HowToPlayPressHintGesture;
  /** 押せない図で、そのコマの前の操作で押したマス。無彩の枠で囲み、押せる例の手がかり（破線と指）と見分ける。 */
  pressed?: boolean;
  /** マスに数字や印があり、指のアイコンで隠さないよう隅に寄せるか。 */
  occupied?: boolean;
};

/** 札の記号。地雷ではないマスは ✓、地雷のマスは ✕ にする。 */
const candidateVerdicts = {
  safe: "allowed",
  mine: "disallowed",
} as const satisfies Record<
  MinesweeperExampleCandidate,
  "allowed" | "disallowed"
>;

/**
 * 遊び方の盤面のマスに重ねる、遊び方だけの見せ方。押すのを邪魔しないよう、どれもポインターを受けない。
 * 札（✓ / ✕）はマスの中央に置き、閉じたマスの面の上でも記号だけを読ませる。
 * 手がかりは、閉じた空のマスでは指を中央に置き、札や数字があるマスでは中身を隠さないよう角の内側に置く。
 */
export function CellMarks({
  candidate,
  hint,
  pressed = false,
  occupied = false,
}: CellMarksProps) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {pressed ? (
        <span
          data-pressed
          className="absolute inset-[3px] rounded-[3px] border-2 border-muted-foreground"
        />
      ) : null}
      {candidate === undefined ? null : (
        <span className="absolute inset-[28%]">
          <HowToPlayVerdictMark
            verdict={candidateVerdicts[candidate]}
            placement="board-tag"
          />
        </span>
      )}
      {hint === undefined ? null : (
        <HowToPlayPressHint
          frame="inside"
          outline="square"
          pointer={
            occupied || candidate !== undefined ? "inside-corner" : "center"
          }
          gesture={hint}
        />
      )}
    </span>
  );
}
