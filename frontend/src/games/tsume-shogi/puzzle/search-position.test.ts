import { createProblemSeededRandom } from "@/games/problem-seed";
import {
  applyTsumeShogiMove,
  formatTsumeShogiMoveUsi,
  listTsumeShogiAttackerChecks,
  listTsumeShogiDefenderResponses,
  parseTsumeShogiMoveUsi,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  createTsumeShogiPosition,
  formatTsumeShogiPosition,
  getTsumeShogiSideToMove,
  type TsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";
import {
  formatTsumeShogiSearchMoveUsi,
  isTsumeShogiInterposition,
  TsumeShogiSearchPosition,
  toTsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/search-position";

function play(position: TsumeShogiPosition, ...usiMoves: string[]) {
  return usiMoves.reduce(function applyUsi(current, usi) {
    return applyTsumeShogiMove(current, parseTsumeShogiMoveUsi(usi));
  }, position);
}

/** 王手と受けを交互に乱数で選び、手番ごとの局面を集める。王手か受けが尽きたら打ち切る。 */
function collectRandomPlayPositions(
  starts: readonly TsumeShogiPosition[],
  playsPerStart: number,
  maximumPlies: number,
): TsumeShogiPosition[] {
  const random = createProblemSeededRandom("tsume-shogi-search-position");
  const positions: TsumeShogiPosition[] = [];
  for (const start of starts) {
    for (let playIndex = 0; playIndex < playsPerStart; playIndex += 1) {
      let position = start;
      for (let ply = 0; ply < maximumPlies; ply += 1) {
        positions.push(position);
        const moves =
          getTsumeShogiSideToMove(position) === "attacker"
            ? listTsumeShogiAttackerChecks(position)
            : listTsumeShogiDefenderResponses(position);
        if (moves.length === 0) {
          break;
        }
        position = applyTsumeShogiMove(
          position,
          moves[Math.floor(random() * moves.length)]!,
        );
      }
    }
  }
  return positions;
}

function listSlowMoves(position: TsumeShogiPosition): string[] {
  const moves =
    getTsumeShogiSideToMove(position) === "attacker"
      ? listTsumeShogiAttackerChecks(position)
      : listTsumeShogiDefenderResponses(position);
  return moves.map(formatTsumeShogiMoveUsi).sort();
}

function listFastMoves(position: TsumeShogiPosition): string[] {
  const state = new TsumeShogiSearchPosition(position);
  const moves =
    state.sideToMove === "attacker"
      ? state.listAttackerChecks()
      : state.listDefenderResponses();
  return moves.map(formatTsumeShogiSearchMoveUsi).sort();
}

describe("TsumeShogiSearchPosition", () => {
  describe("王手と受けの列挙", () => {
    // 飛・角・香の長い利き、桂、成駒、玉方の盤上の駒と駒箱からの合駒を含む局面から、王手と受けを乱数で進める。
    const starts = [
      createTsumeShogiPosition("4k4/9/4P4/9/9/9/9/9/9", { gold: 1 }),
      createTsumeShogiPosition("6snl/5+Rgk1/6ppp/9/9/9/9/9/9", {
        bishop: 1,
        gold: 1,
      }),
      createTsumeShogiPosition("3gk4/9/1B2P4/9/R8/9/9/9/9", {
        silver: 2,
        knight: 1,
        lance: 1,
      }),
      createTsumeShogiPosition("7nl/6Bk1/7p1/5N3/9/9/9/9/9", {
        rook: 1,
        gold: 1,
        pawn: 1,
      }),
    ];
    const positions = collectRandomPlayPositions(starts, 30, 8);

    test("全合法手から王手・受けを選ぶ列挙と同じ手を返すこと", () => {
      const mismatches = positions.filter(function differs(position) {
        return (
          listFastMoves(position).join(" ") !==
          listSlowMoves(position).join(" ")
        );
      });

      expect(mismatches.map(formatTsumeShogiPosition)).toEqual([]);
      expect(positions.length).toBeGreaterThan(500);
    });
  });

  describe("着手と戻し", () => {
    const position = createTsumeShogiPosition("8k/9/6NG1/9/9/9/9/9/9", {
      rook: 1,
    });
    const before = formatTsumeShogiPosition(position);

    test("指した手を戻すと元の局面に戻ること", () => {
      const state = new TsumeShogiSearchPosition(position);
      const key = state.key;
      for (const check of state.listAttackerChecks()) {
        state.play(check);
        for (const response of state.listDefenderResponses()) {
          state.play(response);
          state.undo(response);
        }
        state.undo(check);
      }

      expect(formatTsumeShogiPosition(state.toPosition())).toBe(before);
      expect(state.key).toBe(key);
    });
  });

  describe("合駒の判定", () => {
    // 9一の飛の王手に、玉方は玉の移動・合駒（駒箱の打ち、4二の銀の移動合）で受ける。
    const position = play(
      createTsumeShogiPosition("8k/5s3/7G1/9/9/9/9/9/9", { rook: 1 }),
      "R*9a",
    );
    const expectedInterpositions = new Set(
      listTsumeShogiDefenderResponses(position)
        .map(formatTsumeShogiMoveUsi)
        .filter(function isInterposition(usi) {
          return usi.includes("*") || usi.startsWith("4b");
        }),
    );

    test("駒箱からの打ちと玉以外の駒で塞ぐ手だけを合駒とすること", () => {
      const state = new TsumeShogiSearchPosition(position);
      const interpositions = state
        .listDefenderResponses()
        .filter(isTsumeShogiInterposition)
        .map(function toUsi(move) {
          return formatTsumeShogiMoveUsi(toTsumeShogiMove(move));
        });

      expect(new Set(interpositions)).toEqual(expectedInterpositions);
      expect(interpositions.length).toBeGreaterThan(0);
    });
  });
  describe("王手をかけている駒", () => {
    // 2一の銀を1二へ引くと、1二の銀と9一の飛（開き王手）の両方が1一の玉に利く。
    const position = play(
      createTsumeShogiPosition("R6Sk/9/9/9/9/9/9/9/9", {}),
      "2a1b",
    );
    const state = new TsumeShogiSearchPosition(position);

    test("両王手の2つの駒のマスと玉の位置を返すこと", () => {
      const checkers = state.listCheckingSquares();
      const king = state.defenderKingSquare;

      expect(checkers).toEqual(
        expect.arrayContaining([
          { file: 1, rank: 2 },
          { file: 9, rank: 1 },
        ]),
      );
      expect(checkers).toHaveLength(2);
      expect(king).toEqual({ file: 1, rank: 1 });
    });

    test("駒のあるマスと空きマスを見分けること", () => {
      const occupied = [
        { file: 1, rank: 2 },
        { file: 2, rank: 1 },
      ].map((square) => state.isOccupied(square));

      expect(occupied).toEqual([true, false]);
    });
  });
});
