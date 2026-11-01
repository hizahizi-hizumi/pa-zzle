import { act, cleanup, render, screen } from "@testing-library/react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialOverlay/TutorialCrossFadeIntroScene";
import type { TutorialIntroScene } from "@/components/TutorialOverlay/TutorialScreen";

const goalBoardText = "ゴールの盤面";
const startBoardText = "始めの盤面";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
});

/** 盤面を替える動きを、`finishAnimations` を呼ぶまで終えない形で差し替える。 */
function installAnimate(): { finishAnimations: () => Promise<void> } {
  const finishers: (() => void)[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(() => {
      const finished = new Promise<void>((resolve) => {
        finishers.push(resolve);
      });
      return { cancel: vi.fn(), finished } as unknown as Animation;
    }),
  });
  return {
    async finishAnimations() {
      await act(async () => {
        for (const finish of finishers) {
          finish();
        }
      });
    },
  };
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function renderScene(
  scene: TutorialIntroScene | null,
  playing: boolean,
  onSceneEnd: () => void,
): void {
  render(
    <TutorialCrossFadeIntroScene
      scene={scene}
      playing={playing}
      onSceneEnd={onSceneEnd}
    >
      {(showsGoal) => <p>{showsGoal ? goalBoardText : startBoardText}</p>}
    </TutorialCrossFadeIntroScene>,
  );
}

describe("TutorialCrossFadeIntroScene", () => {
  let onSceneEnd: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onSceneEnd = vi.fn<() => void>();
  });

  describe("ゴールの場面を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      renderScene("goal", true, onSceneEnd);
    });

    test("ゴールの盤面を動かさずに見せ、すぐ場面を終えること", () => {
      const goalBoards = screen.queryAllByText(goalBoardText);
      const startBoards = screen.queryAllByText(startBoardText);

      expect(goalBoards).toHaveLength(1);
      expect(startBoards).toHaveLength(0);
      expect(onSceneEnd).toHaveBeenCalledOnce();
    });
  });

  describe("始めの場面を動きで見せる場合", () => {
    let finishAnimations: () => Promise<void>;

    beforeEach(() => {
      ({ finishAnimations } = installAnimate());
      renderScene("start", true, onSceneEnd);
    });

    test("動きを終えるまでは、始めの盤面に読み上げないゴールの盤面を重ね、場面を終えないこと", () => {
      const startBoards = screen.queryAllByText(startBoardText);
      const hiddenGoalBoard = screen
        .getByText(goalBoardText)
        .closest("[aria-hidden='true']");

      expect(startBoards).toHaveLength(1);
      expect(hiddenGoalBoard).not.toBeNull();
      expect(onSceneEnd).not.toHaveBeenCalled();
    });

    test("動きを終えると、重ねたゴールの盤面を外して場面を終えること", async () => {
      await finishAnimations();

      const goalBoards = screen.queryAllByText(goalBoardText);

      expect(goalBoards).toHaveLength(0);
      expect(onSceneEnd).toHaveBeenCalledOnce();
    });
  });

  describe("動きを減らす設定で始めの場面を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      renderScene("start", true, onSceneEnd);
    });

    test("ゴールの盤面を重ねずに始めの盤面へ替え、すぐ場面を終えること", () => {
      const goalBoards = screen.queryAllByText(goalBoardText);
      const startBoards = screen.queryAllByText(startBoardText);

      expect(goalBoards).toHaveLength(0);
      expect(startBoards).toHaveLength(1);
      expect(onSceneEnd).toHaveBeenCalledOnce();
    });
  });

  describe("場面の動きを見せない間", () => {
    beforeEach(() => {
      installAnimate();
      renderScene("start", false, onSceneEnd);
    });

    test("始めの盤面を見せたまま、場面の終わりを伝えないこと", () => {
      const startBoards = screen.queryAllByText(startBoardText);

      expect(startBoards).toHaveLength(1);
      expect(onSceneEnd).not.toHaveBeenCalled();
    });
  });
});
