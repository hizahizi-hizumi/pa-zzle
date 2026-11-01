import { renderHook } from "@testing-library/react";

import type { GameProgress } from "@/games/play";
import { useClearSound, useOperationSound } from "@/games/play-sound-effects";

afterEach(() => {
  vi.unstubAllGlobals();
});

type TestOperation = { id: number; type: "placed" };

function createOperation(id: number): TestOperation {
  return { id, type: "placed" };
}

function renderOperationSound(
  initialOperation: TestOperation | null,
  playOperationSound: (operation: TestOperation) => void,
) {
  return renderHook(
    ({ operation }) => useOperationSound(operation, playOperationSound),
    { initialProps: { operation: initialOperation }, reactStrictMode: true },
  );
}

describe("useOperationSound", () => {
  describe("画面を出した後に新しい操作を知らせた場合", () => {
    let playOperationSound: (operation: TestOperation) => void;
    let rerender: (props: { operation: TestOperation | null }) => void;

    beforeEach(() => {
      playOperationSound = vi.fn();
      ({ rerender } = renderOperationSound(
        createOperation(1),
        playOperationSound,
      ));
    });

    test("同じ id の操作を描き直しても一度だけ鳴らすこと", () => {
      rerender({ operation: createOperation(2) });
      rerender({ operation: createOperation(2) });

      expect(playOperationSound).toHaveBeenCalledOnce();
      expect(playOperationSound).toHaveBeenCalledWith(createOperation(2));
    });

    test("操作の知らせが消えても鳴らさないこと", () => {
      rerender({ operation: null });

      expect(playOperationSound).not.toHaveBeenCalled();
    });
  });

  describe("画面を出した時点の操作の場合", () => {
    let playOperationSound: (operation: TestOperation) => void;

    beforeEach(() => {
      playOperationSound = vi.fn();
    });

    test("鳴らし済みとして扱い、鳴らさないこと", () => {
      renderOperationSound(createOperation(1), playOperationSound);

      expect(playOperationSound).not.toHaveBeenCalled();
    });
  });
});

describe("useClearSound", () => {
  const cases: readonly [
    string,
    GameProgress,
    readonly GameProgress[],
    number,
  ][] = [
    ["プレイ中から完成演出へ移る", "playing", ["clearing"], 1],
    ["完成演出から結果へ移る", "clearing", ["result"], 0],
    ["リセットして解き直す", "playing", ["clearing", "playing", "clearing"], 2],
    ["結果の後にリセットする", "result", ["playing"], 0],
  ];

  describe.each(cases)(
    "%s場合",
    (_, initialProgress, nextProgresses, expectedCount) => {
      let playClearSound: () => void;
      let rerender: (props: { progress: GameProgress }) => void;

      beforeEach(() => {
        playClearSound = vi.fn();
        ({ rerender } = renderHook(
          ({ progress }) => useClearSound(progress, playClearSound),
          {
            initialProps: { progress: initialProgress },
            reactStrictMode: true,
          },
        ));
      });

      test(`クリア音を ${expectedCount} 回鳴らすこと`, () => {
        for (const progress of nextProgresses) {
          rerender({ progress });
        }

        expect(playClearSound).toHaveBeenCalledTimes(expectedCount);
      });
    },
  );

  describe("動きを減らす設定の場合", () => {
    const playingProps: { progress: GameProgress } = { progress: "playing" };
    let playClearSound: () => void;
    let playReducedMotionClearSound: () => void;

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      playClearSound = vi.fn();
      playReducedMotionClearSound = vi.fn();
    });

    describe("完成した盤面を保持して見せる音を渡さない場合", () => {
      let rerender: (props: { progress: GameProgress }) => void;

      beforeEach(() => {
        ({ rerender } = renderHook(
          ({ progress }) => useClearSound(progress, playClearSound),
          { initialProps: playingProps },
        ));
      });

      test("クリア音を鳴らさないこと", () => {
        rerender({ progress: "clearing" });

        expect(playClearSound).not.toHaveBeenCalled();
      });
    });

    describe("完成した盤面を保持して見せる音を渡した場合", () => {
      let rerender: (props: { progress: GameProgress }) => void;

      beforeEach(() => {
        ({ rerender } = renderHook(
          ({ progress }) =>
            useClearSound(progress, playClearSound, {
              playReducedMotionClearSound,
            }),
          { initialProps: playingProps },
        ));
      });

      test("渡した音だけを一度鳴らすこと", () => {
        rerender({ progress: "clearing" });

        expect(playReducedMotionClearSound).toHaveBeenCalledOnce();
        expect(playClearSound).not.toHaveBeenCalled();
      });
    });
  });
});
