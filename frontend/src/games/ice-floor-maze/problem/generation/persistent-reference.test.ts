// @vitest-environment node

import {
  createElementContext,
  measureElementMetrics,
  scoreSelfMadeDependence,
} from "@/games/ice-floor-maze/problem/generation/element-features";
import { markOutsideCells } from "@/games/ice-floor-maze/problem/generation/outside-cells";
import reference from "@/games/ice-floor-maze/problem/generation/persistent-reference.json";
import { _private as stateSpace } from "@/games/ice-floor-maze/problem/generation/state-space";

const { formatGenerationBoardRows, parseGenerationBoardRows } = stateSpace;

// 期待値は scripts/research/ice_floor_persistent_port_reference.py が研究用の生成 v5・v6
// （ice_floor_persistent_generation_experiment.py: 押し出す雪・押し進む滑る岩）から書き出した値。
// 研究用 v5 の見た目どおりの読み（静的な盤面の解）は v4 の直す前の判定なので比べない。自作依存の点は、研究用と同じく
// 手の番号の小さい手を優先した最短解の点を比べる（製品は最短解が複数あれば最も低い解の点を使う）。

type Entry = (typeof reference.candidates)[number];

/** 研究用の置き換えは横長の盤面を残すが、こちらは縦横を入れ替えて縦長にする。 */
function toPortrait(outside: Entry["outside"]): Entry["outside"] {
  const { width, rows, start, goal } = outside;
  const height = rows.length;
  if (width <= height) {
    return outside;
  }
  function transposeCell(cell: number): number {
    return (cell % width) * height + Math.floor(cell / width);
  }
  return {
    width: height,
    rows: Array.from({ length: width }, (_, x) =>
      rows.map((row) => row[x]).join(""),
    ),
    start: transposeCell(start),
    goal: transposeCell(goal),
  };
}

function measureEntry(entry: Entry) {
  const board = parseGenerationBoardRows(entry.rows);
  const metrics = measureElementMetrics(
    createElementContext(board, entry.start),
    entry.goal,
  )!;
  const { texture } = metrics;
  const outside = markOutsideCells({
    board,
    start: entry.start,
    goal: entry.goal,
  });
  return {
    metrics: Object.fromEntries(
      Object.keys(entry.metrics).map((key) => [
        key,
        metrics[key as keyof typeof metrics],
      ]),
    ),
    dependence: {
      selfMadeDependence: scoreSelfMadeDependence(texture),
      distantStopCount: texture.distantStopCount,
      variedUseCount: texture.variedUseCount,
      quickReturnCount: texture.quickReturnCount,
      goalStopsOnSelfMade: texture.goalStopsOnSelfMade,
      selfMadeUseCount: texture.selfMadeUseCount,
      shortSlideCount: texture.shortSlideCount,
    },
    outside: {
      width: outside.board.width,
      rows: formatGenerationBoardRows(outside.board),
      start: outside.start,
      goal: outside.goal,
    },
  };
}

describe("押し出す雪・滑る氷の塊の特徴量（研究用の生成 v5・v6）", () => {
  test.each(
    [...reference.candidates, ...reference.boards].map(
      (entry) => [entry.id, entry] as const,
    ),
  )(
    "%s の状態のグラフ・特徴量・自作依存の点・盤面の外が一致すること",
    (_, entry) => {
      expect(measureEntry(entry)).toEqual({
        metrics: entry.metrics,
        dependence: entry.dependence,
        outside: toPortrait(entry.outside),
      });
    },
  );
});
