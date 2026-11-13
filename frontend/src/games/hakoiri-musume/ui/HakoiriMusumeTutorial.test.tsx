import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { HakoiriMusumeTutorial } from "@/games/hakoiri-musume/ui/HakoiriMusumeTutorial";

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** 駒の読み上げ名（今いる所）と、その駒を動かす矢印キー。 */
type PieceMove = readonly [label: string, keys: readonly ArrowKey[]];

/** 手順ごとの手。小駒を上へ、続けてまた上へ。横長を上へ動かそうとする（ふさがれる）。娘を右へどかす。 */
const slideStepMove: PieceMove = ["小駒 3行4列", ["ArrowUp"]];
const countStepMove: PieceMove = ["小駒 2行4列", ["ArrowUp"]];
const blockStepMove: PieceMove = ["横長 4行1列", ["ArrowUp"]];
const clearStepMove: PieceMove = ["娘 2行2列", ["ArrowRight"]];
/** 手を離した後、横長を上げ、縦長を左上へ回し、娘を出口の前へ下ろす。 */
const remainingMoves: readonly PieceMove[] = [
  ["横長 4行1列", ["ArrowUp", "ArrowUp", "ArrowUp"]],
  ["縦長 4行3列", ["ArrowLeft", "ArrowUp", "ArrowLeft", "ArrowUp"]],
  ["娘 2行3列", ["ArrowLeft", "ArrowDown", "ArrowDown"]],
];

/** 手順を終えた駒への応えを見届けてから、次の手順の一言と印を出すまでの間。 */
const nextStepCueDelayMs = 700;

/** 終えた手が何を示したかの一言を見せてから、次の手順の一言と印を出すまでの間。 */
const doneMessageDelayMs = 1800;

/** 手を離した後、手が止まってから次に動かす駒を示すまでの間。 */
const idleHintDelayMs = 4000;

/** 導入の場面の動きを見せ終えるのに十分な間。 */
const introEnoughMs = 8000;

const slideHeadline = "この駒を 上へ動かしてみましょう";
const countHeadline = "続けて上へ 動かしましょう";
const countDoneHeadline = "上へ2マスで まとめて1手です";
const slideDoneHeadline = "空いたマスへ すべります";
const blockHeadline = "横長の駒を 上へ動かしてみましょう";
const blockDoneHeadline = "娘にふさがれて 上へ動かせません";
const clearHeadline = "娘を右へ どかしましょう";
const strayHeadline = "左だと、横長の駒の上が 空きません";
const freePlayHeadline = "ここからは自分で 娘を出口の前まで運びましょう";
const hintHeadline = "次はこの駒を 動かしましょう";
const hiddenRule = "まだ出ていないルール";

/** 手順をすべて終えるまで、それぞれの応えを待ちながら進める。 */
function playGuidedSteps(): void {
  moveByKeys(slideStepMove);
  advanceTime(doneMessageDelayMs);
  moveByKeys(countStepMove);
  advanceTime(doneMessageDelayMs);
  moveByKeys(blockStepMove);
  advanceTime(doneMessageDelayMs);
  moveByKeys(clearStepMove);
  advanceTime(nextStepCueDelayMs);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 場面の動きを待たずに「次へ」を続けて押し、ゴールと始まりの盤面を通って最初の手順から始める。 */
function pressNextThroughIntro(): void {
  for (
    let next = screen.queryByRole("button", { name: "次へ" });
    next;
    next = screen.queryByRole("button", { name: "次へ" })
  ) {
    fireEvent.click(next);
  }
}

function pressNextThroughIntroWaitingForScenes(): void {
  for (let press = 0; press < 3; press += 1) {
    advanceTime(introEnoughMs);
    const next = screen.queryByRole("button", { name: "次へ" });
    if (!next) {
      return;
    }
    fireEvent.click(next);
  }
  advanceTime(introEnoughMs);
}

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "箱入り娘盤面" });
}

function queryPiece(label: string): HTMLElement | null {
  return within(getBoard()).queryByRole("button", { name: label });
}

/** 盤面と同じく、駒のボタンに矢印キーを押して1マスずつ動かす。駒が動くと読み上げ名が変わるので、ボタンを押す前に取っておく。 */
function moveByKeys([label, keys]: PieceMove): void {
  const piece = queryPiece(label);
  if (!piece) {
    throw new Error(`駒 ${label} がない`);
  }
  for (const key of keys) {
    fireEvent.keyDown(piece, { key });
  }
}

/** 印や合図を重ねた駒の読み上げ名。 */
function listPiecesWith(selector: string): string[] {
  return Array.from(getBoard().querySelectorAll(selector), (element) =>
    element.closest("button")?.getAttribute("aria-label"),
  ).filter((label): label is string => label !== undefined && label !== null);
}

function getMarkedPieces(): string[] {
  return listPiecesWith('[data-tutorial-cue="mark"]');
}

function getAcknowledgedPieces(): string[] {
  return listPiecesWith('[data-tutorial-cue="acknowledgement"]');
}

function getSpotlitPieces(): string[] {
  return listPiecesWith("[data-tutorial-spotlight]");
}

function queryRecall(): Element | null {
  return getBoard().querySelector('[data-tutorial-cue="recall"]');
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("HakoiriMusumeTutorial", () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    onClose = vi.fn<() => void>();
    playStart = { difficulty: "2", onStart: vi.fn<() => void>() };
  });

  describe("ゲームのホームから開いた場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressNextThroughIntro();
    });

    test("始めの盤面で、最初に動かす小駒に印を付け、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.queryByText(slideHeadline);
      const marked = getMarkedPieces();
      const rules = getRuleTexts();

      expect(headline).not.toBeNull();
      expect(marked).toEqual(["小駒 3行4列"]);
      expect(rules).toEqual(["空いたマスへ動かす", hiddenRule]);
    });

    test("画面全体に覆いを重ね、印の駒と行き先のマスだけを覆いから抜くこと", () => {
      const scrim = getScrim();
      const spotlit = getSpotlitPieces();
      const spotlitCells = Array.from(
        getBoard().querySelectorAll("[data-tutorial-spotlight]"),
      ).filter((spotlight) => spotlight.closest("button") === null).length;

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual(["小駒 3行4列"]);
      expect(spotlitCells).toBe(1);
    });

    test("印の無い駒を動かそうとすると、受け付けずに、一言を変えないまま印の線を濃くし直すこと", () => {
      moveByKeys(["小駒 5行1列", ["ArrowUp"]]);

      const piece = queryPiece("小駒 5行1列");
      const headline = screen.queryByText(slideHeadline);
      const recall = queryRecall();

      expect(piece).not.toBeNull();
      expect(headline).not.toBeNull();
      expect(recall).not.toBeNull();
    });

    test("印の無い駒を押すと、印の線を濃くし直すこと", () => {
      const piece = queryPiece("娘 2行2列");
      if (!piece) {
        throw new Error("娘がない");
      }
      fireEvent.pointerDown(piece);

      const recall = queryRecall();

      expect(recall).not.toBeNull();
    });

    describe("小駒を上へ動かした場合", () => {
      beforeEach(() => {
        moveByKeys(slideStepMove);
      });

      test("少しの間は、終えた一言を出し、動かした駒に応えて覆いから抜いておくこと", () => {
        const headline = screen.queryByText(slideDoneHeadline);
        const acknowledged = getAcknowledgedPieces();
        const marked = getMarkedPieces();

        expect(headline).not.toBeNull();
        expect(acknowledged).toEqual(["小駒 2行4列"]);
        expect(marked).toEqual([]);
      });

      test("待つと、続けて上へ動かす一言と、同じ小駒の印を出すこと", () => {
        advanceTime(doneMessageDelayMs);

        const headline = screen.queryByText(countHeadline);
        const marked = getMarkedPieces();
        const rules = getRuleTexts();

        expect(headline).not.toBeNull();
        expect(marked).toEqual(["小駒 2行4列"]);
        expect(rules).toEqual(["空いたマスへ動かす", hiddenRule]);
      });

      test("待つ間に盤面を押すと、すぐ次の手順の一言と印を出すこと", () => {
        fireEvent.pointerDown(getBoard());

        const headline = screen.queryByText(countHeadline);

        expect(headline).not.toBeNull();
      });

      describe("続けて上へ動かした場合", () => {
        beforeEach(() => {
          advanceTime(nextStepCueDelayMs);
          moveByKeys(countStepMove);
        });

        test("上へ2マスでまとめて1手だと伝えること", () => {
          const headline = screen.queryByText(countDoneHeadline);

          expect(headline).not.toBeNull();
        });

        test("待つと、横長の駒を上へ動かす一言と、横長の印を出し、横長とそれをふさぐ娘を覆いから抜くこと", () => {
          advanceTime(doneMessageDelayMs);

          const headline = screen.queryByText(blockHeadline);
          const marked = getMarkedPieces();
          const spotlit = getSpotlitPieces();

          expect(headline).not.toBeNull();
          expect(marked).toEqual(["横長 4行1列"]);
          expect(spotlit).toEqual(["娘 2行2列", "横長 4行1列"]);
        });

        test("横長を右へ動かそうとしても動かず、一言を変えないまま印の線を濃くし直すこと", () => {
          advanceTime(doneMessageDelayMs);
          moveByKeys(["横長 4行1列", ["ArrowRight"]]);

          const piece = queryPiece("横長 4行1列");
          const headline = screen.queryByText(blockHeadline);
          const recall = queryRecall();

          expect(piece).not.toBeNull();
          expect(headline).not.toBeNull();
          expect(recall).not.toBeNull();
        });

        describe("横長を上へ動かそうとした場合", () => {
          beforeEach(() => {
            advanceTime(doneMessageDelayMs);
            moveByKeys(blockStepMove);
          });

          test("横長を動かさずに、娘がじゃまで動かせないと伝えること", () => {
            const piece = queryPiece("横長 4行1列");
            const headline = screen.queryByText(blockDoneHeadline);

            expect(piece).not.toBeNull();
            expect(headline).not.toBeNull();
          });

          test("待つと、娘を右へどかす一言と娘だけの印を出し、娘と決め手の横長を覆いから抜くこと", () => {
            advanceTime(doneMessageDelayMs);

            const headline = screen.queryByText(clearHeadline);
            const marked = getMarkedPieces();
            const spotlit = getSpotlitPieces();

            expect(headline).not.toBeNull();
            expect(marked).toEqual(["娘 2行2列"]);
            expect(spotlit).toEqual(["娘 2行2列", "横長 4行1列"]);
          });

          test("娘を左へどかすと、そこでは横長が上へ動かせないわけを言うこと", () => {
            advanceTime(doneMessageDelayMs);
            moveByKeys(["娘 2行2列", ["ArrowLeft"]]);

            const headline = screen.queryByText(strayHeadline);

            expect(headline).not.toBeNull();
          });
        });
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        playGuidedSteps();
      });

      test("残りを解くことを伝え、すべてのルールを見せ、覆いを外し、手が止まるまで印を出さないこと", () => {
        const headline = screen.queryByText(freePlayHeadline);
        const rules = getRuleTexts();
        const scrim = getScrim();
        const marked = getMarkedPieces();

        expect(headline).not.toBeNull();
        expect(rules).toEqual(["空いたマスへ動かす", "通り抜けられない"]);
        expect(scrim).toBeNull();
        expect(marked).toEqual([]);
      });

      test("手が止まると、娘ではない次に動かす駒を1つ示し、その駒を動かすよう促すこと", () => {
        advanceTime(idleHintDelayMs);

        const marked = getMarkedPieces();
        const headline = screen.queryByText(hintHeadline);

        expect(marked).toHaveLength(1);
        expect(marked[0]).not.toMatch(/^娘/);
        expect(headline).not.toBeNull();
      });

      describe("解き終えた場合", () => {
        beforeEach(() => {
          for (const move of remainingMoves) {
            moveByKeys(move);
          }
        });

        test("抜け切ると、手数を入れずに完成と、少ない手数で速く解くほど点が上がることを伝えること", () => {
          advanceTime(introEnoughMs);

          const headline = screen.queryByText("完成です");
          const detail = screen.queryByText(
            "少ない手数で速く解くほど 点が上がります",
          );

          expect(headline).not.toBeNull();
          expect(detail).not.toBeNull();
        });

        test("ゲームのホームで開いているレベルを遊ぶ操作で、そのレベルを始めること", () => {
          advanceTime(introEnoughMs);
          fireEvent.click(
            screen.getByRole("button", { name: "レベル 2を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        describe("もう一度で導入を終えた場合", () => {
          beforeEach(() => {
            advanceTime(introEnoughMs);
            fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
            pressNextThroughIntroWaitingForScenes();
          });

          test("始めの盤面に戻し、最初の手順から始めること", () => {
            const daughter = queryPiece("娘 2行2列");
            const marked = getMarkedPieces();
            const rules = getRuleTexts();

            expect(daughter).not.toBeNull();
            expect(marked).toEqual(["小駒 3行4列"]);
            expect(rules).toEqual(["空いたマスへ動かす", hiddenRule]);
          });
        });
      });
    });
  });

  describe("プレイ中のメニューから開いて解き終えた場合", () => {
    beforeEach(() => {
      render(<HakoiriMusumeTutorial open={true} onClose={onClose} />);
      pressNextThroughIntro();
      playGuidedSteps();
      for (const move of remainingMoves) {
        moveByKeys(move);
      }
      advanceTime(introEnoughMs);
    });

    test("ホームと同じく、手数が少なく速いほど点が上がることを伝えること", () => {
      const detail = screen.queryByText(
        "少ない手数で速く解くほど 点が上がります",
      );

      expect(detail).not.toBeNull();
    });

    test("プレイに戻る操作で閉じること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      render(
        <HakoiriMusumeTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、何をするパズルかと、娘が出口の前に着いたゴールの盤面を、娘に印を付けて見せること", () => {
      const purpose = screen.queryByText("娘を出口の前まで 運ぶパズルです");
      const caption = screen.queryByText("ここまで運べば完成です");
      const marked = getMarkedPieces();

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(marked).toEqual(["娘 4行2列"]);
    });
  });
});
