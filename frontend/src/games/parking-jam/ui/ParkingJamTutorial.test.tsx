import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";

const vehicleLabels = {
  a: "横向きの車 行4 列4",
  b: "横向きの車 行6 列2",
  c: "横向きの車 行5 列1",
  d: "縦向きの車 行1 列2",
  e: "横向きの車 行2 列5",
  f: "横向きの車 行1 列5",
  g: "横向きの車 行3 列1",
  h: "横向きの車 行3 列4",
} as const;

type VehicleId = keyof typeof vehicleLabels;

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const stepMoves = [
  ["a", "ArrowRight"],
  ["b", "ArrowRight"],
  ["c", "ArrowLeft"],
  ["d", "ArrowUp"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

const remainingMoves = [
  ["e", "ArrowLeft"],
  ["f", "ArrowLeft"],
  ["g", "ArrowLeft"],
  ["h", "ArrowLeft"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

const exitStepHoldMs = 700;

const longIdleMs = 10000;

const introEnoughMs = 8000;

const firstHeadline = "車を出したい向きへ スワイプします";
const roadHeadline = "道路につながる向きへ出します";
const planterHeadline = "植え込みにはぶつかります 植え込みのない向きへ出します";
const carHeadline =
  "植え込みだけでなくほかの車にもぶつかります ぶつかる車を先に出します";
const freePlayHeadline = "残りの車も出してみましょう";
const noRoadHeadline = "この先は道路につながっていません";
const oppositeDetail = "反対の向きへ出します";
const clearTheWayText = "左の車を先に出します";
const hintHeadline = "この車を先に出します";
const missNotice = "これからは出られない向きへ 動かすとミスになります";
const freePlayDetail = "本番は出られない向きへ 動かすとミスになります";
const goalCaption = "駐車場を空にすると完成です";
const recapLabels = [
  "車は前か後ろへ出します",
  "道路につながる向きへ出します",
  "植え込みのない向きへ出します",
  "ぶつかる車を先に出します",
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: PARKING_JAM_DISPLAY_NAME });
}

function queryStartButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "はじめる" });
}

function pressStart(): void {
  fireEvent.click(
    within(getScreen()).getByRole("button", { name: "はじめる" }),
  );
  advanceTime(0);
}

function queryVehicle(vehicleId: VehicleId): HTMLElement | null {
  return within(screen.getByRole("main")).queryByRole("button", {
    name: vehicleLabels[vehicleId],
  });
}

function moveVehicles(
  moves: readonly (readonly [VehicleId, ArrowKey])[],
  holdMs = 0,
): void {
  for (const [vehicleId, key] of moves) {
    const vehicle = queryVehicle(vehicleId);
    if (!vehicle) {
      throw new Error(`車 ${vehicleId} がない`);
    }
    fireEvent.keyDown(vehicle, { key });
    advanceTime(holdMs);
  }
}

function getCuedVehicles(): string[] {
  return Array.from(
    screen.getByRole("main").querySelectorAll("[data-vehicle-mark]"),
    (mark) => mark.getAttribute("data-vehicle-mark") ?? "",
  );
}

function getPointerSwipe(): string | null {
  const pointer = screen
    .getByRole("main")
    .querySelector('[data-tutorial-cue="pointer"]');
  if (!pointer) {
    throw new Error("指がない");
  }
  return pointer.getAttribute("data-swipe");
}

function queryRecall(): Element | null {
  return screen.getByRole("main").querySelector('[data-tutorial-cue="recall"]');
}

function getSpotlitTargets(): string[] {
  return Array.from(
    screen.getByRole("main").querySelectorAll("[data-spotlight-target]"),
    (placement) => placement.getAttribute("data-spotlight-target") ?? "",
  );
}

function queryHintButton(): HTMLElement | null {
  return within(getScreen()).queryByRole("button", { name: "ヒント" });
}

function querySpotlightArea(): Element | null {
  return screen
    .getByRole("main")
    .querySelector("[data-tutorial-spotlight-area]");
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function getProgressValue(): string | null {
  return within(getScreen())
    .getByRole("progressbar", { name: "チュートリアルの進み具合" })
    .getAttribute("aria-valuenow");
}

function getRecapTexts(): string[] {
  return within(within(getScreen()).getByRole("list", { name: "覚えたルール" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("ParkingJamTutorial", () => {
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
        <ParkingJamTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
      pressStart();
    });

    test("車の停まった始めの盤面で、最初に動かす車を、手前の道路へ滑る指で示し、進み具合を0にしておくこと", () => {
      const headline = screen.queryByText(firstHeadline);
      const vehicle = queryVehicle("a");
      const cued = getCuedVehicles();
      const swipe = getPointerSwipe();
      const progress = getProgressValue();

      expect(headline).not.toBeNull();
      expect(vehicle).not.toBeNull();
      expect(cued).toEqual(["a"]);
      expect(swipe).toBe("right");
      expect(progress).toBe("0");
    });

    test("操作を教える手順には決め手が無いので、盤面を覆わないこと", () => {
      const scrim = getScrim();
      const area = querySpotlightArea();
      const spotlit = getSpotlitTargets();

      expect(scrim).toBeNull();
      expect(area).toBeNull();
      expect(spotlit).toEqual([]);
    });

    test("手を引いている間は、ヒントを出さないこと", () => {
      const hintButton = queryHintButton();

      expect(hintButton).toBeNull();
    });

    test("印の無い車を動かすと、受け付けずに、一言を変えないまま印の線を濃くし直すこと", () => {
      moveVehicles([["g", "ArrowLeft"]]);

      const vehicle = queryVehicle("g");
      const headline = screen.queryByText(firstHeadline);
      const recall = queryRecall();
      const cued = getCuedVehicles();

      expect(vehicle?.getAttribute("class")).not.toContain(
        "parking-jam-car--exit",
      );
      expect(headline).not.toBeNull();
      expect(recall).not.toBeNull();
      expect(cued).toEqual(["a"]);
    });

    test("印の無い車を続けて触るたびに、印の線を濃くし直すこと", () => {
      moveVehicles([["g", "ArrowLeft"]]);
      const firstRecall = queryRecall();
      moveVehicles([["c", "ArrowLeft"]]);

      const secondRecall = queryRecall();

      expect(firstRecall).not.toBeNull();
      expect(secondRecall).not.toBeNull();
      expect(secondRecall).not.toBe(firstRecall);
    });

    describe("最初の手順の車を出した場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 1));
      });

      test("出ていく間は、前の一言のまま印を消しておくこと", () => {
        const headline = screen.queryByText(firstHeadline);
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual([]);
      });

      test("出ていく間は、次の手順の車を動かしても受け付けないこと", () => {
        moveVehicles([["b", "ArrowRight"]]);

        const vehicle = queryVehicle("b");
        const headline = screen.queryByText(firstHeadline);

        expect(vehicle?.getAttribute("class")).not.toContain(
          "parking-jam-car--exit",
        );
        expect(headline).not.toBeNull();
      });

      test("出した車の分だけ進み具合を進めること", () => {
        const progress = getProgressValue();

        expect(progress).toBe("13");
      });

      test("出ていき終えると、次のルールの一言と、道路のある向きへ滑る指を出し、盤面の中を覆って、印の車とその手を決める縁石を残すこと", () => {
        advanceTime(exitStepHoldMs);

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();
        const swipe = getPointerSwipe();
        const area = querySpotlightArea();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["b"]);
        expect(swipe).toBe("right");
        expect(area).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-b", "curb-left"]);
      });
    });

    describe("道路のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 1), exitStepHoldMs);
      });

      test("進む先に道路がない向きへ動かすと、出さずに、本番と同じく揺らして、道路がないことと反対の向きへ出すことを言うこと", () => {
        moveVehicles([["b", "ArrowLeft"]]);

        const vehicle = queryVehicle("b");
        const headline = screen.queryByText(noRoadHeadline);
        const detail = screen.queryByText(oppositeDetail);
        const cued = getCuedVehicles();

        expect(vehicle?.getAttribute("class")).toContain(
          "parking-jam-car--blocked-left",
        );
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(cued).toEqual(["b"]);
      });

      test("道路のある向きへ出すと、次のルールの一言と、植え込みのない向きへ滑る指へ進み、印の車とその手を決める植え込みを残すこと", () => {
        moveVehicles([["b", "ArrowRight"]], exitStepHoldMs);

        const headline = screen.queryByText(planterHeadline);
        const cued = getCuedVehicles();
        const swipe = getPointerSwipe();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["c"]);
        expect(swipe).toBe("left");
        expect(spotlit).toEqual(["vehicle-c", "fixed-area-4-4"]);
      });
    });

    describe("植え込みのルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 2), exitStepHoldMs);
      });

      test("植え込みへ動かすと、植え込みにぶつかったことを言い、残す物を変えないこと", () => {
        moveVehicles([["c", "ArrowRight"]]);

        const headline = screen.queryByText("植え込みにぶつかりました");
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-c", "fixed-area-4-4"]);
      });
    });

    describe("ほかの車のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 3), exitStepHoldMs);
      });

      test("塞いでいる車に印と上へ滑る指を付け、その車と、塞がれた車と、印の車が下へ出るとぶつかる車を残すこと", () => {
        const headline = screen.queryByText(carHeadline);
        const cued = getCuedVehicles();
        const swipe = getPointerSwipe();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["d"]);
        expect(swipe).toBe("up");
        expect(spotlit).toEqual(["vehicle-d", "vehicle-e", "vehicle-g"]);
      });

      test("ほかの車がある向きへ動かすと、ほかの車にぶつかったことを言い、ぶつかった車も残すこと", () => {
        moveVehicles([["d", "ArrowDown"]]);

        const headline = screen.queryByText("ほかの車にぶつかりました");
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-d", "vehicle-e", "vehicle-g"]);
      });

      describe("塞いでいる車を出した場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(3));
        });

        test("出ていく間は、塞がれていた車を動かしても受け付けず、手順の一言と覆いのままにすること", () => {
          moveVehicles([["e", "ArrowLeft"]]);

          const vehicle = queryVehicle("e");
          const headline = screen.queryByText(carHeadline);
          const scrim = getScrim();

          expect(vehicle?.getAttribute("class")).not.toContain(
            "parking-jam-car--exit",
          );
          expect(headline).not.toBeNull();
          expect(scrim).not.toBeNull();
        });
      });

      test("塞いでいる車を出すと、出ていき終えてから手を離し、覆いを外すこと", () => {
        moveVehicles(stepMoves.slice(3), exitStepHoldMs);

        const headline = screen.queryByText(freePlayHeadline);
        const scrim = getScrim();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(scrim).toBeNull();
        expect(spotlit).toEqual([]);
      });
    });

    describe("手順を終えた場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, exitStepHoldMs);
      });

      test("残りを出すことと、本番では出られない向きへ動かすとミスになることを伝え、ヒントを出せるようにすること", () => {
        const headline = screen.queryByText(freePlayHeadline);
        const detail = screen.queryByText(freePlayDetail);
        const hintButton = queryHintButton();

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(hintButton).not.toBeNull();
      });

      test("手が止まっても、ヒントを押すまで印を出さないこと", () => {
        advanceTime(longIdleMs);

        const cued = getCuedVehicles();
        const spotlit = getSpotlitTargets();

        expect(cued).toEqual([]);
        expect(spotlit).toEqual([]);
      });

      describe("ヒントを押した場合", () => {
        beforeEach(() => {
          const hintButton = queryHintButton();
          if (!hintButton) {
            throw new Error("ヒントがない");
          }
          fireEvent.click(hintButton);
        });

        test("塞いでいる車を、向きを示さずに押す指で示し、その車と塞がれた車を残して、先に出すことを言うこと", () => {
          const cued = getCuedVehicles();
          const swipe = getPointerSwipe();
          const spotlit = getSpotlitTargets();
          const headline = screen.queryByText(hintHeadline);
          const hintButton = queryHintButton();

          expect(cued).toEqual(["g"]);
          expect(swipe).toBeNull();
          expect(spotlit).toEqual(["vehicle-g", "vehicle-h"]);
          expect(headline).not.toBeNull();
          expect(hintButton).toBeNull();
        });

        test("次の手で、手がかりを消すこと", () => {
          moveVehicles([["e", "ArrowLeft"]]);

          const cued = getCuedVehicles();
          const spotlit = getSpotlitTargets();
          const headline = screen.queryByText(freePlayHeadline);

          expect(cued).toEqual([]);
          expect(spotlit).toEqual([]);
          expect(headline).not.toBeNull();
        });
      });

      test("ほかの車がある向きへ動かすと、本番と同じく揺らし、ぶつかったものと、ぶつかる車を先に出すことを言うこと", () => {
        moveVehicles([["h", "ArrowLeft"]]);

        const vehicle = queryVehicle("h");
        const headline = screen.queryByText("ほかの車にぶつかりました");
        const detail = screen.queryByText(clearTheWayText);
        const spotlit = getSpotlitTargets();

        expect(vehicle?.getAttribute("class")).toContain(
          "parking-jam-car--blocked-left",
        );
        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-h", "vehicle-g"]);
      });

      test("同じ側のほかの車線には道路がある向きへ動かすと、本番と同じく道路がないことを伝えること", () => {
        moveVehicles([["e", "ArrowRight"]]);

        const headline = screen.queryByText(noRoadHeadline);
        const detail = screen.queryByText(oppositeDetail);

        expect(headline).not.toBeNull();
        expect(detail).not.toBeNull();
      });

      describe("すべて出した場合", () => {
        beforeEach(() => {
          moveVehicles(remainingMoves);
          advanceTime(0);
        });

        test("ミスの数え方を伝え、覚えたルールを並べ、進み具合を満たすこと", () => {
          const detail = screen.queryByText(missNotice);
          const recap = getRecapTexts();
          const progress = getProgressValue();

          expect(detail).not.toBeNull();
          expect(recap).toEqual(recapLabels);
          expect(progress).toBe("100");
        });

        test("ゲームのホームで開いているレベルを遊ぶ操作で、そのレベルを始めること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル 2を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度を押すと、入口を通さずに、始めの盤面で最初の手順から始めること", () => {
          fireEvent.click(
            within(getScreen()).getByRole("button", { name: "もう一度" }),
          );
          advanceTime(0);

          const headline = screen.queryByText(firstHeadline);
          const startButton = queryStartButton();
          const vehicle = queryVehicle("h");
          const cued = getCuedVehicles();
          const progress = getProgressValue();

          expect(headline).not.toBeNull();
          expect(startButton).toBeNull();
          expect(vehicle).not.toBeNull();
          expect(cued).toEqual(["a"]);
          expect(progress).toBe("0");
        });
      });
    });
  });

  describe("入口を見せる場合", () => {
    beforeEach(() => {
      render(
        <ParkingJamTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、何をするパズルかと、車を出していく前の駐車場を、ゴールの一言と一緒に見せ、進み具合を0にしておくこと", () => {
      const purpose = screen.queryByText(
        "駐車場の車を すべて道路へ出すパズルです",
      );
      const caption = screen.queryByText(goalCaption);
      const vehicle = queryVehicle("a");
      const progress = getProgressValue();

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(vehicle).not.toBeNull();
      expect(progress).toBe("0");
    });

    test("待つと、車をすべて出し終えた空の駐車場を見せ、はじめるを待つこと", () => {
      advanceTime(introEnoughMs);

      const vehicle = queryVehicle("a");
      const startButton = queryStartButton();

      expect(vehicle).toBeNull();
      expect(startButton).not.toBeNull();
    });

    test("車を押しても、手順へ飛ばずに、ゴールの一言のまま、はじめるを待つこと", () => {
      const vehicleBeforePress = queryVehicle("a");
      if (!vehicleBeforePress) {
        throw new Error("車 a がない");
      }
      fireEvent.pointerDown(vehicleBeforePress);

      const caption = screen.queryByText(goalCaption);
      const startButton = queryStartButton();
      const cued = getCuedVehicles();

      expect(caption).not.toBeNull();
      expect(startButton).not.toBeNull();
      expect(cued).toEqual([]);
    });
  });

  describe("動きを減らす設定で開いた場合", () => {
    beforeEach(() => {
      stubReducedMotion();
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
    });

    test("最初の画面で、何をするパズルかと、空の駐車場を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.queryByText(
        "駐車場の車を すべて道路へ出すパズルです",
      );
      const caption = screen.queryByText(goalCaption);
      const vehicle = queryVehicle("a");

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(vehicle).toBeNull();
    });

    test("はじめるを押すと、動きを待たずに、車の停まった始めの盤面で最初の手順から始めること", () => {
      pressStart();

      const headline = screen.queryByText(firstHeadline);
      const vehicle = queryVehicle("a");
      const cued = getCuedVehicles();

      expect(headline).not.toBeNull();
      expect(vehicle).not.toBeNull();
      expect(cued).toEqual(["a"]);
    });

    describe("始めた場合", () => {
      beforeEach(() => {
        pressStart();
      });

      test("印の車を出すと、待たずに次のルールの一言と印を出すこと", () => {
        moveVehicles(stepMoves.slice(0, 1));

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["b"]);
      });

      describe("道路のルールの手順の場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(0, 1));
        });

        test("進む先に道路がない向きへ動かすと、揺れが見えなくても、手順の見出しから、進む先に道路がないことを言う一言に替えること", () => {
          const headlineBefore = screen.queryByText(roadHeadline);
          moveVehicles([["b", "ArrowLeft"]]);

          const vehicle = queryVehicle("b");
          const stepHeadline = screen.queryByText(roadHeadline);
          const violation = screen.queryByText(noRoadHeadline);

          expect(headlineBefore).not.toBeNull();
          expect(vehicle).not.toBeNull();
          expect(stepHeadline).toBeNull();
          expect(violation).not.toBeNull();
        });
      });

      describe("植え込みのルールの手順の場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(0, 2));
        });

        test("植え込みへ動かすと、揺れが見えなくても、手順の見出しから、植え込みにぶつかったことを言う一言に替えること", () => {
          const headlineBefore = screen.queryByText(planterHeadline);
          moveVehicles([["c", "ArrowRight"]]);

          const vehicle = queryVehicle("c");
          const stepHeadline = screen.queryByText(planterHeadline);
          const violation = screen.queryByText("植え込みにぶつかりました");

          expect(headlineBefore).not.toBeNull();
          expect(vehicle).not.toBeNull();
          expect(stepHeadline).toBeNull();
          expect(violation).not.toBeNull();
        });
      });
    });
  });

  describe("プレイ中に開いた場合", () => {
    beforeEach(() => {
      render(<ParkingJamTutorial open={true} onClose={onClose} />);
      pressStart();
    });

    describe("すべて出した場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, exitStepHoldMs);
        moveVehicles(remainingMoves);
        advanceTime(0);
      });

      test("ミスの数え方を伝えること", () => {
        const detail = screen.queryByText(missNotice);

        expect(detail).not.toBeNull();
      });

      test("プレイに戻る操作で閉じること", () => {
        fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

        expect(onClose).toHaveBeenCalledOnce();
      });
    });
  });
});
