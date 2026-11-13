import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { ParkingJamTutorial } from "@/games/parking-jam/ui/ParkingJamTutorial";

const vehicleLabels = {
  a: "横向きの車 行2 列4",
  b: "横向きの車 行3 列1",
  c: "縦向きの車 行1 列2",
  d: "横向きの車 行4 列1",
  e: "縦向きの車 行4 列3",
  f: "横向きの車 行4 列4",
  g: "横向きの車 行5 列4",
} as const;

type VehicleId = keyof typeof vehicleLabels;

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

const stepMoves = [
  ["e", "ArrowUp"],
  ["g", "ArrowRight"],
  ["b", "ArrowLeft"],
  ["c", "ArrowUp"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

const remainingMoves = [
  ["a", "ArrowLeft"],
  ["f", "ArrowRight"],
  ["d", "ArrowRight"],
] as const satisfies readonly (readonly [VehicleId, ArrowKey])[];

const exitStepHoldMs = 700;

const idleHintDelayMs = 4000;

const introEnoughMs = 8000;

const firstHeadline = "車を出したい向きへ スワイプします";
const roadHeadline = "進む先に道路がないと 出られません";
const planterHeadline = "植え込みがあると 通れません";
const carHeadline = "ほかの車があると 通れません";
const freePlayHeadline = "残りの車も出すと完成です";
const hiddenRule = "まだ出ていないルール";

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

function pressNext(): void {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
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

function pressNextThroughIntro(): void {
  for (
    let next = screen.queryByRole("button", { name: "次へ" });
    next;
    next = screen.queryByRole("button", { name: "次へ" })
  ) {
    fireEvent.click(next);
  }
}

function queryVehicle(vehicleId: VehicleId): HTMLElement | null {
  return within(screen.getByRole("main")).queryByRole("button", {
    name: vehicleLabels[vehicleId],
  });
}

/** 導入で出ていく姿だけを見せる車は押せる車として読ませないので、描いた車の絵で数える。 */
function getDrawnCars(): Element[] {
  return [...screen.getByRole("main").querySelectorAll(".parking-jam-car")];
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

/** 印の線を短く濃くしている合図。濃くし直すたびに、別の要素に替わる。 */
function queryRecall(): Element | null {
  return screen.getByRole("main").querySelector('[data-tutorial-cue="recall"]');
}

function getSpotlitTargets(): string[] {
  return Array.from(
    screen.getByRole("main").querySelectorAll("[data-spotlight-target]"),
    (placement) => placement.getAttribute("data-spotlight-target") ?? "",
  );
}

function getScrim(): Element | null {
  return document.querySelector("[data-tutorial-focus-scrim]");
}

function getRuleTexts(): string[] {
  return within(screen.getByRole("list", { name: "ルール" }))
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
      pressNextThroughIntro();
    });

    test("車の停まった始めの盤面で、最初に動かす車を示し、まだ示していないルールを伏せておくこと", () => {
      const headline = screen.queryByText(firstHeadline);
      const vehicle = queryVehicle("e");
      const cued = getCuedVehicles();
      const rules = getRuleTexts();

      expect(headline).not.toBeNull();
      expect(vehicle).not.toBeNull();
      expect(cued).toEqual(["e"]);
      expect(rules).toEqual(["前か後ろへ", hiddenRule, hiddenRule, hiddenRule]);
    });

    test("画面全体に覆いを重ね、印の車だけを覆いから抜くこと", () => {
      const scrim = getScrim();
      const spotlit = getSpotlitTargets();

      expect(scrim).not.toBeNull();
      expect(spotlit).toEqual(["vehicle-e"]);
    });

    test("印の無い車を動かすと、受け付けずに、一言を変えないまま印の線を濃くし直すこと", () => {
      moveVehicles([["g", "ArrowRight"]]);

      const vehicle = queryVehicle("g");
      const headline = screen.queryByText(firstHeadline);
      const recall = queryRecall();
      const cued = getCuedVehicles();

      expect(vehicle).not.toBeNull();
      expect(headline).not.toBeNull();
      expect(recall).not.toBeNull();
      expect(cued).toEqual(["e"]);
    });

    test("印の無い車を続けて触るたびに、印の線を濃くし直すこと", () => {
      moveVehicles([["g", "ArrowRight"]]);
      const firstRecall = queryRecall();
      moveVehicles([["d", "ArrowRight"]]);

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
        moveVehicles([["g", "ArrowRight"]]);

        const vehicle = queryVehicle("g");
        const headline = screen.queryByText(firstHeadline);

        expect(vehicle?.getAttribute("class")).not.toContain(
          "parking-jam-car--exit",
        );
        expect(headline).not.toBeNull();
      });

      test("出ていく間は、出した車を覆いから抜いたままにすること", () => {
        const spotlit = getSpotlitTargets();

        expect(spotlit).toEqual(["vehicle-e"]);
      });

      test("出ていき終えると、次のルールの一言と印を出し、印の車とその手を決める縁石を覆いから抜くこと", () => {
        advanceTime(exitStepHoldMs);

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();
        const spotlit = getSpotlitTargets();
        const rules = getRuleTexts();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["g"]);
        expect(spotlit).toEqual(["vehicle-g", "curb-left"]);
        expect(rules).toEqual([
          "前か後ろへ",
          "道路へ出る",
          hiddenRule,
          hiddenRule,
        ]);
      });
    });

    describe("道路のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 1), exitStepHoldMs);
      });

      test("進む先に道路がない向きへ動かすと、出さずに、本番と同じく揺らして、進む先に道路がないことを言うこと", () => {
        moveVehicles([["g", "ArrowLeft"]]);

        const vehicle = queryVehicle("g");
        const headline = screen.queryByText(
          "左へ進む先に道路がないので 出られません",
        );
        const cued = getCuedVehicles();

        expect(vehicle?.getAttribute("class")).toContain(
          "parking-jam-car--blocked-left",
        );
        expect(headline).not.toBeNull();
        expect(cued).toEqual(["g"]);
      });

      test("道路のある向きへ出すと、次のルールの一言と印へ進み、印の車とその手を決める植え込みを覆いから抜くこと", () => {
        moveVehicles([["g", "ArrowRight"]], exitStepHoldMs);

        const headline = screen.queryByText(planterHeadline);
        const cued = getCuedVehicles();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["b"]);
        expect(spotlit).toEqual(["vehicle-b", "fixed-area-2-4"]);
      });
    });

    describe("植え込みのルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 2), exitStepHoldMs);
      });

      test("植え込みへ動かすと、動かした向きに植え込みがあることを言い、覆いから抜く物を変えないこと", () => {
        moveVehicles([["b", "ArrowRight"]]);

        const headline = screen.queryByText(
          "右に植え込みがあるので 通れません",
        );
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-b", "fixed-area-2-4"]);
      });
    });

    describe("ほかの車のルールの手順の場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves.slice(0, 3), exitStepHoldMs);
      });

      test("塞いでいる車に印を付け、その車と、塞がれた車を覆いから抜くこと", () => {
        const headline = screen.queryByText(carHeadline);
        const cued = getCuedVehicles();
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["c"]);
        expect(spotlit).toEqual(["vehicle-c", "vehicle-a"]);
      });

      test("ほかの車がある向きへ動かすと、動かした向きにほかの車があることを言い、当たった車も覆いから抜くこと", () => {
        moveVehicles([["c", "ArrowDown"]]);

        const headline = screen.queryByText(
          "下にほかの車があるので 通れません",
        );
        const spotlit = getSpotlitTargets();

        expect(headline).not.toBeNull();
        expect(spotlit).toEqual(["vehicle-c", "vehicle-a", "vehicle-d"]);
      });

      describe("塞いでいる車を出した場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(3));
        });

        test("出ていく間は、塞がれていた車を動かしても受け付けず、手順の一言と覆いのままにすること", () => {
          moveVehicles([["a", "ArrowLeft"]]);

          const vehicle = queryVehicle("a");
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

      test("残りを出すことを伝え、すべてのルールを見せ、手が止まるまで印を出さないこと", () => {
        const headline = screen.queryByText(freePlayHeadline);
        const rules = getRuleTexts();
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(rules).toEqual([
          "前か後ろへ",
          "道路へ出る",
          "植え込み",
          "ほかの車",
        ]);
        expect(cued).toEqual([]);
      });

      test("手が止まると、今出せる車を1台示すこと", () => {
        advanceTime(idleHintDelayMs);

        const cued = getCuedVehicles();

        expect(cued).toHaveLength(1);
      });

      test("ほかの車がある向きへ動かすと、本番と同じく揺らし、わけを言うこと", () => {
        moveVehicles([["d", "ArrowRight"]]);

        const vehicle = queryVehicle("d");
        const headline = screen.queryByText(
          "右にほかの車があるので 通れません",
        );

        expect(vehicle?.getAttribute("class")).toContain(
          "parking-jam-car--blocked-right",
        );
        expect(headline).not.toBeNull();
      });

      test("途中にほかの車があっても道路につながっていない向きへ動かすと、本番と同じく道路がないことを伝えること", () => {
        moveVehicles([["f", "ArrowLeft"]]);

        const headline = screen.queryByText(
          "左へ進む先に道路がないので 出られません",
        );

        expect(headline).not.toBeNull();
      });

      describe("出られない向きへ動かした後の場合", () => {
        beforeEach(() => {
          moveVehicles([["d", "ArrowRight"]]);
        });

        test("手が止まると、印と一緒に残りを出す一言に戻すこと", () => {
          advanceTime(idleHintDelayMs);

          const headline = screen.queryByText(freePlayHeadline);
          const cued = getCuedVehicles();

          expect(headline).not.toBeNull();
          expect(cued).toHaveLength(1);
        });
      });

      describe("すべて出した場合", () => {
        beforeEach(() => {
          moveVehicles(remainingMoves);
          advanceTime(0);
        });

        test("長い車も同じルールで出せることと、ミスの数え方を伝えること", () => {
          const detail = screen.queryByText(
            "長い車も同じルールで出せます 出られない向きへ動かすとミスに数えます",
          );

          expect(detail).not.toBeNull();
        });

        test("ゲームのホームで開いているレベルを遊ぶ操作で、そのレベルを始めること", () => {
          fireEvent.click(
            screen.getByRole("button", { name: "レベル 2を遊ぶ" }),
          );

          expect(playStart.onStart).toHaveBeenCalledOnce();
        });

        test("もう一度で、始まりの盤面の一言を見せること", () => {
          fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

          const caption = screen.queryByText("最初は車でいっぱいです");

          expect(caption).not.toBeNull();
        });

        describe("もう一度で導入を終えた場合", () => {
          beforeEach(() => {
            fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
            pressNextThroughIntroWaitingForScenes();
          });

          test("始めの盤面に戻し、最初の手順から始めること", () => {
            const vehicle = queryVehicle("a");
            const cued = getCuedVehicles();
            const rules = getRuleTexts();

            expect(vehicle).not.toBeNull();
            expect(cued).toEqual(["e"]);
            expect(rules).toEqual([
              "前か後ろへ",
              hiddenRule,
              hiddenRule,
              hiddenRule,
            ]);
          });
        });
      });
    });
  });

  describe("導入を見せる場合", () => {
    beforeEach(() => {
      render(
        <ParkingJamTutorial
          open={true}
          playStart={playStart}
          onClose={onClose}
        />,
      );
    });

    test("開くと、何をするパズルかと、車を出していく前の駐車場を、ゴールの一言と一緒に見せること", () => {
      const purpose = screen.queryByText(
        "駐車場の車を すべて道路へ出すパズルです",
      );
      const caption = screen.queryByText("駐車場が空になったらゴールです");
      const cars = getDrawnCars();
      const operableVehicle = queryVehicle("e");

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(cars).toHaveLength(Object.keys(vehicleLabels).length);
      expect(operableVehicle).toBeNull();
    });

    test("待つと、車をすべて出し終えた空の駐車場を見せ、次へを待つこと", () => {
      advanceTime(introEnoughMs);

      const cars = getDrawnCars();
      const nextButton = screen.queryByRole("button", { name: "次へ" });

      expect(cars).toEqual([]);
      expect(nextButton).not.toBeNull();
    });

    test("車を押しても、手順へ飛ばずに、車を出していく動きを終えて空の駐車場を見せ、次へを待つこと", () => {
      const [carBeforePress] = getDrawnCars();
      if (!carBeforePress) {
        throw new Error("車がない");
      }
      fireEvent.pointerDown(carBeforePress);

      const caption = screen.queryByText("駐車場が空になったらゴールです");
      const cars = getDrawnCars();
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const cued = getCuedVehicles();

      expect(caption).not.toBeNull();
      expect(cars).toEqual([]);
      expect(nextButton).not.toBeNull();
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
      const caption = screen.queryByText("駐車場が空になったらゴールです");
      const vehicle = queryVehicle("e");

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(vehicle).toBeNull();
    });

    test("ゴールで次へを押すと、始まりの一言を添えて車の停まった始めの盤面を見せること", () => {
      pressNext();

      const caption = screen.queryByText("最初は車でいっぱいです");
      const vehicle = queryVehicle("e");

      expect(caption).not.toBeNull();
      expect(vehicle).not.toBeNull();
    });

    describe("導入を終えた場合", () => {
      beforeEach(() => {
        pressNext();
        pressNextThroughIntroWaitingForScenes();
      });

      test("印の車を出すと、待たずに次のルールの一言と印を出すこと", () => {
        moveVehicles(stepMoves.slice(0, 1));

        const headline = screen.queryByText(roadHeadline);
        const cued = getCuedVehicles();

        expect(headline).not.toBeNull();
        expect(cued).toEqual(["g"]);
      });

      describe("道路のルールの手順の場合", () => {
        beforeEach(() => {
          moveVehicles(stepMoves.slice(0, 1));
        });

        test("進む先に道路がない向きへ動かすと、揺れが見えなくても、手順の見出しから、進む先に道路がないことを言う一言に替えること", () => {
          const headlineBefore = screen.queryByText(roadHeadline);
          moveVehicles([["g", "ArrowLeft"]]);

          const vehicle = queryVehicle("g");
          const stepHeadline = screen.queryByText(roadHeadline);
          const violation = screen.queryByText(
            "左へ進む先に道路がないので 出られません",
          );

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

        test("植え込みへ動かすと、揺れが見えなくても、手順の見出しから、動かした向きに植え込みがあることを言う一言に替えること", () => {
          const headlineBefore = screen.queryByText(planterHeadline);
          moveVehicles([["b", "ArrowRight"]]);

          const vehicle = queryVehicle("b");
          const stepHeadline = screen.queryByText(planterHeadline);
          const violation = screen.queryByText(
            "右に植え込みがあるので 通れません",
          );

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
      pressNextThroughIntro();
    });

    describe("すべて出した場合", () => {
      beforeEach(() => {
        moveVehicles(stepMoves, exitStepHoldMs);
        moveVehicles(remainingMoves);
        advanceTime(0);
      });

      test("ミスの数え方を伝えること", () => {
        const detail = screen.queryByText(
          "出られない向きへ動かすとミスに数えます",
        );

        expect(detail).not.toBeNull();
      });

      test("プレイに戻る操作で閉じること", () => {
        fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

        expect(onClose).toHaveBeenCalledOnce();
      });
    });
  });
});
