import {
  PLAY_OPERATION_LABELS,
  PLAY_OPERATION_PHRASES,
} from "@/games/play-vocabulary";
import {
  playTsumeShogiSessionDefenderReply,
  type TsumeShogiSession,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";
import {
  createTsumeShogiExampleSession,
  playTsumeShogiExampleMove,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import { wrongCheckFlowFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";

/** 誤王手の数え方の流れ1つ。コマはどれも玉方が応じた後の姿で、最後のコマまでに数えた誤王手の回数を本番の session から求める。 */
export type TsumeShogiWrongCheckFlow = {
  frames: readonly TsumeShogiSession[];
  /** コマの間の矢印に添える操作の名前。`/` で行を分ける。 */
  steps: readonly string[];
  caption: string;
  wrongCheckCount: number;
};

/**
 * 王手の矢印の名前。矢印1つで、攻方の王手と、玉方が間を置いて指す応手の2手を進めるので、両方を言う。
 * 応手は本番の盤の下の行の「で逃れる」にそろえる。
 */
const checkStep = "王手/逃れる";

function check(
  session: TsumeShogiSession,
  move: Parameters<typeof playTsumeShogiExampleMove>[1],
) {
  return playTsumeShogiSessionDefenderReply(
    playTsumeShogiExampleMove(session, move),
  );
}

/**
 * 誤王手の数え方の流れ。どれも同じ始まりの盤面から誤王手を指し、その後の操作だけを変える。
 * - 玉方が逃れた筋で王手を続けても、続けた王手は数えない。
 * - 待ったで戻して同じ誤王手を指し直しても、1回だけ数える。
 * - 待ったで戻して別の誤王手を指すと、それも数える。
 */
export function listTsumeShogiWrongCheckFlows(): TsumeShogiWrongCheckFlow[] {
  const { problem, wrongCheck, continuedCheck, otherWrongCheck } =
    wrongCheckFlowFigure;
  const start = createTsumeShogiExampleSession({ problem, preludeTurns: 0 });
  const wrong = check(start, wrongCheck);
  const continued = check(wrong, continuedCheck);
  const retried = check(undoTsumeShogiSession(wrong), wrongCheck);
  const switched = check(undoTsumeShogiSession(wrong), otherWrongCheck);
  return [
    {
      frames: [start, wrong, continued],
      steps: [checkStep, checkStep],
      caption: "逃れた後も/王手を/かけ続ける",
      wrongCheckCount: continued.wrongCheckCount,
    },
    {
      frames: [start, wrong, retried],
      steps: [checkStep, `${PLAY_OPERATION_PHRASES.undo}/${checkStep}`],
      caption: `「${PLAY_OPERATION_LABELS.undo}」で/戻して/同じ王手を/かける`,
      wrongCheckCount: retried.wrongCheckCount,
    },
    {
      frames: [start, wrong, switched],
      steps: [checkStep, `${PLAY_OPERATION_PHRASES.undo}/${checkStep}`],
      caption: `「${PLAY_OPERATION_LABELS.undo}」で/戻して/別の王手を/かける`,
      wrongCheckCount: switched.wrongCheckCount,
    },
  ];
}
