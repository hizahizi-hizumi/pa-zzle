import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { TutorialPlayStart } from "@/components/TutorialOverlay";
import { shuttleParkingTutorial } from "@/games/shuttle-parking/tutorial/tutorial";
import { ShuttleParkingTutorial } from "@/games/shuttle-parking/ui/ShuttleParkingTutorial";

const { steps, completion } = shuttleParkingTutorial;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: "送迎パーキング" });
}

function shown(text: string): string {
  return text.replaceAll("\n", " ");
}

function getCar(carId: number): HTMLElement {
  const car = getScreen().querySelector(`button[data-car-id="${carId}"]`);
  if (!(car instanceof HTMLElement)) throw new Error(`car ${carId}`);
  return car;
}

function listPointedCars(): number[] {
  return Array.from(
    getScreen().querySelectorAll("button[data-car-id]"),
  ).flatMap((car) =>
    car.querySelector('[data-tutorial-cue="pointer"]')
      ? [Number(car.getAttribute("data-car-id"))]
      : [],
  );
}

function press(carId: number): void {
  fireEvent.click(getCar(carId));
}

describe("ShuttleParkingTutorial", () => {
  let playStart: TutorialPlayStart;

  beforeEach(() => {
    vi.useFakeTimers();
    // 動きを減らす設定にして、出庫の動きを待たずに次の手順へ進める。
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
    playStart = { difficulty: "1", onStart: vi.fn<() => void>() };
    render(
      <ShuttleParkingTutorial open playStart={playStart} onClose={vi.fn()} />,
    );
    fireEvent.click(
      within(getScreen()).getByRole("button", { name: "はじめる" }),
    );
  });

  test("最初の手順で、印の車を指さして操作の一言を出すこと", () => {
    expect(listPointedCars()).toEqual([steps[0]!.carId]);
    expect(
      within(getScreen()).getByText(shown(steps[0]!.message.headline)),
    ).toBeTruthy();
  });

  test("前を塞がれた車を押すと、出られないわけを返すこと", () => {
    press(2);

    expect(within(getScreen()).getByText(/前に車があるので/)).toBeTruthy();
  });

  describe("印の車を2台出した場合", () => {
    beforeEach(() => {
      press(5);
      press(2);
    });

    test("読みの手順では印を付けないこと", () => {
      expect(listPointedCars()).toEqual([]);
      expect(
        within(getScreen()).getByText(shown(steps[2]!.message.headline)),
      ).toBeTruthy();
    });

    describe("先頭の乗客が乗れない車を押した場合", () => {
      beforeEach(() => {
        press(4);
      });

      test("詰みの知らせと「待った」で戻す一言を出すこと", () => {
        expect(within(getScreen()).getByRole("status")).toBeTruthy();
        expect(
          within(getScreen()).getByText(/出せる車もなくなりました/),
        ).toBeTruthy();
      });

      test("知らせの「待った」で戻すと、その車が駐車場に戻ること", () => {
        fireEvent.click(
          within(within(getScreen()).getByRole("status")).getByRole("button", {
            name: "待った",
          }),
        );

        expect(getCar(4)).toBeTruthy();
        expect(
          within(getScreen()).getByText(shown(steps[2]!.message.headline)),
        ).toBeTruthy();
      });
    });

    describe("残りを解いた場合", () => {
      beforeEach(() => {
        for (const carId of [0, 3, 1, 4]) press(carId);
        act(() => {
          vi.advanceTimersByTime(1_000);
        });
      });

      test("完成の一言を出すこと", () => {
        expect(
          within(getScreen()).getByText(completion.home.headline),
        ).toBeTruthy();
      });

      test("レベル1を遊ぶボタンで本番を始めること", () => {
        fireEvent.click(
          within(getScreen()).getByRole("button", { name: "レベル 1を遊ぶ" }),
        );

        expect(playStart.onStart).toHaveBeenCalledOnce();
      });
    });
  });
});
