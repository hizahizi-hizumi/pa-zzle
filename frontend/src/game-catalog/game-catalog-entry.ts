import {
  createProblemId,
  type ProblemId,
  type ProblemIdentity,
} from "@/games/problem-id";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";
import type { Path } from "@/router";

/** 難易度を `:difficulty` に入れて開くプレイ画面のパス。 */
export type GamePlayPath = Extract<Path, `/puzzles/${string}/play/:difficulty`>;

/** 記録の問題を遊び直すプレイ画面の難易度と、その難易度の問題集で引ける問題 ID。 */
export type RecordProblemPlayTarget = {
  difficulty: string;
  problemId: ProblemId;
};

/** アプリが提供する1つのゲームの、入口・プレイ画面・記録・記録の問題の遊び直し先。 */
export type GameCatalogEntry = {
  /** 記録の `gameId` と同じ値。 */
  id: string;
  name: string;
  pictogramSvg: string;
  entryPath: Path;
  playPath: GamePlayPath;
  playRecordDisplay: PlayRecordDisplayDefinition;
  /**
   * 記録の問題を遊び直すプレイ画面の難易度と問題 ID を返す。遊び直せない記録には `null` を返す。
   * 記録一覧の全行で求めるので、問題を復元せず問題集の索引で引けるかだけを確かめる。
   */
  recordProblemPlayTarget: (
    record: PlayRecord,
  ) => RecordProblemPlayTarget | null;
};

/**
 * 記録の難易度と identity から遊び直し先を求める。
 * 難易度が今の難易度区分に無い（`undefined`）か、その難易度の問題集で問題 ID を引けなければ `null` を返す。
 */
export function resolveRecordProblemPlayTarget<Difficulty extends string>(
  difficulty: Difficulty | undefined,
  problemIdentity: ProblemIdentity,
  canSelectProblemById: (
    difficulty: Difficulty,
    problemId: ProblemId,
  ) => boolean,
): RecordProblemPlayTarget | null {
  if (difficulty === undefined) {
    return null;
  }

  const problemId = createProblemId(problemIdentity);
  return canSelectProblemById(difficulty, problemId)
    ? { difficulty, problemId }
    : null;
}
