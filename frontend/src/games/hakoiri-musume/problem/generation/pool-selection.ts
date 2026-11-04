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
import { hashProblemSeed } from "@/games/problem-seed";

/**
 * 候補空間の駒の組。空き（16 − 2 ×（縦長 + 横長）− 小駒）と長い駒の数・小駒の数の形ごとに、縦長と横長の分け方をすべて入れる。
 * 空き2〜6 の 15 の形で 82 組。空きが7以上の組は、レベル1 の空きの上限（6）を超えて出さないので入れない。
 * 空き2・3 は、近い問題を除いて、形の全組の合計でレベル5 を採れるか、レベル3 かレベル4 を百問以上採れる形を入れる。
 * 長い駒7本（小駒0）は最短8手以上の局面が無い。小駒をさらに増やした形（空き2 で小駒12以上、空き3 で小駒9以上）は
 * レベル5 が無く、レベル3・4 も合計で数十問しか採れない。空き4〜6 で小駒を増やした形はレベル1・2 しか出ず、そのレベルは
 * 今の形で足りる（`箱入り娘難易度.md` §6）。
 */
const pieceSetShapes = [
  { empty: 2, long: 5, small: 4 },
  { empty: 2, long: 6, small: 2 },
  { empty: 2, long: 4, small: 6 },
  { empty: 2, long: 3, small: 8 },
  { empty: 2, long: 2, small: 10 },
  { empty: 3, long: 5, small: 3 },
  { empty: 3, long: 6, small: 1 },
  { empty: 3, long: 4, small: 5 },
  { empty: 3, long: 3, small: 7 },
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

/**
 * seed と盤面から決める、候補を見る順の鍵。調査コードと同じ順にするため、言語に依らない文字列の hash（`hashProblemSeed`）で決める。
 */
export function rankHakoiriMusumeCandidate(
  seed: string,
  board: HakoiriMusumeBoardText,
): number {
  return hashProblemSeed(`${seed}:${board}`);
}

/**
 * 左右反転の組から問題に採る向き。文字列の小さい方に決めると、娘や駒の寄り方が片方の向きにそろうので、seed と組から決める。
 */
export function chooseHakoiriMusumeOrientation(
  seed: string,
  board: HakoiriMusumeBoardText,
): HakoiriMusumeBoardText {
  const mirrored = mirrorHakoiriMusumeBoard(board);
  const [first, second] =
    board < mirrored ? [board, mirrored] : [mirrored, board];
  return hashProblemSeed(`${seed}:orientation:${first}`) % 2 === 0
    ? first
    : second;
}

/** 1つの候補（左右反転の組の代表）と、その特徴と分類。 */
export type HakoiriMusumeCandidate = {
  index: number;
  board: HakoiriMusumeBoardText;
  features: HakoiriMusumeDifficultyFeatures;
  assessment: HakoiriMusumeDifficultyAssessment;
};

/**
 * 駒の組の候補を全部分類する。候補は娘を出口の前へ運べてまだ着いていない局面で、左右反転の組は `seed` で選んだ向きを代表にする。
 */
export function listHakoiriMusumeCandidates(
  { graph, measures, emptyCellCount }: HakoiriMusumePieceSetSpace,
  seed: string,
): HakoiriMusumeCandidate[] {
  const candidates: HakoiriMusumeCandidate[] = [];
  graph.boards.forEach((board, index) => {
    if (
      measures.optimal[index]! <= 0 ||
      chooseHakoiriMusumeOrientation(seed, board) !== board
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
 * 合流を近い問題とみなす割合。同じレベルの2問の最短解が同じ局面で合流し、そこから先の手数（共通の後半）が短い方の最短手数の
 * この割合以上なら、片方だけを採る。
 */
export const HAKOIRI_MUSUME_MERGE_SHARE = 0.5;

const noOwner = 2 ** 31 - 1;

/**
 * 近い問題を除く印。採った問題について、`HAKOIRI_MUSUME_NEAR_MOVE_COUNT` 手以内で行ける局面と、採った問題を最短解の上に持つ
 * 局面（最短の祖先）に印を付け、採った問題の最短解の上にある局面（最短の子孫）には、そこを通る採った問題の最短手数の最小を残す。
 * 候補は、印の付いた局面か、最短解が採った問題の最短解と合流して共通の後半が `mergeShare` 以上になるなら近い問題とする。
 * 最短の子孫に入る候補は、共通の後半が候補の最短手数そのものなので、必ず近い問題になる。
 * 手数の探索は採った問題ごとに印に関わらずたどり、前に付けた印で止めない。左右反転は候補を代表1つにまとめる段で除くので、
 * ここでは盤面どうしの近さだけを見る。
 */
export function createHakoiriMusumeNearProblemFilter(
  { graph, measures }: Pick<HakoiriMusumePieceSetSpace, "graph" | "measures">,
  mergeShare = HAKOIRI_MUSUME_MERGE_SHARE,
) {
  const { boards, indexByBoard, edgeStarts, edges } = graph;
  const { optimal } = measures;
  const near = new Uint8Array(boards.length);
  const ancestors = new Uint8Array(boards.length);
  const descendantOwner = new Int32Array(boards.length).fill(noOwner);
  let shortestTaken = noOwner;

  function markAncestors(start: number) {
    const stack = [start];
    ancestors[start] = 1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        // 祖先の印が付いた局面の先は、その局面に印を付けたときに全部印が付いている。
        if (!ancestors[next] && optimal[next] === optimal[current]! + 1) {
          ancestors[next] = 1;
          stack.push(next);
        }
      }
    }
  }

  function markDescendants(start: number) {
    const owner = optimal[start]!;
    const stack = [start];
    descendantOwner[start] = Math.min(descendantOwner[start]!, owner);
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        // 残した最短手数が今の問題以下の局面の先は、その値を残したときに今の問題以下になっている。
        if (
          optimal[next] === optimal[current]! - 1 &&
          descendantOwner[next]! > owner
        ) {
          descendantOwner[next] = owner;
          stack.push(next);
        }
      }
    }
  }

  function markNearMoves(start: number) {
    const reached = new Set([start]);
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
          if (!reached.has(neighbor)) {
            reached.add(neighbor);
            near[neighbor] = 1;
            next.push(neighbor);
          }
        }
      }
      frontier = next;
    }
  }

  /** `start` の最短解が採った問題の最短解と合流し、共通の後半が `mergeShare` 以上になるか。 */
  function mergesWithTaken(start: number): boolean {
    if (shortestTaken === noOwner) {
      return false;
    }
    const own = optimal[start]!;
    // 共通の後半は、合流する局面の最短手数。採った問題の最短手数の最小より短い所では割合に届かない。
    const shortestTail = mergeShare * Math.min(own, shortestTaken);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const tail = optimal[current]!;
      if (
        descendantOwner[current] !== noOwner &&
        tail >= mergeShare * Math.min(own, descendantOwner[current]!)
      ) {
        return true;
      }
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        const next = edges[edge]!;
        if (
          optimal[next] === tail - 1 &&
          tail - 1 >= shortestTail &&
          !seen.has(next)
        ) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  }

  return {
    /** 印の付いた局面か、採った問題と合流する局面なら近い問題。 */
    isNear(board: HakoiriMusumeBoardText): boolean {
      const index = indexByBoard.get(board)!;
      return (
        near[index] === 1 || ancestors[index] === 1 || mergesWithTaken(index)
      );
    },
    /** 採った問題のまわりに印を付ける。 */
    take(board: HakoiriMusumeBoardText) {
      const start = indexByBoard.get(board)!;
      markNearMoves(start);
      markAncestors(start);
      markDescendants(start);
      shortestTaken = Math.min(shortestTaken, optimal[start]!);
    },
  };
}

/**
 * 駒の組から、レベルごとに近い問題を除いて採る。候補を `rankHakoiriMusumeCandidate` の小さい順（同じなら盤面の文字列の順）に見て、
 * 近い問題でなければ採る。レベルごとに `limit` 問で止める。
 */
export function pickHakoiriMusumePieceSetProblems(
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
    const levelCandidates = candidates
      .filter(
        ({ assessment }) =>
          assessment.status === "classified" &&
          assessment.difficulty === difficulty,
      )
      .map((candidate) => ({
        candidate,
        rank: rankHakoiriMusumeCandidate(seed, candidate.board),
      }))
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          (left.candidate.board < right.candidate.board ? -1 : 1),
      );
    const filter = createHakoiriMusumeNearProblemFilter(space);
    for (const { candidate } of levelCandidates) {
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
