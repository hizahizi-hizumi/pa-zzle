import type { ReactNode } from "react";

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

/** 記録から描く結果画面へ、ゲームの外側が渡す告知と操作。次の問題・検証情報はゲームが記録から用意する。 */
export type RecordResultContext = {
  /** 記録を保存した直後の自己ベスト更新などの告知。 */
  recordOutcomeNotice: ReactNode;
  /** 記録の問題を遊び直す。遊び直せない記録では `undefined`。 */
  onReplay: (() => void) | undefined;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

/** アプリが提供する1つのゲームの、入口・プレイ画面・記録・記録の問題の遊び直し先・記録の結果画面。 */
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
  /**
   * 記録から結果画面を描く。今の版の記録でなく結果を作れないときは `null` を返す。
   * 呼び出し側は記録の `gameId` がこのゲームの `id` と一致することを確かめてから渡す。
   */
  renderRecordResult: (
    record: PlayRecord,
    context: RecordResultContext,
  ) => ReactNode | null;
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
