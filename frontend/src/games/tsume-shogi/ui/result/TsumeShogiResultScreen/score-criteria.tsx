import type { TsumeShogiResult } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  countTsumeShogiAttackerMoves,
  TSUME_SHOGI_SCORE_MAXIMUMS,
  TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT,
  TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS,
  TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS,
  TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS,
  TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS,
  TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS,
  TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT,
  TSUME_SHOGI_WRONG_CHECK_PENALTY,
} from "@/games/tsume-shogi/score";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1_000}秒`;
}

/** 基準時間の式。その問題で0の項は省き、誤王手と紛れの数は上限で打ち切った値を示す。 */
function formatSpeedFullScoreFormula({
  plies,
  rootChecks,
  plausibleWrong,
  deepDecoyCount,
}: TsumeShogiResult["workload"]): string {
  const terms = [
    formatSeconds(TSUME_SHOGI_SPEED_INITIAL_RECOGNITION_MS),
    `攻方の手${countTsumeShogiAttackerMoves(plies)}手 × ${formatSeconds(TSUME_SHOGI_SPEED_PER_ATTACKER_MOVE_MS)}`,
    `初手の王手${rootChecks}個 × ${formatSeconds(TSUME_SHOGI_SPEED_PER_ROOT_CHECK_MS)}`,
  ];
  if (plausibleWrong > 0) {
    terms.push(
      `効いていそうな誤王手${Math.min(plausibleWrong, TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT)}個 × ${formatSeconds(TSUME_SHOGI_SPEED_PER_PLAUSIBLE_WRONG_MS)}`,
    );
  }
  if (deepDecoyCount > 0) {
    terms.push(
      `数手先まで続く紛れ${Math.min(deepDecoyCount, TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT)}個 × ${formatSeconds(TSUME_SHOGI_SPEED_PER_DEEP_DECOY_MS)}`,
    );
  }
  return terms.join(" + ");
}

export function getTsumeShogiScoreCriteria(result: TsumeShogiResult) {
  const { workload, speedFullScoreMs, speedZeroScoreMs } = result;

  return {
    items: [
      {
        label: "読みの確かさ",
        description: `誤王手を指さずに${TSUME_SHOGI_SCORE_MAXIMUMS.accuracy}点。誤王手1回につき${TSUME_SHOGI_WRONG_CHECK_PENALTY}点減点し、0点を下限とします。誤王手は、詰む筋から指した、残りの手数では詰まない王手です。反証の筋で続けた王手は数えません。`,
      },
      {
        label: "速さ",
        description: `基準時間${formatElapsedTime(speedFullScoreMs)}以内で${TSUME_SHOGI_SCORE_MAXIMUMS.speed}点、${formatElapsedTime(speedZeroScoreMs)}以上で0点、その間は時間に応じて減点。基準時間は${formatSpeedFullScoreFormula(workload)}です。効いていそうな誤王手と数手先まで続く紛れは、この問題を指す前に読んで捨てる候補の数です（それぞれ${TSUME_SHOGI_SPEED_PLAUSIBLE_WRONG_LIMIT}個・${TSUME_SHOGI_SPEED_DEEP_DECOY_LIMIT}個まで数えます）。`,
      },
      {
        label: "点に入らないもの",
        description:
          "反証を見た回数・待った・盤面戻し・指せない手を押した回数は点に入りません。",
      },
    ],
    note: {
      label: "丸め",
      description: "速さは1点単位に四捨五入します。",
    },
  };
}
