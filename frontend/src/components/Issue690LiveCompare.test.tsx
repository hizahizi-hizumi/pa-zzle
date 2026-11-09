import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { PlayResultView } from "@/views/PlayResultView";

const sample = "/puzzles/nanpure/result/issue690-comparison-sample";

beforeEach(() => {
  window.history.replaceState(null, "", `${sample}?issue690Preview=1`);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

test("実際の記録結果画面で5案と現行画面を切り替えられる", () => {
  const router = createMemoryRouter(
    [{ path: "/puzzles/:game/result/:recordId", element: <PlayResultView /> }],
    { initialEntries: [sample] },
  );
  render(<RouterProvider router={router} />);

  const toggle = screen.getByRole("button", { name: "比較" });
  expect(screen.getByRole("region", { name: "プレイ結果" })).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText(/比較用サンプル/)).toBeNull();
  expect(document.querySelector(".i690-screen--06")).toBeTruthy();
  for (const idea of ["02", "03", "05", "06", "07", "original"]) {
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("演出"), {
      target: { value: idea },
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "次の問題" })).toBeTruthy();
  }
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText("演出"), {
    target: { value: "07" },
  });
  expect(screen.getByText("すばらしい！")).toBeTruthy();
  expect(
    document.querySelector(".i690-screen--07 .i690-celebration-piece"),
  ).toBeTruthy();
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText("演出"), {
    target: { value: "05" },
  });
  expect(
    document.querySelector(".i690-screen--05 .i690-record-race"),
  ).toBeTruthy();
  expect(document.querySelectorAll(".i690-race-tracks span").length).toBe(2);
  expect(screen.getByText("自己ベスト更新")).toBeTruthy();
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText("演出"), {
    target: { value: "03" },
  });
  expect(document.querySelectorAll(".i690-sudoku-cell").length).toBe(81);
  expect(document.querySelector(".i690-sudoku-cell.is-last")).toBeNull();
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText("演出"), {
    target: { value: "07" },
  });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "再生" }));
  expect(document.querySelector(".i690-screen--07")).toBeTruthy();
});

test("06案では成績と採点内訳を上側に置き、4つの導線を軽い操作として残すこと", () => {
  const router = createMemoryRouter(
    [{ path: "/puzzles/:game/result/:recordId", element: <PlayResultView /> }],
    { initialEntries: [sample] },
  );
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "比較" }));
  fireEvent.change(screen.getByLabelText("演出"), {
    target: { value: "06" },
  });

  const quietScreen = document.querySelector(".i690-screen--06");
  const quietMetrics = quietScreen?.querySelector(".i690-quiet-metrics");
  const quietFeedback = quietScreen?.querySelector(".i690-quiet-feedback");
  const actions = screen.getByRole("navigation", { name: "結果からの操作" });

  expect(quietScreen).toBeTruthy();
  expect(quietMetrics).toBeTruthy();
  expect(quietFeedback?.textContent).toContain("自己ベスト更新");
  expect(actions.querySelectorAll("button, a").length).toBe(4);
  expect(screen.getByRole("button", { name: "次の問題" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "採点内訳" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));
  const dialog = screen.getByRole("dialog", { name: "スコアの内訳・採点基準" });

  expect(dialog.textContent).toContain("正確さ");
});

test("06案の演出を押して最後の得点表示へ進めること", () => {
  const router = createMemoryRouter(
    [{ path: "/puzzles/:game/result/:recordId", element: <PlayResultView /> }],
    { initialEntries: [sample] },
  );
  render(<RouterProvider router={router} />);

  const result = screen.getByRole("region", { name: "プレイ結果" });
  const stage = result.querySelector(".i690-screen--06");
  expect(stage).toBeTruthy();
  if (!stage) return;

  fireEvent.pointerDown(stage);

  const score = result.querySelector(".i690-grade-score");
  expect(score?.querySelector("b")?.textContent).toBe("91");
  expect(score?.querySelector("b")?.getAttribute("aria-hidden")).toBe("false");
  expect(screen.getByRole("button", { name: "次の問題" })).toBeTruthy();

  const comparisonToggle = screen.getByRole("button", { name: "比較" });
  fireEvent.click(comparisonToggle);
  fireEvent.change(screen.getByLabelText("演出"), { target: { value: "02" } });
  fireEvent.click(comparisonToggle);
  fireEvent.change(screen.getByLabelText("演出"), { target: { value: "06" } });

  const replayedScore = screen
    .getByRole("region", { name: "プレイ結果" })
    .querySelector(".i690-grade-score b");
  expect(replayedScore?.getAttribute("aria-hidden")).toBe("true");
});
