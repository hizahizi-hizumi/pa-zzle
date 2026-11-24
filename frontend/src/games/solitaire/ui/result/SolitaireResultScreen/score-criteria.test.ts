import { createSolitaireResult } from "@/games/solitaire/play/use-solitaire-play";
import { getSolitaireScoreCriteria } from "@/games/solitaire/ui/result/SolitaireResultScreen/score-criteria";

const result = createSolitaireResult({
  elapsedMs: 414_000,
  moveCount: 150,
  undoCount: 5,
  restartCount: 1,
  retractedMoveCount: 3,
});

describe("getSolitaireScoreCriteria", () => {
  test("安定性は取り消した手1手ごとの減点で、速さは基準時間からの直線で説明すること", () => {
    const criteria = getSolitaireScoreCriteria(result);

    expect(criteria).toEqual([
      {
        label: "安定性",
        description:
          "60点から、取り消した手1手につき2点を減らす。取り消した手は、「待った」で戻した手と、「盤面を戻す」でなくなった手。山札をめくる手と捨て札を山札へ戻す手は数えない。",
      },
      {
        label: "速さ",
        description:
          "基準時間06:00以内で40点、12:00以上で0点、その間は時間に応じて減らす。",
      },
    ]);
  });
});
