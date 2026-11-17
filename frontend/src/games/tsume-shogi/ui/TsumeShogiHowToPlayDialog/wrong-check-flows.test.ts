import {
  getTsumeShogiPieceAt,
  listTsumeShogiBoardPieces,
} from "@/games/tsume-shogi/puzzle/position";
import { wrongCheckFlowFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { listTsumeShogiWrongCheckFlows } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/wrong-check-flows";

describe("listTsumeShogiWrongCheckFlows", () => {
  const flows = listTsumeShogiWrongCheckFlows();

  test("どの流れも、まだ何も指していない同じ始まりの盤面から始め、次のコマで同じ誤王手を指すこと", () => {
    const starts = flows.map(({ frames }) => frames[0]);
    const seconds = flows.map(({ frames }) => frames[1]);

    expect(new Set(starts).size).toBe(1);
    expect(starts[0]?.turns).toHaveLength(0);
    expect(new Set(seconds).size).toBe(1);
    expect(seconds[0]?.wrongCheckCount).toBe(1);
  });

  test("本番の session の数え方で、続けた王手は数えず、同じ誤王手の指し直しは1回、別の誤王手は2回と数えること", () => {
    const counts = flows.map(({ wrongCheckCount }) => wrongCheckCount);

    expect(counts).toEqual([1, 1, 2]);
  });

  test("矢印の数をコマの数より1つ少なくし、王手の矢印には玉方の応手も言うこと", () => {
    const shapes = flows.map(({ frames, steps }) => [
      frames.length,
      steps.length,
    ]);
    const firstSteps = flows.map(({ steps }) => steps[0]);

    expect(shapes).toEqual([
      [3, 2],
      [3, 2],
      [3, 2],
    ]);
    expect(new Set(firstSteps)).toEqual(new Set(["王手/逃れる"]));
  });

  test("始まりの後のどのコマでも、王手した駒が盤に残り、玉方が応じ終え、駒がすべて切り出した範囲に入ること", () => {
    const frames = flows.flatMap(({ frames }) => frames.slice(1));

    for (const frame of frames) {
      const lastTurn = frame.turns.at(-1);
      expect(lastTurn).toBeDefined();
      expect(frame.defenderReplyPending).toBe(false);
      const attacked = lastTurn
        ? getTsumeShogiPieceAt(frame.puzzleState, lastTurn.attackerMove.to)
        : null;
      expect(attacked?.side).toBe("attacker");
      for (const { square } of listTsumeShogiBoardPieces(frame.puzzleState)) {
        expect(square.file).toBeLessThanOrEqual(
          wrongCheckFlowFigure.crop.files,
        );
        expect(square.rank).toBeLessThanOrEqual(
          wrongCheckFlowFigure.crop.ranks,
        );
      }
    }
  });
});
