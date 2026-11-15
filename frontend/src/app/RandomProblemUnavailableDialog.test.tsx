import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { RandomProblemUnavailableDialog } from "@/app/RandomProblemUnavailableDialog";
import { randomProblemUnavailable } from "@/features/random-play/random-problem-unavailable";
import { GameCatalogProvider } from "@/features/settings/GameCatalogContext";

function renderDialog() {
  return render(
    <GameCatalogProvider games={[{ id: "nanpure", name: "ナンプレ" }]}>
      <RandomProblemUnavailableDialog />
    </GameCatalogProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  randomProblemUnavailable.dismiss();
  vi.unstubAllGlobals();
});

describe("出題候補がない場合", () => {
  describe("今回だけ全問から遊べる候補がある場合", () => {
    let onPlayAny: () => void;

    beforeEach(() => {
      onPlayAny = vi.fn();
      renderDialog();
    });

    test("設定を変えず、今回だけ全問から遊べること", () => {
      act(() =>
        randomProblemUnavailable.show("nanpure", "ナンプレ", onPlayAny),
      );
      const dialog = within(
        screen.getByRole("dialog", { name: "条件に合う別の問題がありません" }),
      );
      fireEvent.click(
        dialog.getByRole("button", { name: "今回だけ全問から遊ぶ" }),
      );
      const unavailable = randomProblemUnavailable.getSnapshot();

      expect(onPlayAny).toHaveBeenCalledExactlyOnceWith();
      expect(unavailable).toBeNull();
    });
  });

  describe("今回だけ遊べる候補もない場合", () => {
    beforeEach(() => {
      renderDialog();
    });

    test("条件変更だけを案内すること", () => {
      act(() => randomProblemUnavailable.show("nanpure", "ナンプレ"));
      const dialog = within(
        screen.getByRole("dialog", { name: "条件に合う別の問題がありません" }),
      );
      const playAny = dialog.queryByRole("button", {
        name: "今回だけ全問から遊ぶ",
      });
      fireEvent.click(dialog.getByRole("button", { name: "出題対象を変更" }));
      const settings = within(screen.getByRole("dialog", { name: "設定" }));
      fireEvent.click(settings.getByRole("button", { name: /ランダム出題/ }));
      const random = within(
        screen.getByRole("dialog", { name: "ランダム出題" }),
      );
      const eligibility = random.getByRole("group", { name: "出題対象" });

      expect(playAny).toBeNull();
      expect(eligibility).toBeTruthy();
    });
  });
});
