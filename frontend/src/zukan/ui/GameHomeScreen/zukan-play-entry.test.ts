import {
  _private,
  playZukanPlayEntry,
} from "@/zukan/ui/GameHomeScreen/zukan-play-entry";

const { PLAY_ENTRY_ATTRIBUTE, SCENE_FADE_MS } = _private;

/** プレイ画面の盤面を測れるまで待つ上限を、確かに過ぎる時間。 */
const PAST_LANDING_WAIT_MS = 400;

type ControlledAnimation = {
  animation: Animation;
  keyframes: Keyframe[];
  finish: () => void;
};

/** 終わるときをテストが決める Animation を作る。取り消すと、終わらずに中断する。 */
function createControlledAnimation(
  keyframes: Keyframe[] = [],
): ControlledAnimation {
  let resolveFinished: (animation: Animation) => void = () => {};
  let rejectFinished: (reason: unknown) => void = () => {};
  const animation = {
    finished: new Promise<Animation>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    }),
    cancel: vi.fn(() => {
      rejectFinished(new DOMException("", "AbortError"));
    }),
  } as unknown as Animation;
  animation.finished.catch(() => {});
  return {
    animation,
    keyframes,
    finish: () => resolveFinished(animation),
  };
}

function createEntryElements() {
  const scene = document.createElement("div");
  const board = document.createElement("div");
  board.dataset.testBoard = "";
  board.append(document.createElement("div"));
  scene.append(board);
  document.body.append(scene);
  return { scene, board };
}

/** 広げる盤面の写し。ゲームのホームの外の body の直下に置かれる。 */
function queryRisenBoard(scene: HTMLElement): Element | null {
  return (
    [...document.body.children].find(
      (child) => child !== scene && child.matches("[data-test-board]"),
    ) ?? null
  );
}

/** body の直下に置いた、ゲームのホームの中身以外の要素の数。広げる盤面の写しと、押し直しを防ぐ覆い。 */
function countEntryLayers(scene: HTMLElement): number {
  return [...document.body.children].filter((child) => child !== scene).length;
}

const root = document.documentElement;

let scene: HTMLElement;
let board: HTMLElement;
let onArrive: ReturnType<typeof vi.fn<() => void>>;
let onFinished: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  ({ scene, board } = createEntryElements());
  onArrive = vi.fn();
  onFinished = vi.fn();
});

afterEach(() => {
  document.body.replaceChildren();
  root.removeAttribute(PLAY_ENTRY_ATTRIBUTE);
});

describe("playZukanPlayEntry", () => {
  describe("動かせない環境の場合", () => {
    test("すぐにプレイ画面を開き、終えたと知らせること", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });

      expect(onArrive).toHaveBeenCalledTimes(1);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    test("盤面の写しも覆いも置かず、ルート要素に入ってきた印を付けないこと", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });

      expect(countEntryLayers(scene)).toBe(0);
      expect(root.hasAttribute(PLAY_ENTRY_ATTRIBUTE)).toBe(false);
    });
  });

  describe("動きを減らす設定で、動かせる環境の場合", () => {
    let animate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      animate = vi.fn(() => createControlledAnimation().animation);
      Element.prototype.animate = animate as unknown as Element["animate"];
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    test("動かさずに、すぐにプレイ画面を開いて終えたと知らせること", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });

      expect(animate).not.toHaveBeenCalled();
      expect(countEntryLayers(scene)).toBe(0);
      expect(onArrive).toHaveBeenCalledTimes(1);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });

  describe("動かせる環境の場合", () => {
    let animations: ControlledAnimation[];
    /** プレイ画面を開くときの、ルート要素の入ってきた印。 */
    let entryOnArrive: (string | null)[];

    function finishAllAnimations() {
      for (const { finish } of animations) {
        finish();
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      animations = [];
      entryOnArrive = [];
      onArrive.mockImplementation(() => {
        entryOnArrive.push(root.getAttribute(PLAY_ENTRY_ATTRIBUTE));
      });
      Element.prototype.animate = vi.fn((keyframes: Keyframe[]) => {
        const controlled = createControlledAnimation(keyframes);
        animations.push(controlled);
        return controlled.animation;
      }) as unknown as Element["animate"];
    });

    afterEach(() => {
      vi.useRealTimers();
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    test("ゲームのホームの中身が薄れるまではプレイ画面を開かず、薄れたら一度だけ開くこと", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });
      vi.advanceTimersByTime(SCENE_FADE_MS - 1);
      const arrivedBefore = onArrive.mock.calls.length;
      vi.advanceTimersByTime(1);
      const arrivedAt = onArrive.mock.calls.length;
      vi.advanceTimersByTime(SCENE_FADE_MS * 10);

      expect(arrivedBefore).toBe(0);
      expect(arrivedAt).toBe(1);
      expect(onArrive).toHaveBeenCalledTimes(1);
    });

    test("プレイ画面を開くのと同時に、ルート要素に盤面が着く途中の印を付けること", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });
      vi.advanceTimersByTime(SCENE_FADE_MS);

      expect(entryOnArrive).toEqual(["arriving"]);
    });

    test("盤面が着くまでは、盤面の写しと覆いを body に置き、元の盤面を隠して、終えたと知らせないこと", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });
      vi.advanceTimersByTime(SCENE_FADE_MS);
      const risen = queryRisenBoard(scene);

      expect(risen?.getAttribute("aria-hidden")).toBe("true");
      expect(countEntryLayers(scene)).toBe(2);
      expect(board.style.opacity).toBe("0");
      expect(onFinished).not.toHaveBeenCalled();
    });

    test("写しの中の盤面に、盤面を現す動きをやり直させないこと", () => {
      playZukanPlayEntry({ board, scene, onArrive, onFinished });
      const copiedContent = queryRisenBoard(scene)?.firstElementChild ?? null;

      expect(copiedContent?.getAttribute("style")).toBe("animation: none;");
    });

    describe("盤面が着いた場合", () => {
      /** プレイ画面へ入り、盤面が着くまで進める。 */
      async function playUntilLanded() {
        playZukanPlayEntry({ board, scene, onArrive, onFinished });
        await vi.advanceTimersByTimeAsync(SCENE_FADE_MS + PAST_LANDING_WAIT_MS);
        finishAllAnimations();
        await vi.advanceTimersByTimeAsync(0);
      }

      test("ルート要素の印を着いた印に替え、写しを残したまま終えたと知らせないこと", async () => {
        await playUntilLanded();
        const entry = root.getAttribute(PLAY_ENTRY_ATTRIBUTE);

        expect(entry).toBe("landed");
        expect(queryRisenBoard(scene)).not.toBeNull();
        expect(onFinished).not.toHaveBeenCalled();
      });

      test("写しが薄れ終えると、写しと覆いを body から除き、印を外し、盤面を見せ直して終えたと知らせること", async () => {
        await playUntilLanded();
        finishAllAnimations();
        await vi.advanceTimersByTimeAsync(0);

        expect(countEntryLayers(scene)).toBe(0);
        expect(root.hasAttribute(PLAY_ENTRY_ATTRIBUTE)).toBe(false);
        expect(board.style.opacity).toBe("");
        expect(onFinished).toHaveBeenCalledTimes(1);
      });
    });

    describe("プレイ画面の盤面が描かれた場合", () => {
      /** 写しを測ると、中心 (50, 50)・幅 100 の所にある。 */
      const risenRect = new DOMRect(0, 0, 100, 100);
      /** プレイ画面の盤面は、中心 (200, 300)・幅 200 の所にある。 */
      const playBoardRect = new DOMRect(100, 200, 200, 200);

      beforeEach(() => {
        const playBoard = document.createElement("div");
        playBoard.dataset.playEntryBoard = "";
        const playFrame = document.createElement("section");
        playFrame.dataset.playFrame = "";
        playFrame.append(playBoard);
        onArrive.mockImplementation(() => {
          document.body.append(playFrame);
        });
        vi.stubGlobal(
          "DOMMatrixReadOnly",
          class {
            a = 1;
            e = 0;
            f = 0;
          },
        );
        vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
          function measure(this: Element) {
            return this === playBoard ? playBoardRect : risenRect;
          },
        );
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      });

      test("写しの盤面がプレイ画面の盤面にぴったり重なる所へ、着く先を替えること", async () => {
        playZukanPlayEntry({ board, scene, onArrive, onFinished });
        await vi.advanceTimersByTimeAsync(SCENE_FADE_MS + 50);
        const landingKeyframes = animations.at(-1)?.keyframes;

        expect(landingKeyframes?.at(-1)).toEqual({
          transform: "translate(150px, 250px) scale(2)",
        });
      });
    });

    describe("広げ始める位置を測れる場合", () => {
      /** 盤面を描いている枠は、中心 (500, 460)・幅 280 の所にある。 */
      const boardRect = new DOMRect(360, 320, 280, 280);

      /** 写しを広げる動きの、始めの変形。広げ始めていなければ `undefined`。 */
      function readRiseStart(): Keyframe["transform"] {
        return animations.find(
          ({ keyframes }) =>
            typeof keyframes[0]?.transform === "string" &&
            keyframes[0].transform.startsWith("translate("),
        )?.keyframes[0]?.transform;
      }

      beforeEach(() => {
        // 盤面を測れないうちに目指す大きさが 560px、中心が (500, 460) になる画面。
        vi.stubGlobal("innerWidth", 1000);
        vi.stubGlobal("innerHeight", 1000);
        vi.spyOn(board, "getBoundingClientRect").mockReturnValue(boardRect);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      });

      test("すぐに、盤面を描いている枠の位置と大きさから広げること", () => {
        playZukanPlayEntry({ board, scene, onArrive, onFinished });
        const riseStart = readRiseStart();

        expect(riseStart).toBe("translate(0px, 0px) scale(0.5)");
      });
    });

    test("プレイ画面を開く前にやめると、プレイ画面を開かず、写しと覆いを除いて終えたと知らせること", async () => {
      const cancel = playZukanPlayEntry({
        board,
        scene,
        onArrive,
        onFinished,
      });
      vi.advanceTimersByTime(SCENE_FADE_MS - 1);
      cancel();
      await vi.advanceTimersByTimeAsync(SCENE_FADE_MS);

      expect(onArrive).not.toHaveBeenCalled();
      expect(countEntryLayers(scene)).toBe(0);
      expect(board.style.opacity).toBe("");
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    test("プレイ画面を開いたあとにやめても、写しを残し、終えたと知らせないこと", async () => {
      const cancel = playZukanPlayEntry({
        board,
        scene,
        onArrive,
        onFinished,
      });
      vi.advanceTimersByTime(SCENE_FADE_MS);
      cancel();
      await vi.advanceTimersByTimeAsync(0);

      expect(queryRisenBoard(scene)).not.toBeNull();
      expect(onFinished).not.toHaveBeenCalled();
    });
  });
});
