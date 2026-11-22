import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import { ShuttleParkingPlay } from "@/games/shuttle-parking/ui/ShuttleParkingPlay";

afterEach(cleanup);

function createProps(): ComponentProps<typeof ShuttleParkingPlay> {
  return {
    difficulty: "3",
    progress: "playing",
    problem: {
      lot: {
        size: 4,
        openSides: ["top"],
        cars: [
          {
            row: 0,
            column: 0,
            orientation: "vertical",
            capacity: 2,
            color: "a",
          },
          {
            row: 2,
            column: 0,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
          {
            row: 0,
            column: 2,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
        ],
      },
      passengers: ["b", "a", "b", "a", "b", "b"],
      bayCount: 2,
    },
    state: {
      parkedCarIds: [1, 2],
      waitingCars: [{ carId: 0, seatedCount: 0 }],
      boardedCount: 0,
    },
    operation: null,
    isStuck: false,
    elapsedMs: 65_000,
    undoCount: 1,
    canUndo: true,
    canRestart: true,
    result: null,
    recordFeedback: { kind: "none" } as const,
    onExitCar: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    renderSettingsDialog: () => null,
    onOpenDiagnostics: vi.fn(),
  };
}

describe("ShuttleParkingPlay", () => {
  let props: ComponentProps<typeof ShuttleParkingPlay>;

  beforeEach(() => {
    props = createProps();
    render(<ShuttleParkingPlay {...props} />);
  });

  test("プレイ中に難易度を表示しないこと", () => {
    expect(screen.queryByText("レベル 3")).toBeNull();
  });

  test("駐車場に残る車だけを押せるように出すこと", () => {
    const lot = within(
      screen.getByRole("group", { name: "送迎パーキングの駐車場" }),
    );

    const cars = lot.getAllByRole("button");

    expect(cars.map((car) => car.getAttribute("aria-label"))).toEqual([
      "青の2人乗りの車 上向き",
      "青の2人乗りの車 上向き",
    ]);
  });

  test("車を押すとその車を出す操作を通知すること", () => {
    const [, car] = within(
      screen.getByRole("group", { name: "送迎パーキングの駐車場" }),
    ).getAllByRole("button");

    fireEvent.click(car!);

    expect(props.onExitCar).toHaveBeenCalledWith(2);
  });

  test("待機枠の数と待っている車の座席を示すこと", () => {
    const bays = screen.getByRole("list", { name: "待機枠 2か所中1台" });

    const waiting = within(bays).getByRole("img");

    expect(waiting.getAttribute("aria-label")).toBe("赤の車 2席中0人");
  });

  test("乗客の列を先頭から読み上げること", () => {
    const queue = screen.getByRole("list", { name: /^乗客の列/ });

    expect(queue.getAttribute("aria-label")).toBe(
      "乗客の列 残り6人 先頭から 青 赤 青 赤 青 青",
    );
  });

  test("待ったを押すと通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "待った" }));

    expect(props.onUndo).toHaveBeenCalledOnce();
  });
});

describe("詰んだ場合", () => {
  let props: ComponentProps<typeof ShuttleParkingPlay>;

  beforeEach(() => {
    props = { ...createProps(), isStuck: true };
    render(<ShuttleParkingPlay {...props} />);
  });

  test("出せる車が無いことと、何台か戻してやり直せることを駐車場の上に知らせること", () => {
    const notice = screen.getByRole("status");

    expect(notice.textContent).toContain("出せる車がありません");
    expect(notice.textContent).toContain("何台か戻すか");
  });

  test("知らせの盤面を戻すボタンで盤面を戻すこと", () => {
    fireEvent.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: "盤面を戻す",
      }),
    );

    expect(props.onRestart).toHaveBeenCalledOnce();
  });
});

describe("クリア演出の場合", () => {
  test("演出を終えたら完了を通知すること", async () => {
    const props = { ...createProps(), progress: "clearing" as const };

    render(<ShuttleParkingPlay {...props} />);

    await vi.waitFor(() => {
      expect(props.onClearAnimationComplete).toHaveBeenCalledOnce();
    });
  });
});
