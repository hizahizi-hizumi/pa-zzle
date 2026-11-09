import { type DifficultyLevel, parseDifficultyLevel } from "@/games/difficulty";
import type { ProblemId } from "@/games/problem-id";
import type { PlayRecord } from "@/records/play-record";
import {
  getPlayRecordMetricValue,
  PLAY_SCORE_METRIC_ID,
  type PlayRecordClearPerformance,
  type PlayRecordDefinition,
} from "@/records/play-record-definition";

/** 図鑑・コレクションが共用する、現在の問題集で再生できるクリア記録の条件。 */
export type ClearedProblemSource = {
  id: string;
  recordProblemPlayTarget: (
    record: PlayRecord,
  ) => { difficulty: string; problemId: ProblemId } | null;
  playRecordDefinition: PlayRecordDefinition;
};

export type ClearedProblem = {
  difficulty: DifficultyLevel;
  problemId: ProblemId;
  score: number;
  performance: PlayRecordClearPerformance;
};

/** クリアと評価点を、両画面で同じ規則により対象問題へ対応付ける。 */
export function toClearedProblem(
  record: PlayRecord,
  source: ClearedProblemSource,
): ClearedProblem | null {
  if (record.gameId !== source.id) return null;
  const target = source.recordProblemPlayTarget(record);
  const difficulty = parseDifficultyLevel(target?.difficulty);
  const score = getPlayRecordMetricValue(
    record,
    source.playRecordDefinition,
    PLAY_SCORE_METRIC_ID,
  );
  const performance = source.playRecordDefinition.getClearPerformance(record);
  if (
    target === null ||
    difficulty === undefined ||
    score === null ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100 ||
    performance === null
  ) {
    return null;
  }
  return { difficulty, problemId: target.problemId, score, performance };
}
