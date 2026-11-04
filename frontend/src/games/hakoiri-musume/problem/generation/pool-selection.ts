import {
  classifyHakoiriMusumeFeatures,
  type HakoiriMusumeDifficulty,
  type HakoiriMusumeDifficultyAssessment,
} from "@/games/hakoiri-musume/difficulty";
import {
  type HakoiriMusumeDifficultyFeatures,
  readHakoiriMusumeDifficultyFeatures,
} from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  createHakoiriMusumeStateGraph,
  enumerateHakoiriMusumePieceSetBoards,
  type HakoiriMusumeBoardText,
  type HakoiriMusumePieceSet,
  type HakoiriMusumeStateGraph,
  type HakoiriMusumeStateMeasures,
  measureHakoiriMusumeStateGraph,
  mirrorHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

/**
 * 候補空間の駒の組。空き（16 − 2 ×（縦長 + 横長）− 小駒）と長い駒の数・小駒の数の形ごとに、縦長と横長の分け方をすべて入れる。
 * 空き2〜6 の 11 の形で 66 組。空きが7以上の組は、レベル1 の空きの上限（6）を超えて出さないので入れない。
 */
const pieceSetShapes = [
  { empty: 2, long: 5, small: 4 },
  { empty: 2, long: 6, small: 2 },
  { empty: 2, long: 4, small: 6 },
  { empty: 3, long: 5, small: 3 },
  { empty: 3, long: 6, small: 1 },
  { empty: 4, long: 5, small: 2 },
  { empty: 4, long: 4, small: 4 },
  { empty: 4, long: 6, small: 0 },
  { empty: 5, long: 5, small: 1 },
  { empty: 6, long: 5, small: 0 },
  { empty: 6, long: 4, small: 2 },
] as const;

export const hakoiriMusumePieceSets: readonly HakoiriMusumePieceSet[] =
  pieceSetShapes.flatMap(({ long, small }) =>
    Array.from({ length: long + 1 }, (_, vertical) => ({
      vertical,
      horizontal: long - vertical,
      small,
    })),
  );

export function formatHakoiriMusumePieceSet({
  vertical,
  horizontal,
  small,
}: HakoiriMusumePieceSet): string {
  return `v${vertical}h${horizontal}s${small}`;
}

/** 近い問題とみなす手数。同じレベルで、この手数以内で行き来できる2問は片方だけを採る。 */
export const HAKOIRI_MUSUME_NEAR_MOVE_COUNT = 4;

/** 駒の組の全局面と、その特徴。 */
export type HakoiriMusumePieceSetSpace = {
  graph: HakoiriMusumeStateGraph;
  measures: HakoiriMusumeStateMeasures;
  emptyCellCount: number;
};

export function analyzeHakoiriMusumePieceSet(
  pieceSet: HakoiriMusumePieceSet,
): HakoiriMusumePieceSetSpace {
  const graph = createHakoiriMusumeStateGraph(
    enumerateHakoiriMusumePieceSetBoards(pieceSet),
  );
  return {
    graph,
    measures: measureHakoiriMusumeStateGraph(graph),
    emptyCellCount:
      16 - 2 * (pieceSet.vertical + pieceSet.horizontal) - pieceSet.small,
  };
}

/** 1つの候補（左右反転の組の代表）と、その特徴と分類。 */
export type HakoiriMusumeCandidate = {
  index: number;
  board: HakoiriMusumeBoardText;
  features: HakoiriMusumeDifficultyFeatures;
  assessment: HakoiriMusumeDifficultyAssessment;
};

/**
 * 駒の組の候補を全部分類する。候補は娘を出口の前へ運べてまだ着いていない局面で、左右反転の組は文字列の小さい方を代表にする。
 */
export function listHakoiriMusumeCandidates({
  graph,
  measures,
  emptyCellCount,
}: HakoiriMusumePieceSetSpace): HakoiriMusumeCandidate[] {
  const candidates: HakoiriMusumeCandidate[] = [];
  graph.boards.forEach((board, index) => {
    if (
      measures.optimal[index]! <= 0 ||
      mirrorHakoiriMusumeBoard(board) < board
    ) {
      return;
    }
    const features = readHakoiriMusumeDifficultyFeatures(
      measures,
      index,
      emptyCellCount,
    );
    candidates.push({
      index,
      board,
      features,
      assessment: classifyHakoiriMusumeFeatures(features),
    });
  });
  return candidates;
}

/**
 * 近い問題を除く印。採った問題について、`HAKOIRI_MUSUME_NEAR_MOVE_COUNT` 手以内で行ける局面と、採った問題の最短解の上にある局面
 * （最短の子孫）と、採った問題を最短解の上に持つ局面（最短の祖先）に印を付ける。印の付いた局面は採らない。
 * 左右反転は候補を代表1つにまとめる段で除くので、ここでは盤面どうしの近さだけを見る。
 */
export function createHakoiriMusumeNearProblemFilter({
  graph,
  measures,
}: Pick<HakoiriMusumePieceSetSpace, "graph" | "measures">) {
  const { boards, indexByBoard, edgeStarts, edges } = graph;
  const near = new Uint8Array(boards.length);
  const descendants = new Uint8Array(boards.length);
  const ancestors = new Uint8Array(boards.length);

  function markShortestPaths(start: number, step: -1 | 1, marks: Uint8Array) {
    const stack = [start];
    marks[start] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        // 印の付いた局面の先は、その局面を印付けたときに全部印が付いている。
        if (
          !marks[next] &&
          measures.optimal[next] === measures.optimal[current]! + step
        ) {
          marks[next] = 1;
          stack.push(next);
        }
      }
    }
  }

  function isMarked(index: number): boolean {
    return (
      near[index] === 1 || descendants[index] === 1 || ancestors[index] === 1
    );
  }

  return {
    /** 印の付いた局面なら近い問題。 */
    isNear(board: HakoiriMusumeBoardText): boolean {
      return isMarked(indexByBoard.get(board)!);
    },
    /** 採った問題のまわりに印を付ける。 */
    take(board: HakoiriMusumeBoardText) {
      const start = indexByBoard.get(board)!;
      let frontier = [start];
      near[start] = 1;
      for (let step = 0; step < HAKOIRI_MUSUME_NEAR_MOVE_COUNT; step += 1) {
        const next: number[] = [];
        for (const current of frontier) {
          for (
            let edge = edgeStarts[current]!;
            edge < edgeStarts[current + 1]!;
            edge += 1
          ) {
            const neighbor = edges[edge]!;
            if (!near[neighbor]) {
              near[neighbor] = 1;
              next.push(neighbor);
            }
          }
        }
        frontier = next;
      }
      markShortestPaths(start, -1, descendants);
      markShortestPaths(start, 1, ancestors);
    },
  };
}

/**
 * 駒の組から、レベルごとに近い問題を除いて採る。候補を seed と駒の組から作る乱数で並べ替えた順に見て、近い問題でなければ採る。
 * レベルごとに `limit` 問で止める。
 */
export function pickHakoiriMusumePieceSetProblems(
  pieceSet: HakoiriMusumePieceSet,
  space: HakoiriMusumePieceSetSpace,
  candidates: readonly HakoiriMusumeCandidate[],
  seed: string,
  limit: number,
): Record<HakoiriMusumeDifficulty, HakoiriMusumeCandidate[]> {
  const picked: Record<HakoiriMusumeDifficulty, HakoiriMusumeCandidate[]> = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
  };
  for (const difficulty of Object.keys(picked) as HakoiriMusumeDifficulty[]) {
    const levelCandidates = candidates.filter(
      ({ assessment }) =>
        assessment.status === "classified" &&
        assessment.difficulty === difficulty,
    );
    const random = createProblemSeededRandom(
      `${seed}:${formatHakoiriMusumePieceSet(pieceSet)}:${difficulty}`,
    );
    const filter = createHakoiriMusumeNearProblemFilter(space);
    for (const candidate of shuffleProblemValues(levelCandidates, random)) {
      if (picked[difficulty].length >= limit) {
        break;
      }
      if (filter.isNear(candidate.board)) {
        continue;
      }
      filter.take(candidate.board);
      picked[difficulty].push(candidate);
    }
  }
  return picked;
}

/**
 * 駒の組ごとに採った問題を、駒の組を seed で並べ替えた順に1問ずつ巡回して並べ、`count` 問で止める。
 * 採り尽くした駒の組は飛ばす。図鑑の番号から手数の長短が透けないよう、最短手数の順にはしない。
 */
export function interleaveHakoiriMusumeProblems<Problem>(
  pickedBySet: readonly (readonly Problem[])[],
  count: number,
): Problem[] {
  const result: Problem[] = [];
  for (let round = 0; result.length < count; round += 1) {
    const roundProblems = pickedBySet.flatMap((problems) =>
      round < problems.length ? [problems[round]!] : [],
    );
    if (roundProblems.length === 0) {
      break;
    }
    result.push(...roundProblems.slice(0, count - result.length));
  }
  return result;
}
