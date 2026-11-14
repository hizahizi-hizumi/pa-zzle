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
  test("設定を変えず、今回だけ全問から遊ぶ操作を選べる", () => {
    const onPlayAny = vi.fn();
    renderDialog();
    act(() => randomProblemUnavailable.show("nanpure", "ナンプレ", onPlayAny));
    const dialog = within(
      screen.getByRole("dialog", { name: "条件に合う別の問題がありません" }),
    );
    fireEvent.click(
      dialog.getByRole("button", { name: "今回だけ全問から遊ぶ" }),
    );
    expect(onPlayAny).toHaveBeenCalledExactlyOnceWith();
    expect(randomProblemUnavailable.getSnapshot()).toBeNull();
  });

  test("今回だけ遊べる候補もない場合、条件変更だけを案内する", () => {
    renderDialog();
    act(() => randomProblemUnavailable.show("nanpure", "ナンプレ"));
    const dialog = within(
      screen.getByRole("dialog", { name: "条件に合う別の問題がありません" }),
    );
    expect(
      dialog.queryByRole("button", { name: "今回だけ全問から遊ぶ" }),
    ).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "出題対象を変更" }));
    const settings = within(screen.getByRole("dialog", { name: "設定" }));
    fireEvent.click(settings.getByRole("button", { name: /ランダム出題/ }));
    const random = within(screen.getByRole("dialog", { name: "ランダム出題" }));
    expect(random.getByRole("group", { name: "出題対象" })).toBeTruthy();
  });
});
