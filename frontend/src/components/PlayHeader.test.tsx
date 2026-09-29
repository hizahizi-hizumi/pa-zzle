import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { PlayHeader } from "@/components/PlayHeader";

afterEach(cleanup);

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function createProps(): ComponentProps<typeof PlayHeader> {
  return {
    title: "テストパズル",
    metricGroups: [
      [
        { label: "ミス", value: "2" },
        { label: "時間", value: "1:05" },
      ],
    ],
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onOpenHowToPlay: vi.fn(),
    onOpenDiagnostics: vi.fn(),
  };
}

describe("PlayHeader", () => {
  describe("すべての補助操作を渡した場合", () => {
    let props: ComponentProps<typeof PlayHeader>;

    beforeEach(() => {
      props = createProps();
      render(<PlayHeader {...props} />);
    });

    test("ゲーム名と計測値を表示すること", () => {
      const title = screen.getByRole("heading", { name: "テストパズル" });
      const elapsed = screen.getByText("1:05");

      expect(title).toBeTruthy();
      expect(elapsed).toBeTruthy();
    });

    test("戻るボタンで難易度変更を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(props.onChangeDifficulty).toHaveBeenCalledOnce();
    });

    test("メニュー項目を補助操作・移動・説明・検証の順に並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual([
        "盤面を戻す",
        "リセット",
        "別の問題",
        "難易度変更",
        "ホーム",
        "遊び方",
        "検証情報",
      ]);
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
      ["遊び方", "onOpenHowToPlay"],
      ["検証情報", "onOpenDiagnostics"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        openPlayMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(props[callbackName]).toHaveBeenCalledOnce();
      },
    );
  });

  describe("省略できる補助操作を渡さない場合", () => {
    beforeEach(() => {
      const {
        onRestart: _onRestart,
        onReplay: _onReplay,
        onOpenHowToPlay: _onOpenHowToPlay,
        onOpenDiagnostics: _onOpenDiagnostics,
        ...requiredProps
      } = createProps();
      render(<PlayHeader {...requiredProps} />);
    });

    test("移動の操作だけをメニューへ並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual(["別の問題", "難易度変更", "ホーム"]);
    });
  });
});
