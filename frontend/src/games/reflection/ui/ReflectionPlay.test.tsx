import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import type { ReflectionResult } from "@/games/reflection/play/use-reflection-play";
import {
  countReflectionBoardPieces,
  createEmptyReflectionBoard,
  createEmptyReflectionInventory,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import {
  computeReflectionClues,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedFullScoreMs,
  calculateReflectionSpeedZeroScoreMs,
  calculateReflectionTimeDeltaMs,
} from "@/games/reflection/score";
import type { ReflectionSessionResult } from "@/games/reflection/session/session";
import {
  readReflectionHowToPlaySeen,
  writeReflectionHowToPlaySeen,
} from "@/games/reflection/ui/how-to-play-seen";
import { reflectionOutcomeLabels } from "@/games/reflection/ui/outcome-label";
import { ReflectionPlay } from "@/games/reflection/ui/ReflectionPlay";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function createResult(performance: ReflectionSessionResult): ReflectionResult {
  // 読んで解く時間 28 × 0.5 + 8 × 3.5 + 8 × 1.25 + min(12, 10) × 3.5 = 87秒、試し置きの時間 28 × 0.5 + 13 × 5 = 79秒。
  // 基準時間はその中間の83秒（01:23）、0点になる時間 04:09。
  const workload = {
    pieceCount: 8,
    clueCount: 28,
    propagationRoundCount: 8,
    assumptionTestCount: 12,
    trialMoveCount: 13,
  };
  return {
    ...performance,
    workload,
    speedFullScoreMs: calculateReflectionSpeedFullScoreMs(workload),
    speedZeroScoreMs: calculateReflectionSpeedZeroScoreMs(workload),
    timeDeltaMs: calculateReflectionTimeDeltaMs({
      elapsedMs: performance.elapsedMs,
      workload,
    }),
    score: calculateReflectionPlayScore({
      elapsedMs: performance.elapsedMs,
      workload,
    }),
  };
}

// 12秒超過で93点。置き直し2回・盤面戻し1回は点に入らない。
const performance = {
  elapsedMs: 95_000,
  relocationCount: 2,
  restartCount: 1,
  laserCheckCount: 4,
  inputCount: 20,
};
const result = createResult(performance);
// 基準時間以内なら、置き直しや盤面戻しがあっても100点。
const perfectResult = createResult({ ...performance, elapsedMs: 68_000 });

describe("ReflectionPlay", () => {
  const solution = parseReflectionBoard(["/..", "...", "..@"]);
  const inventory = countReflectionBoardPieces(solution);
  const clues = computeReflectionClues(solution);
  const emptyBoard = createEmptyReflectionBoard(3);
  const placedBoard = parseReflectionBoard(["...", ".@.", "..."]);
  const leftMiddle = { side: "left", index: 1 } as const;

  const callbacks = {
    onTapCell: vi.fn(),
    onTapStock: vi.fn(),
    onTapClue: vi.fn(),
    onRemovePiece: vi.fn(),
    onClearSelection: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  const baseProps: ComponentProps<typeof ReflectionPlay> = {
    difficultyLabel: "レベル 1",
    laserPathMode: "assist",
    progress: "playing",
    board: emptyBoard,
    clues,
    inventory,
    stock: inventory,
    selection: null,
    laser: null,
    elapsedMs: 65_000,
    canRestart: false,
    sessionResult: null,
    result: null,
    recordOutcomeNotice: null,
    ...callbacks,
  };

  function renderPlay(props: Partial<ComponentProps<typeof ReflectionPlay>>) {
    render(<ReflectionPlay {...baseProps} {...props} />);
  }

  function getBoardGroup(): HTMLElement {
    return screen.getByRole("group", {
      name: `${REFLECTION_DISPLAY_NAME}盤面`,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    writeReflectionHowToPlaySeen();
  });

  describe("初めて遊ぶ場合", () => {
    beforeEach(() => {
      window.localStorage.clear();
      renderPlay({});
    });

    test("遊び方を開き、光路表示を補助として説明すること", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(
        within(dialog).getByText(/補助。使った回数は記録に残る/),
      ).toBeTruthy();
    });

    test("遊び方を閉じると測り直し、次からは開かないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(callbacks.onReplay).toHaveBeenCalledOnce();
      expect(readReflectionHowToPlaySeen()).toBe(true);
    });
  });

  describe("光路表示を通常の操作として扱う場合", () => {
    beforeEach(() => {
      window.localStorage.clear();
      renderPlay({ laserPathMode: "normal" });
    });

    test("遊び方で補助と説明しないこと", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(within(dialog).queryByText(/補助/)).toBeNull();
    });
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay({});
    });

    test("時間だけをヘッダーに出し、置き直しと待ったを出さないこと", () => {
      const header = screen
        .getByRole("heading", { name: REFLECTION_DISPLAY_NAME })
        .closest("header") as HTMLElement;

      expect(within(header).getByText("01:05")).toBeTruthy();
      expect(within(header).queryByText("置き直し")).toBeNull();
      expect(within(header).queryByText("待った")).toBeNull();
    });

    test("外周ヒントを押すとその位置を知らせること", () => {
      fireEvent.click(
        screen.getByRole("button", { name: "左2行 退出 3マス 一致" }),
      );

      expect(callbacks.onTapClue).toHaveBeenCalledWith(leftMiddle);
    });

    test.each([
      ["盤面のマス", () => within(getBoardGroup()).getAllByRole("button")[0]],
      ["body", () => document.body],
    ])(
      "数字キーでストックの種類を並び順に選ぶこと: フォーカスが%s",
      (_, getTarget) => {
        fireEvent.keyDown(getTarget() as HTMLElement, { key: "2" });

        expect(callbacks.onTapStock).toHaveBeenCalledWith("black-hole");
      },
    );

    test("メニューを開いている間は数字キーで選ばないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      const menu = screen.getByRole("menu");

      fireEvent.keyDown(menu, { key: "1" });

      expect(callbacks.onTapStock).not.toHaveBeenCalled();
    });

    test("Escape で選択の解除を求めること", () => {
      const firstCell = within(getBoardGroup()).getAllByRole("button")[0];

      fireEvent.keyDown(firstCell as HTMLElement, { key: "Escape" });

      expect(callbacks.onClearSelection).toHaveBeenCalledOnce();
    });
  });

  describe("ヘッダーの移動とメニューの場合", () => {
    function openMenu(): void {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
    }

    test("戻るボタンで難易度選択への移動を通知すること", () => {
      renderPlay({});

      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(callbacks.onChangeDifficulty).toHaveBeenCalledOnce();
      expect(callbacks.onBackToHome).not.toHaveBeenCalled();
    });

    test.each([
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const)("メニューの%sで移動を通知すること", (name, callbackName) => {
      renderPlay({});
      openMenu();

      fireEvent.click(screen.getByRole("menuitem", { name }));

      expect(callbacks[callbackName]).toHaveBeenCalledOnce();
    });

    test("検証情報のつなぎ先を渡さなければメニューに検証情報を出さないこと", () => {
      renderPlay({});
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });

    test("メニューの検証情報で検証情報を開く操作を通知すること", () => {
      const onOpenDiagnostics = vi.fn();
      renderPlay({ onOpenDiagnostics });
      openMenu();

      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("盤面のピースを選んでいる場合", () => {
    beforeEach(() => {
      renderPlay({
        board: placedBoard,
        stock: { ...inventory, "black-hole": 0 },
        selection: { type: "cell", cellIndex: 4 },
      });
    });

    test("同じ種類のストックだけを戻し先として示し、残りが無くても押せること", () => {
      const stock = screen.getByRole("group", {
        name: "ストック（同じ種類を押すと戻す・別の種類を押すと置き換える）",
      });
      const blackHole = within(stock).getByRole("button", {
        name: "ブラックホール 残り0",
      });
      const returnTargets = stock.querySelectorAll("[data-return-target]");

      expect(blackHole.hasAttribute("disabled")).toBe(false);
      expect(returnTargets).toHaveLength(1);
      expect(blackHole.contains(returnTargets[0] ?? null)).toBe(true);
      expect(screen.queryByText("ここへ戻す")).toBeNull();
    });

    test("Delete でフォーカス中のマスのピースを戻すこと", () => {
      const cell = within(getBoardGroup()).getByRole("button", {
        name: "2行2列 ブラックホール",
      });
      fireEvent.focus(cell);

      fireEvent.keyDown(cell, { key: "Delete" });

      expect(callbacks.onRemovePiece).toHaveBeenCalledWith(4);
    });

    describe("タッチで押す場合", () => {
      const touch = { pointerType: "touch", isPrimary: true } as const;

      function getCell(name: string): HTMLElement {
        return within(getBoardGroup()).getByRole("button", { name });
      }

      test("指を離したマスを1回だけ知らせ、続いて届く click で重ねて知らせないこと", () => {
        fireEvent.pointerUp(getCell("2行3列 空き"), touch);
        fireEvent.click(getCell("2行3列 空き"), { detail: 1 });

        expect(callbacks.onTapCell.mock.calls).toEqual([[5]]);
      });

      test("隣のマスを続けて押すと、前に押したマスへ届く click ではなく指を離したマスを知らせること", () => {
        // iOS Safari は近くを続けて押すと2回目をダブルタップとし、click を1回目の位置へ送る。
        fireEvent.pointerUp(getCell("2行2列 ブラックホール"), touch);
        fireEvent.click(getCell("2行2列 ブラックホール"), { detail: 1 });
        fireEvent.pointerUp(getCell("2行3列 空き"), touch);
        fireEvent.click(getCell("2行2列 ブラックホール"), { detail: 2 });

        expect(callbacks.onTapCell.mock.calls).toEqual([[4], [5]]);
      });

      test("ストックも指を離した種類を1回だけ知らせること", () => {
        const stockButton = screen.getByRole("button", {
          name: "右上がりの鏡 残り1",
        });

        fireEvent.pointerUp(stockButton, touch);
        fireEvent.click(stockButton, { detail: 1 });

        expect(callbacks.onTapStock.mock.calls).toEqual([["slash"]]);
      });
    });
  });

  describe("外周ヒントの一致", () => {
    const matchedName = / 一致$/;
    const emptyStock = createEmptyReflectionInventory();

    test("今の配置での光が一致している外周ヒントだけを一致として示すこと", () => {
      renderPlay({ board: emptyBoard });

      // 空の盤面では、目標が「まっすぐ3マス抜ける」中央の4本だけが一致する。
      const matched = screen
        .getAllByRole("button", { name: matchedName })
        .map((button) => button.getAttribute("aria-label"));
      expect(matched).toEqual([
        "上2列 退出 3マス 一致",
        "右2行 退出 3マス 一致",
        "下2列 退出 3マス 一致",
        "左2行 退出 3マス 一致",
      ]);
    });

    test("置いたピースで光が変わると一致を外すこと", () => {
      renderPlay({ board: placedBoard });

      expect(
        screen.queryAllByRole("button", { name: matchedName }),
      ).toHaveLength(0);
      expect(
        screen.getByRole("button", { name: "左2行 退出 3マス" }),
      ).toBeTruthy();
    });

    test("手持ちを置き切っても揃わないとき、合っていない外周ヒントの本数を知らせること", () => {
      renderPlay({
        board: parseReflectionBoard(["/..", "...", ".@."]),
        stock: emptyStock,
      });

      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "SPAN" &&
            element.textContent === "合っていない外周ヒントが6本あります",
        ),
      ).toBeTruthy();
    });

    test("手持ちが残っている間は、合っていない外周ヒントの本数を出さないこと", () => {
      renderPlay({ board: parseReflectionBoard(["/..", "...", "..."]) });

      expect(screen.queryByText(/合っていない外周ヒント/)).toBeNull();
    });
  });

  describe("光路を表示している場合", () => {
    beforeEach(() => {
      renderPlay({
        board: placedBoard,
        laser: {
          entry: leftMiddle,
          trace: traceReflectionLaser(placedBoard, leftMiddle),
        },
      });
    });

    test("光路の行き先や通ったマスの数を文字で出さないこと", () => {
      expect(screen.queryByText(/の光/)).toBeNull();
      expect(screen.queryByText("吸収")).toBeNull();
    });

    test("表示中の外周ヒントを押されている状態にすること", () => {
      const clue = screen.getByRole("button", { name: "左2行 退出 3マス" });

      expect(clue.getAttribute("aria-pressed")).toBe("true");
    });

    test("表示中の外周ヒントに、今の光の行き先とマスの数を説明し、マスの数を表示すること", () => {
      const trace = traceReflectionLaser(placedBoard, leftMiddle);
      const clue = screen.getByRole("button", { name: "左2行 退出 3マス" });

      expect(clue.getAttribute("aria-description")).toBe(
        `今の光 ${reflectionOutcomeLabels[trace.outcome]} ${trace.distance}マス`,
      );
      expect(clue.textContent).toContain(String(trace.distance));
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay({
        board: solution,
        progress: "clearing",
        sessionResult: performance,
        result,
      });
    });

    test("揃った盤面を覆わずに見せ、結果画面をまだ出さないこと", () => {
      const board = getBoardGroup();
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(board).toBeTruthy();
      expect(resultScreen).toBeNull();
    });
  });

  describe("完成演出を終えた場合", () => {
    function renderResult(
      props: Partial<ComponentProps<typeof ReflectionPlay>> = {},
    ) {
      renderPlay({
        board: solution,
        progress: "result",
        sessionResult: performance,
        result,
        ...props,
      });
    }

    describe("問題集の問題を解いた場合", () => {
      beforeEach(() => {
        renderResult();
      });

      test("共通の結果階層でゲーム名・難易度・スコアを表示すること", () => {
        const heading = screen.getByRole("heading", { name: "プレイ結果" });
        const pictogram = document.querySelector(
          `svg[aria-label="${REFLECTION_DISPLAY_NAME}"]`,
        );
        const gameName = screen.getByText(REFLECTION_DISPLAY_NAME);
        const difficulty = screen.getByText("レベル 1");
        const score = within(screen.getByRole("region", { name: "スコア" }));

        expect(heading).toBeTruthy();
        expect(pictogram).toBeTruthy();
        expect(gameName).toBeTruthy();
        expect(difficulty).toBeTruthy();
        expect(score.getByText("93")).toBeTruthy();
      });

      test("時間と基準時間との差・置き直しを主な成績として表示すること", () => {
        const terms = screen
          .getAllByRole("term")
          .map((term) => term.textContent);
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(terms).toEqual(["時間", "置き直し"]);
        expect(definitions).toEqual(["01:35", "基準 +00:12", "2"]);
      });

      test("結果画面へフォーカスを移すこと", () => {
        const focused = document.activeElement;

        expect(focused).toBe(
          screen.getByRole("region", { name: "プレイ結果" }),
        );
      });

      test("盤面を表示しないこと", () => {
        const board = screen.queryByRole("group", {
          name: `${REFLECTION_DISPLAY_NAME}盤面`,
        });

        expect(board).toBeNull();
      });

      const actionCases = [
        ["プレイ！", "onStartNewProblem"],
        ["同じ問題", "onReplay"],
        ["記録を確認", "onOpenRecords"],
        ["難易度変更", "onChangeDifficulty"],
        ["ホーム", "onBackToHome"],
      ] as const;

      test.each(actionCases)(
        "%s ボタンで対応する操作を通知すること",
        (buttonName, callbackName) => {
          fireEvent.click(screen.getByRole("button", { name: buttonName }));

          expect(callbacks[callbackName]).toHaveBeenCalledOnce();
        },
      );

      test("検証情報のつなぎ先を渡していなければ検証情報ボタンを出さないこと", () => {
        const button = screen.queryByRole("button", { name: "検証情報" });

        expect(button).toBeNull();
      });

      describe("スコアの内訳を開いた場合", () => {
        beforeEach(() => {
          fireEvent.click(
            screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
          );
        });

        test("盤面戻し・光路の確認・基準時間・作業の量を内訳に表示すること", () => {
          const terms = screen
            .getAllByRole("term")
            .map((term) => term.textContent);
          const definitions = screen
            .getAllByRole("definition")
            .map((definition) => definition.textContent);

          expect(terms).toEqual(
            expect.arrayContaining([
              "盤面戻し",
              "光路の確認",
              "基準時間",
              "ピース",
              "外周ヒント",
              "照らし直す局面",
              "仮に置いて確かめる",
              "試し置き",
            ]),
          );
          expect(definitions).toEqual(
            expect.arrayContaining([
              "1回",
              "4回",
              "01:23",
              "8個",
              "28本",
              "8回",
              "12回",
              "13手",
            ]),
          );
        });

        test("基準時間を問題の作業の量から求める式と0点になる時間を表示すること", () => {
          const criteria = screen.getByText(/基準時間は/);

          expect(criteria.textContent).toBe(
            "基準時間01:23以内で100点、04:09以上で0点、その間は時間に応じて減点。基準時間は読んで解く時間01:27（外周ヒント28本 × 0.5秒 + ピース8個 × 3.5秒 + 照らし直す局面8回 × 1.25秒 + 仮に置いて確かめる10回 × 3.5秒）と、一致表示を見ながら試し置きで解く時間01:19（外周ヒント28本 × 0.5秒 + 試し置き13手 × 5秒）の中間です。局面と仮に置く回数は、この問題を外周ヒントから読んで解くときに要る回数です（仮に置く回数は10回まで数えます）。",
          );
        });

        test("置き直し・盤面戻し・光路の確認を減点しないことを表示すること", () => {
          const criteria = screen.getByText(/点に入りません/);

          expect(criteria.textContent).toBe(
            "置き直し・盤面戻し・光路を確かめた回数は点に入りません。置いて確かめ、動かして直しても減点しません。",
          );
        });
      });
    });

    describe("光路表示を通常の操作として扱う場合", () => {
      beforeEach(() => {
        renderResult({ laserPathMode: "normal" });
        fireEvent.click(
          screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
        );
      });

      test("光路を確かめた回数を出さないこと", () => {
        const term = screen.queryByText("光路の確認");

        expect(term).toBeNull();
      });
    });

    describe("100点で解いた場合", () => {
      beforeEach(() => {
        renderResult({ sessionResult: perfectResult, result: perfectResult });
      });

      test("最高段階として称えること", () => {
        const message = screen.getByText("パーフェクト！");

        expect(message).toBeTruthy();
      });

      test("基準時間より速かった差を負の時間で表示すること", () => {
        const timeDelta = screen.getByText("基準 -00:15");

        expect(timeDelta).toBeTruthy();
      });
    });

    describe("評価できない問題を解いた場合", () => {
      beforeEach(() => {
        renderResult({ difficultyLabel: "問題指定", result: null });
      });

      test("スコアを出さない理由と、プレイの事実を表示すること", () => {
        const reason = screen.getByText(
          "問題集に無い問題のため、スコアは出しません。",
        );
        const score = screen.queryByRole("region", { name: "スコア" });
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(reason).toBeTruthy();
        expect(score).toBeNull();
        expect(definitions).toEqual(["01:35", "2"]);
      });

      test("スコアの内訳を出さないこと", () => {
        const button = screen.queryByRole("button", {
          name: "スコアの内訳・採点基準",
        });

        expect(button).toBeNull();
      });
    });

    describe("検証情報のつなぎ先を渡した場合", () => {
      const onOpenDiagnostics = vi.fn();

      beforeEach(() => {
        renderResult({ onOpenDiagnostics });
      });

      test("検証情報ボタンで検証情報を開く操作を通知すること", () => {
        fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

        expect(onOpenDiagnostics).toHaveBeenCalledOnce();
      });
    });
  });
});
