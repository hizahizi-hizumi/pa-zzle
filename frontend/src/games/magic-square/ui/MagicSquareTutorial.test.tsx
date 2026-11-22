import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { MagicSquareTutorial } from "@/games/magic-square/ui/MagicSquareTutorial";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function pressCell(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

function pressValue(value: number): void {
  fireEvent.click(
    within(screen.getByRole("group", { name: "数の欄" })).getByText(
      String(value),
    ),
  );
}

describe("MagicSquareTutorial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<MagicSquareTutorial open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
    act(() => vi.runAllTimers());
  });

  test("最初の手順で、空きが1つの列から読むよう一言を出すこと", () => {
    const headline = screen.getByText("空きが1つの列から読みます");

    expect(headline).toBeTruthy();
  });

  test("印の無いマスを選んでも手順を進めないこと", () => {
    pressCell("1行4列 空き");

    expect(screen.getByText("空きが1つの列から読みます")).toBeTruthy();
  });

  test("手順どおりに選んで押すと、次の一言へ進むこと", () => {
    pressCell("1行1列 空き");
    pressValue(14);

    expect(screen.getByText("1行目も空きが1つになりました")).toBeTruthy();
  });

  test("最後まで解くと、完成の一言を出すこと", () => {
    pressCell("1行1列 空き");
    pressValue(14);
    pressCell("1行4列 空き");
    pressValue(11);
    pressCell("2行4列 空き");
    pressValue(16);
    pressCell("3行2列 空き");
    pressValue(13);
    pressCell("4行3列 空き");
    pressValue(10);
    act(() => vi.runAllTimers());

    expect(screen.getByText("完成です")).toBeTruthy();
  });
});
