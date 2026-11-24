import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { SOLITAIRE_DISPLAY_NAME } from "@/games/solitaire/display-name";
import { createSolitaireResult } from "@/games/solitaire/play/use-solitaire-play";
import {
  listSolitairePoolEntries,
  restoreSolitairePoolEntry,
} from "@/games/solitaire/problem/problem-pool";
import { createSolitaireInitialState } from "@/games/solitaire/puzzle/state";
import { SolitairePlay } from "@/games/solitaire/ui/SolitairePlay";

afterEach(cleanup);

/** 結果画面は記録へのリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

type SolitairePlayProps = ComponentProps<typeof SolitairePlay>;

const { problem } = restoreSolitairePoolEntry(
  listSolitairePoolEntries("1")[0]!,
);

// 基準時間6分より速く、取り消した手4手。安定性 60 − 8 = 52点、速さ40点。
const result = createSolitaireResult({
  elapsedMs: 287_000,
  moveCount: 130,
  undoCount: 2,
  restartCount: 1,
  retractedMoveCount: 4,
});

const firstColumnName = /^列1、/;

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function createProps(overrides: Partial<SolitairePlayProps> = {}) {
  return {
    difficulty: "1",
    progress: "result",
    elapsedMs: result.elapsedMs,
    result,
    recordFeedback: { kind: "none" },
    state: createSolitaireInitialState(problem.columns, problem.stock),
    undoCount: result.undoCount,
    selectedSource: null,
    operation: null,
    isStuck: false,
    onSelectPile: vi.fn(),
    canUndo: true,
    onUndo: vi.fn(),
    canRestart: true,
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    onOpenHowToPlay: vi.fn(),
    onOpenTutorial: vi.fn(),
    onOpenDiagnostics: vi.fn(),
    renderSettingsDialog: () => null,
    ...overrides,
  } satisfies SolitairePlayProps;
}

describe("SolitairePlay", () => {
  describe("プレイ中の場合", () => {
    let props: SolitairePlayProps;

    beforeEach(() => {
      props = createProps({ progress: "playing", result: null });
      render(<SolitairePlay {...props} />);
    });

    test("見出しに時間と待ったの回数を出すこと", () => {
      const header = screen.getByRole("heading", {
        name: SOLITAIRE_DISPLAY_NAME,
      }).parentElement!;

      const metrics = within(header)
        .getAllByText(/^(時間|待った)$/)
        .map(
          (label) => `${label.textContent} ${label.nextSibling?.textContent}`,
        );

      expect(metrics).toEqual(["時間 04:47", "待った 2"]);
    });

    test("知らせを出さないこと", () => {
      const notice = screen.queryByRole("status");

      expect(notice).toBeNull();
    });

    test("盤面の山を選ぶと、その山を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: firstColumnName }));

      expect(props.onSelectPile).toHaveBeenCalledWith({
        pile: "column",
        columnIndex: 0,
      });
    });

    test("盤面下の待ったで直前の手を戻せること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
    });

    test("メニューから盤面を戻せること", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "盤面を戻す" }));

      expect(props.onRestart).toHaveBeenCalledOnce();
    });
  });

  describe("どの手順でも組札を増やせない場合", () => {
    beforeEach(() => {
      render(
        <SolitairePlay
          {...createProps({ progress: "playing", result: null })}
          isStuck
        />,
      );
    });

    test("盤面の下に知らせを1行で出し、待ったを残すこと", () => {
      const notice = screen.getByRole("status");
      const undoButton = screen.getByRole("button", { name: "待った" });

      expect(notice.textContent).toBe("組札へ運べない");
      expect(undoButton).toBeTruthy();
    });
  });

  describe("完成演出中の場合", () => {
    let props: SolitairePlayProps;

    beforeEach(() => {
      props = createProps({ progress: "clearing" });
      render(<SolitairePlay {...props} />);
    });

    test("盤面を見せ、結果画面をまだ出さないこと", () => {
      const columns = screen.getAllByRole("button", { name: /^列\d、/ });
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(columns).toHaveLength(7);
      expect(resultScreen).toBeNull();
    });

    test("盤面の山を押しても知らせないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: firstColumnName }));

      expect(props.onSelectPile).not.toHaveBeenCalled();
    });
  });

  describe("完成演出を終えた場合", () => {
    let props: SolitairePlayProps;

    beforeEach(() => {
      props = createProps();
      render(<SolitairePlay {...props} />);
    });

    test("共通の結果階層でゲーム名・難易度・スコアを表示すること", () => {
      const score = within(screen.getByRole("region", { name: "スコア" }));

      expect(screen.getByText(SOLITAIRE_DISPLAY_NAME)).toBeTruthy();
      expect(screen.getByText("レベル 1")).toBeTruthy();
      expect(score.getByText("92点（100点満点）")).toBeTruthy();
    });

    test("時間と基準時間との差・取り消した手を主な成績として表示すること", () => {
      const terms = screen.getAllByRole("term").map((term) => term.textContent);
      const definitions = screen
        .getAllByRole("definition")
        .map((definition) => definition.textContent);

      expect(terms).toEqual(["時間", "取り消した手"]);
      expect(definitions).toEqual(["04:47", "基準差 -01:13", "4手"]);
    });

    test("盤面を表示しないこと", () => {
      const columns = screen.queryAllByRole("button", { name: /^列\d、/ });

      expect(columns).toEqual([]);
    });

    const actionCases = [
      ["次の問題", "onStartNewProblem"],
      ["もう一度", "onReplay"],
      ["問題選択", "onOpenGameHome"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(props[callbackName]).toHaveBeenCalledOnce();
      },
    );

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "採点内訳" }));
      });

      test("安定性・速さの点と、打った手・待った・盤面を戻すの回数を内訳に表示すること", () => {
        const items = screen
          .getAllByRole("term")
          .map(
            (term) => `${term.textContent} ${term.nextSibling?.textContent}`,
          );

        expect(items).toEqual(
          expect.arrayContaining([
            "安定性 52 / 60",
            "速さ 40 / 40",
            "基準時間 06:00",
            "打った手 130手",
            "待った 2回",
            "盤面を戻す 1回",
          ]),
        );
      });
    });
  });
});
