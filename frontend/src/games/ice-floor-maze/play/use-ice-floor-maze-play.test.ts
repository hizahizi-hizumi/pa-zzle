import { act, cleanup, renderHook } from "@testing-library/react";

import {
  _private,
  useIceFloorMazePlay,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import type { IceFloorMazePooledProblem } from "@/games/ice-floor-maze/problem/problem-pool";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import { createProblemId } from "@/games/problem-id";
import * as problemSeed from "@/games/problem-seed";

// #  1  #  3  4
// 5  6  7  #  #
// 10 11 #  #  #
// 15 16 S  G  19
// #  21 22 23 #
// 開始位置 17 から下・右・上の3手でゴール 18 に止まる。上は岩ですぐ止まる。
// 右はゴールを通り過ぎて 19 で止まり、19 から行ける 15・5・7 のどこからもゴールで止まれない（詰み）。
// 詰みの中では 19 →左 15 →上 5 →右 7 →左 5 →下 15 →右 19 と滑れ、7 から下と 19 から上は1マスも動けない。
vi.mock("@/games/ice-floor-maze/problem-selection", async () => {
  const { parseIceFloorMazeBoard } = await import(
    "@/games/ice-floor-maze/puzzle/board"
  );
  return {
    selectIceFloorMazeProblemForDifficulty: (
      _difficulty: string,
      seed: string,
    ) => ({
      problem: {
        board: parseIceFloorMazeBoard([
          "#.#..",
          "...##",
          "..###",
          ".....",
          "#...#",
        ]),
        start: 17,
        goal: 18,
      },
      identity: {
        generatorVersion: "3",
        seed,
        conditions: { width: 5, height: 5 },
      },
      optimalMoveCount: 3,
    }),
  };
});

const solution: readonly IceFloorMazeDirection[] = ["down", "right", "up"];
/** 開始位置から詰みに入る滑り。 */
const intoDeadlock: readonly IceFloorMazeDirection[] = ["right"];
/** 詰みに入った 19 から、詰みの中を一巡りして 19 へ戻る滑り（19 → 15 → 5 → 7 → 5 → 15 → 19）。 */
const deadlockLoop: readonly IceFloorMazeDirection[] = [
  "left",
  "up",
  "right",
  "left",
  "down",
  "right",
];
const { deadlockNoticeSlideCount } = _private;

/** 詰みに入ってから `slidCount` 回滑った後に、詰みの中で続けられる `count` 回の滑り。 */
function deadlockSlides(count: number, slidCount = 0): IceFloorMazeDirection[] {
  const loopCount = Math.ceil((slidCount + count) / deadlockLoop.length);
  return Array.from({ length: loopCount }, () => deadlockLoop)
    .flat()
    .slice(slidCount, slidCount + count);
}

/** 詰みに入った後、知らせるまで詰みの中で続ける滑り。 */
const withinDeadlock = deadlockSlides(deadlockNoticeSlideCount);
/** 知らせる1回手前までの滑り。 */
const untilNotice = withinDeadlock.slice(0, -1);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useIceFloorMazePlay>;

function slideInOrder(
  result: { current: HookResult },
  directions: readonly IceFloorMazeDirection[],
): void {
  for (const direction of directions) {
    act(() => result.current.slide(direction));
  }
}

describe("useIceFloorMazePlay", () => {
  let result: { current: HookResult };

  beforeEach(() => {
    ({ result } = renderHook(() => useIceFloorMazePlay("1")));
  });

  test("駒を開始位置に置き、盤面・ゴール・最短手数を持って始めること", () => {
    const { board, goal, position, optimalMoveCount, lastSlide, blockedInput } =
      result.current;

    expect({ width: board.width, height: board.height }).toEqual({
      width: 5,
      height: 5,
    });
    expect(goal).toBe(18);
    expect(position).toBe(17);
    expect(optimalMoveCount).toBe(3);
    expect(lastSlide).toBeNull();
    expect(blockedInput).toBeNull();
  });

  test("滑らせると駒を止まった位置へ動かし、通ったマスを直前の滑りとして渡すこと", () => {
    act(() => result.current.slide("down"));

    expect(result.current.position).toBe(22);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.lastSlide).toMatchObject({
      direction: "down",
      from: 17,
      to: 22,
      path: [22],
      passedGoal: false,
      isClearingMove: false,
      entersTrap: false,
    });
  });

  test("ゴールを通り過ぎた滑りを直前の滑りで知らせること", () => {
    act(() => result.current.slide("right"));

    expect(result.current.lastSlide).toMatchObject({
      to: 19,
      path: [18, 19],
      passedGoal: true,
    });
    expect(result.current.status).toBe("playing");
  });

  test("1マスも動けない向きでは駒も手数も変えず、成立しなかった向きを渡すこと", () => {
    act(() => result.current.slide("up"));

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.blockedInput).toMatchObject({
      direction: "up",
      from: 17,
      stopper: 12,
    });
    expect(result.current.lastSlide).toBeNull();
  });

  test("続けて成立しない向きを選んでも、入力ごとに別の入力として渡すこと", () => {
    act(() => result.current.slide("up"));
    const firstInputId = result.current.blockedInput?.id;

    act(() => result.current.slide("up"));

    expect(result.current.blockedInput?.id).not.toBe(firstInputId);
  });

  describe("滑った後に成立しない向きを選んだ場合", () => {
    let lastSlide: HookResult["lastSlide"];

    beforeEach(() => {
      slideInOrder(result, ["down"]);
      lastSlide = result.current.lastSlide;
    });

    test("直前の滑りを跡の元として残し、成立しなかった向きを別に渡すこと", () => {
      act(() => result.current.slide("down"));

      expect(result.current.lastSlide).toBe(lastSlide);
      expect(result.current.blockedInput).toMatchObject({
        direction: "down",
        from: 22,
        stopper: null,
      });
      expect(result.current.moveCount).toBe(1);
    });

    test("次に滑ると、成立しなかった入力を消すこと", () => {
      slideInOrder(result, ["down", "right"]);

      expect(result.current.blockedInput).toBeNull();
      expect(result.current.lastSlide).toMatchObject({ from: 22, to: 23 });
    });
  });

  test("同じ描画の間に続けて入力した滑りを入力の順にすべて適用すること", () => {
    act(() => {
      for (const direction of solution) {
        result.current.slide(direction);
      }
    });

    expect(result.current.position).toBe(18);
    expect(result.current.moveCount).toBe(3);
    expect(result.current.status).toBe("cleared");
  });

  test("ゴールに止まれるプレイ中は、もうゴールに止まれないことを知らせないこと", () => {
    act(() => result.current.slide("down"));

    expect(result.current.isTrapped).toBe(false);
  });

  describe("詰みに入った場合", () => {
    beforeEach(() => {
      slideInOrder(result, intoDeadlock);
    });

    test("詰みに入った滑りでは知らせないこと", () => {
      expect(result.current.isTrapped).toBe(false);
      expect(result.current.lastSlide).toMatchObject({
        to: 19,
        entersTrap: false,
      });
    });

    test("詰みのまま知らせる数より1回少なく滑っても知らせないこと", () => {
      slideInOrder(result, untilNotice);

      expect(result.current.isTrapped).toBe(false);
    });

    test("詰みのまま知らせる数だけ滑ると知らせ、知らせ始めた滑りとして渡すこと", () => {
      slideInOrder(result, withinDeadlock);

      expect(result.current.isTrapped).toBe(true);
      expect(result.current.lastSlide).toMatchObject({ entersTrap: true });
    });

    test("成立しない入力は滑りとして数えないこと", () => {
      act(() => result.current.slide("up"));
      slideInOrder(result, untilNotice);
      const noticedAfterBlockedInput = result.current.isTrapped;
      slideInOrder(result, withinDeadlock.slice(-1));

      expect(noticedAfterBlockedInput).toBe(false);
      expect(result.current.isTrapped).toBe(true);
    });

    test("途中で待ったを使うと、戻った詰みの状態から数え直すこと", () => {
      slideInOrder(result, untilNotice);
      act(() => result.current.undo());
      const slidesAfterUndo = deadlockSlides(
        deadlockNoticeSlideCount,
        untilNotice.length - 1,
      );
      slideInOrder(result, slidesAfterUndo.slice(0, -1));
      const noticedBeforeCountReached = result.current.isTrapped;
      slideInOrder(result, slidesAfterUndo.slice(-1));

      expect(noticedBeforeCountReached).toBe(false);
      expect(result.current.isTrapped).toBe(true);
    });

    test("リセットすると数え直すこと", () => {
      slideInOrder(result, untilNotice);
      act(() => result.current.replay());
      slideInOrder(result, [...intoDeadlock, ...untilNotice]);

      expect(result.current.isTrapped).toBe(false);
    });

    describe("知らせた後", () => {
      beforeEach(() => {
        slideInOrder(result, withinDeadlock);
      });

      test("滑っても知らせ続け、知らせ始めた滑りとはしないこと", () => {
        slideInOrder(result, deadlockSlides(1, withinDeadlock.length));

        expect(result.current.isTrapped).toBe(true);
        expect(result.current.lastSlide).toMatchObject({ entersTrap: false });
      });

      test("待ったで戻った先がまだ詰みなら知らせ続け、ゴールに止まれる状態まで戻ると知らせをやめること", () => {
        const noticedWhileDeadlocked: boolean[] = [];
        for (const _ of withinDeadlock) {
          act(() => result.current.undo());
          noticedWhileDeadlocked.push(result.current.isTrapped);
        }
        act(() => result.current.undo());

        expect(noticedWhileDeadlocked).toEqual(withinDeadlock.map(() => true));
        expect(result.current.position).toBe(17);
        expect(result.current.isTrapped).toBe(false);
      });

      test("ゴールに止まれる状態まで戻った後は、また詰みに入っても数え直すこと", () => {
        act(() => result.current.restart());
        slideInOrder(result, [...intoDeadlock, ...untilNotice]);

        expect(result.current.isTrapped).toBe(false);
      });
    });
  });

  test("待ったで直前の位置へ戻し、総手数を減らさず待ったを数えること", () => {
    slideInOrder(result, ["right"]);

    act(() => result.current.undo());

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.isTrapped).toBe(false);
    expect(result.current.lastSlide).toBeNull();
  });

  test("盤面を戻すで駒を開始位置へ戻し、総手数を引き継いで回数を数えること", () => {
    slideInOrder(result, ["down", "right"]);

    act(() => result.current.restart());

    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(2);
    expect(result.current.restartCount).toBe(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRestart).toBe(false);
  });

  test("リセットで同じ問題の新しいプレイを始めること", () => {
    const { problemIdentity } = result.current;
    slideInOrder(result, ["down", "right"]);

    act(() => result.current.replay());

    expect(result.current.problemIdentity).toBe(problemIdentity);
    expect(result.current.position).toBe(17);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
  });

  describe("移れる状態が少ない詰みに入った場合", () => {
    // G  1  #
    // 3  #  5
    // 6  7  S
    // #  #  11
    // 開始位置 8 から左・上の2手でゴール 0 に止まる。下は 11 で止まり、詰みの中は 11 と 5 を行き来するだけになる。
    const confinedProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..#", ".#.", "...", "##."]),
        start: 8,
        goal: 0,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-confined-deadlock",
        conditions: { width: 3, height: 4 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() =>
        useIceFloorMazePlay("1", confinedProblem),
      ));
    });

    test("詰みに入った滑りで知らせ、知らせ始めた滑りとして渡すこと", () => {
      act(() => result.current.slide("down"));

      expect(result.current.isTrapped).toBe(true);
      expect(result.current.lastSlide).toMatchObject({
        from: 8,
        to: 11,
        entersTrap: true,
      });
    });
  });

  describe("ゴールで止まった場合", () => {
    beforeEach(() => {
      slideInOrder(result, ["right"]);
      act(() => result.current.undo());
      slideInOrder(result, solution);
    });

    test("クリアして完成演出へ進み、クリアした手を直前の滑りで知らせること", () => {
      const { status, progress, lastSlide } = result.current;

      expect(status).toBe("cleared");
      expect(progress).toBe("clearing");
      expect(lastSlide).toMatchObject({ isClearingMove: true });
    });

    test("取り消した手も含む総手数と最短手数を結果に含めること", () => {
      const { result: playResult } = result.current;

      expect(playResult).toMatchObject({
        moveCount: 4,
        undoCount: 1,
        restartCount: 0,
        optimalMoveCount: 3,
        moveDelta: 1,
      });
    });

    test("取り消した手も数えた総手数で効率を評価し、描くマスと要素の数から基準時間を求めること", () => {
      const { result: playResult } = result.current;

      expect(playResult).toMatchObject({
        speedReference: { drawnCellCount: 25, elementCount: 0 },
        speedRule: { fullScoreMs: 12_500, zeroScoreMs: 25_000 },
        score: { breakdown: { efficiency: 56 } },
      });
    });

    test("それ以上の入力を受け付けないこと", () => {
      const { lastSlide, blockedInput } = result.current;

      act(() => result.current.slide("down"));

      expect(result.current.position).toBe(18);
      expect(result.current.lastSlide).toBe(lastSlide);
      expect(result.current.blockedInput).toBe(blockedInput);
    });

    test("完成演出を終えると結果表示へ進むこと", () => {
      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
    });
  });

  describe("最初の問題を渡した場合", () => {
    const initialProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..#.", "....", "....", "...."]),
        start: 0,
        goal: 1,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-requested",
        conditions: { width: 4, height: 4 },
      },
      optimalMoveCount: 1,
    };

    test("渡した問題の盤面・identity・最短手数で始めること", () => {
      const requested = renderHook(() =>
        useIceFloorMazePlay("1", initialProblem),
      );

      const { board, goal, position, problemIdentity, optimalMoveCount } =
        requested.result.current;

      expect({
        board,
        goal,
        position,
        problemIdentity,
        optimalMoveCount,
      }).toEqual({
        board: initialProblem.problem.board,
        goal: 1,
        position: 0,
        problemIdentity: initialProblem.identity,
        optimalMoveCount: 1,
      });
    });
  });

  describe("要素のある問題を渡した場合", () => {
    // 0  1  b
    // 3  c  5
    // 6  7  8
    // 開始位置 0 から右へ滑るともろい岩 2 が崩れ、続けて下へ滑ると薄い氷 4 を通って割る。
    const elementProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..b", ".c.", "..."]),
        start: 0,
        goal: 8,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-elements",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", elementProblem)));
    });

    test("崩したもろい岩と割った薄い氷を直前の滑りと今の盤面で渡すこと", () => {
      slideInOrder(result, ["right", "down"]);

      const { lastSlide, cells } = result.current;

      expect(lastSlide).toMatchObject({
        from: 1,
        to: 7,
        crumbledRock: null,
        crackedIce: [4],
      });
      expect(cells[2]).toBe("ice");
      expect(cells[4]).toBe("water");
    });

    test("待ったで割った薄い氷を戻すこと", () => {
      slideInOrder(result, ["right", "down"]);

      act(() => result.current.undo());

      expect(result.current.position).toBe(1);
      expect(result.current.cells[4]).toBe("thin-ice");
    });

    test("要素を変えて開始位置へ戻っても盤面を戻せること", () => {
      slideInOrder(result, ["right", "left"]);

      const { position, canRestart } = result.current;

      expect(position).toBe(0);
      expect(canRestart).toBe(true);
    });
  });

  describe("床のある問題を渡した場合", () => {
    // 0  o  2
    // 3  4  5
    // 6  7  8
    // 開始位置 0 から右へ滑ると床 1 に入って止まり、続けて下へ滑ると 7 で止まる。
    const floorProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard([".o.", "...", "..."]),
        start: 0,
        goal: 7,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-floor",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("1", floorProblem)));
    });

    test("床に入って止まった滑りを直前の滑りで知らせ、ほかの滑りでは知らせないこと", () => {
      act(() => result.current.slide("right"));
      const intoFloor = result.current.lastSlide;
      act(() => result.current.slide("down"));
      const offFloor = result.current.lastSlide;

      expect(intoFloor).toMatchObject({ to: 1, stoppedOnFloor: true });
      expect(offFloor).toMatchObject({ to: 7, stoppedOnFloor: false });
    });
  });

  describe("隣のもろい岩へ押した場合", () => {
    // 0  b  2
    // 3  4  5
    // 6  7  8
    // 開始位置 0 から右は隣のもろい岩に阻まれて1マスも動けない。
    const pushedProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard([".b.", "...", "..."]),
        start: 0,
        goal: 8,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-pushed",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", pushedProblem)));
    });

    test("阻んだもろい岩のマスを渡し、もろい岩を崩さないこと", () => {
      act(() => result.current.slide("right"));

      const { blockedInput, cells } = result.current;

      expect(blockedInput).toMatchObject({ direction: "right", stopper: 1 });
      expect(cells[1]).toBe("brittle-rock");
    });
  });

  describe("雪のある問題を渡した場合", () => {
    // 0  s  2
    // 3  4  5
    // s  7  8
    // 開始位置 0 から右へ滑ると雪 1 に入って雪を 2 へ押し出し、1 で止まる。
    // 0 から下へは雪 6 の先が盤面の外なので押し出せず、雪の手前の 3 で止まる。3 から下は1マスも動けない。
    const snowProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard([".s.", "...", "s.."]),
        start: 0,
        goal: 5,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-snow",
        conditions: { width: 3, height: 3 },
      },
      optimalMoveCount: 3,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", snowProblem)));
    });

    test("押し出した雪を直前の滑りと今の盤面で渡すこと", () => {
      act(() => result.current.slide("right"));

      const { lastSlide, position, cells } = result.current;

      expect(lastSlide).toMatchObject({
        to: 1,
        pushedSnow: { from: 1, to: 2 },
        movedBlock: null,
        stoppedOnFloor: false,
      });
      expect(position).toBe(1);
      expect([cells[1], cells[2]]).toEqual(["ice", "snow-mound"]);
    });

    test("待ったで押し出した雪を戻すこと", () => {
      act(() => result.current.slide("right"));

      act(() => result.current.undo());

      expect([result.current.cells[1], result.current.cells[2]]).toEqual([
        "snow",
        "ice",
      ]);
    });

    test("押し出せない雪の手前で止まり、続けて雪へ押すと阻んだ雪のマスを渡し、雪を動かさないこと", () => {
      slideInOrder(result, ["down", "down"]);

      const { blockedInput, position, cells } = result.current;

      expect(position).toBe(3);
      expect(blockedInput).toMatchObject({ direction: "down", stopper: 6 });
      expect(cells[6]).toBe("snow");
    });
  });

  describe("滑る氷の塊のある問題を渡した場合", () => {
    // 0  1  m  3
    // 4  5  6  7
    // 8  9  10 11
    // 12 13 14 15
    // 開始位置 0 から右へ滑ると、1 から塊 2 を押して塊が外壁の手前の 3 まで滑り、駒は 2 で止まる。
    // 続けて右は隣の塊に阻まれて1マスも動けない。
    const blockProblem: IceFloorMazePooledProblem = {
      problem: {
        board: parseIceFloorMazeBoard(["..m.", "....", "....", "...."]),
        start: 0,
        goal: 15,
      },
      identity: {
        generatorVersion: "3",
        seed: "ice-floor-maze-block",
        conditions: { width: 4, height: 4 },
      },
      optimalMoveCount: 2,
    };

    beforeEach(() => {
      ({ result } = renderHook(() => useIceFloorMazePlay("3", blockProblem)));
    });

    test("始めたときの塊のマスを渡し、塊の元のマスを氷として渡すこと", () => {
      const { blocks, cells } = result.current;

      expect(blocks).toEqual([2]);
      expect(cells[2]).toBe("ice");
    });

    test("押して動かした塊を直前の滑りと塊のマスで渡すこと", () => {
      act(() => result.current.slide("right"));

      const { lastSlide, position, blocks } = result.current;

      expect(lastSlide).toMatchObject({
        to: 2,
        path: [1, 2],
        movedBlock: { from: 2, to: 3 },
        pushedSnow: null,
      });
      expect(position).toBe(2);
      expect(blocks).toEqual([3]);
    });

    test("隣の塊へ押すと、阻んだ塊のマスを渡し、塊を動かさないこと", () => {
      act(() => result.current.slide("right"));
      act(() => result.current.slide("right"));

      const { blockedInput, blocks } = result.current;

      expect(blockedInput).toMatchObject({ direction: "right", stopper: 3 });
      expect(blocks).toEqual([3]);
    });

    test("待ったで動かした塊を戻すこと", () => {
      act(() => result.current.slide("right"));

      act(() => result.current.undo());

      expect(result.current.blocks).toEqual([2]);
    });
  });

  describe("最初に避ける問題を渡し、最初に引いた seed がその問題を指す場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("ice-floor-maze-avoided")
        .mockReturnValueOnce("ice-floor-maze-other");
      const avoidedProblemId = createProblemId({
        generatorVersion: "3",
        seed: "ice-floor-maze-avoided",
        conditions: { width: 5, height: 5 },
      });
      ({ result } = renderHook(() =>
        useIceFloorMazePlay("1", undefined, avoidedProblemId),
      ));
    });

    test("seed を引き直して避ける問題と別の問題で始めること", () => {
      expect(result.current.problemIdentity.seed).toBe("ice-floor-maze-other");
    });
  });

  describe("別の問題で最初に引いた seed が今と同じ問題を指す場合", () => {
    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("ice-floor-maze-current")
        .mockReturnValueOnce("ice-floor-maze-current")
        .mockReturnValueOnce("ice-floor-maze-other");
      ({ result } = renderHook(() => useIceFloorMazePlay("1")));
    });

    test("seed を引き直して今と別の問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(result.current.problemIdentity.seed).toBe("ice-floor-maze-other");
    });
  });
});
