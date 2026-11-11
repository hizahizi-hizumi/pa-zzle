import {
  _private,
  playZukanPlayEntry,
  ZUKAN_MAX_CANDIDATE_PIECE_COUNT,
} from "@/zukan/ui/GameHomeScreen/zukan-play-entry";

const {
  PLAY_ENTRY_ATTRIBUTE,
  SCENE_FADE_MS,
  PIECE_LIFT_MS,
  CANDIDATE_INTERVAL_MS,
} = _private;

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
      /** 持ち上がったピースは、中心 (128, 228)・幅 56 の所にある。 */
      const pieceRect = new DOMRect(100, 200, 56, 56);
      let piece: HTMLElement;

      /** 写しを広げる動きの、始めの変形。広げ始めていなければ `undefined`。 */
      function readRiseStart(): Keyframe["transform"] {
        return animations.find(
          ({ keyframes }) =>
            typeof keyframes[0]?.transform === "string" &&
            keyframes[0].transform.startsWith("translate("),
        )?.keyframes[0]?.transform;
      }

      /** 渡した要素を動かした数。 */
      function countAnimationsOf(element: Element): number {
        return vi
          .mocked(Element.prototype.animate)
          .mock.contexts.filter((context) => context === element).length;
      }

      beforeEach(() => {
        // 盤面を測れないうちに目指す大きさが 560px、中心が (500, 460) になる画面。
        vi.stubGlobal("innerWidth", 1000);
        vi.stubGlobal("innerHeight", 1000);
        vi.spyOn(board, "getBoundingClientRect").mockReturnValue(boardRect);
        piece = document.createElement("button");
        scene.append(piece);
        vi.spyOn(piece, "getBoundingClientRect").mockReturnValue(pieceRect);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      });

      test("fromPiece を渡さなければ、ピースを動かさず、すぐに盤面を描いている枠の位置と大きさから広げること", () => {
        playZukanPlayEntry({ board, scene, onArrive, onFinished });
        const riseStart = readRiseStart();

        expect(riseStart).toBe("translate(0px, 0px) scale(0.5)");
        expect(countAnimationsOf(piece)).toBe(0);
      });

      describe("fromPiece を渡した場合", () => {
        function playFromPiece(): () => void {
          return playZukanPlayEntry({
            board,
            fromPiece: piece,
            scene,
            onArrive,
            onFinished,
          });
        }

        test("まずピースを持ち上げ、持ち上げ終えるまでは盤面を広げないこと", () => {
          playFromPiece();
          vi.advanceTimersByTime(PIECE_LIFT_MS - 1);
          const riseStart = readRiseStart();

          expect(countAnimationsOf(piece)).toBe(1);
          expect(riseStart).toBeUndefined();
          expect(onArrive).not.toHaveBeenCalled();
        });

        test("持ち上げ終えたら、盤面を描いている枠ではなく、持ち上がったピースの位置と大きさから広げること", () => {
          playFromPiece();
          vi.advanceTimersByTime(PIECE_LIFT_MS);
          const riseStart = readRiseStart();

          expect(riseStart).toBe("translate(-372px, -232px) scale(0.1)");
        });

        test("広げ始めてから、ゲームのホームの中身が薄れたら一度だけプレイ画面を開くこと", () => {
          playFromPiece();
          vi.advanceTimersByTime(PIECE_LIFT_MS + SCENE_FADE_MS - 1);
          const arrivedBefore = onArrive.mock.calls.length;
          vi.advanceTimersByTime(1);

          expect(arrivedBefore).toBe(0);
          expect(onArrive).toHaveBeenCalledTimes(1);
        });

        test("持ち上げている間にやめると、プレイ画面を開かず、ピースを戻して終えたと知らせること", async () => {
          const cancel = playFromPiece();
          vi.advanceTimersByTime(PIECE_LIFT_MS - 1);
          cancel();
          await vi.advanceTimersByTimeAsync(PIECE_LIFT_MS + SCENE_FADE_MS);
          const pieceLift = animations[0]?.animation;

          expect(onArrive).not.toHaveBeenCalled();
          expect(pieceLift?.cancel).toHaveBeenCalled();
          expect(countEntryLayers(scene)).toBe(0);
          expect(onFinished).toHaveBeenCalledTimes(1);
        });
      });

      describe("fromPiece と、それより多くの候補のピースを渡した場合", () => {
        let candidates: HTMLElement[];
        /** 候補を光らせ終えて、選んだピースを持ち上げ始めるまでの時間。 */
        const liftDelayMs =
          ZUKAN_MAX_CANDIDATE_PIECE_COUNT * CANDIDATE_INTERVAL_MS;

        /** 渡した要素に掛けた動きの設定。 */
        function readAnimationOptions(
          element: Element,
        ): KeyframeAnimationOptions | undefined {
          const animate = vi.mocked(Element.prototype.animate);
          return animate.mock.calls[
            animate.mock.contexts.indexOf(element)
          ]?.[1] as KeyframeAnimationOptions | undefined;
        }

        beforeEach(() => {
          candidates = Array.from(
            { length: ZUKAN_MAX_CANDIDATE_PIECE_COUNT + 2 },
            () => document.createElement("button"),
          );
          scene.append(...candidates);
        });

        function playWithCandidates(): () => void {
          return playZukanPlayEntry({
            board,
            fromPiece: piece,
            candidatePieces: candidates,
            scene,
            onArrive,
            onFinished,
          });
        }

        test("上限の数までの候補を、渡した順に間を空けて光らせ、余った候補は光らせないこと", () => {
          playWithCandidates();
          const delays = candidates.map(
            (candidate) => readAnimationOptions(candidate)?.delay,
          );

          expect(delays).toEqual([
            ...Array.from(
              { length: ZUKAN_MAX_CANDIDATE_PIECE_COUNT },
              (_, order) => order * CANDIDATE_INTERVAL_MS,
            ),
            undefined,
            undefined,
          ]);
        });

        test("候補を光らせ終えてから、選んだピースを持ち上げること", () => {
          playWithCandidates();
          const liftOptions = readAnimationOptions(piece);

          expect(liftOptions?.delay).toBe(liftDelayMs);
        });

        test("ピースを持ち上げ終えてから盤面を広げ、候補を光らせ始めてから 450ms 以内に広げ始めること", () => {
          playWithCandidates();
          vi.advanceTimersByTime(liftDelayMs + PIECE_LIFT_MS - 1);
          const riseBefore = readRiseStart();
          vi.advanceTimersByTime(1);
          const riseAt = readRiseStart();

          expect(riseBefore).toBeUndefined();
          expect(riseAt).toBeDefined();
          expect(liftDelayMs + PIECE_LIFT_MS).toBeLessThanOrEqual(450);
        });

        test("光らせている間にやめると、候補の光をすべて止めること", () => {
          const cancel = playWithCandidates();
          cancel();
          const glows = animations
            .filter(({ keyframes }) => keyframes.length === 3)
            .map(({ animation }) => animation.cancel);

          expect(glows).toHaveLength(ZUKAN_MAX_CANDIDATE_PIECE_COUNT);
          for (const glowCancel of glows) {
            expect(glowCancel).toHaveBeenCalled();
          }
        });
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
