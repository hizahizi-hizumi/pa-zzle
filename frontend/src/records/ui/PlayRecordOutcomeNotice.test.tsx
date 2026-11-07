import { cleanup, render, screen } from "@testing-library/react";

import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

afterEach(cleanup);

function renderNotice(outcome: PlayRecordSaveOutcome) {
  return render(
    <PlayRecordOutcomeNotice
      outcome={outcome}
      display={waterSortPlayRecordDisplay}
    />,
  );
}

describe("PlayRecordOutcomeNotice の自己ベスト更新", () => {
  test("更新した複数の指標について以前と今回の値と改善幅を表示すること", () => {
    renderNotice({
      status: "updated",
      updates: [
        { metricId: "play-score", previousValue: 85, currentValue: 100 },
        { metricId: "move-delta", previousValue: 3, currentValue: 1 },
      ],
    });

    const notice = screen.getByRole("region", { name: "自己ベスト更新" });
    expect(notice.textContent).toContain("自己ベスト更新");
    expect(notice.textContent).toContain("85点");
    expect(notice.textContent).toContain("100点");
    expect(notice.textContent).toContain("+15点");
    expect(notice.textContent).toContain("3");
    expect(notice.textContent).toContain("1");
    expect(notice.textContent).toContain("2手減");
  });

  test.each(["first-record", "recorded"] as const)(
    "%s の場合は自己ベスト更新と誤認させないこと",
    (status) => {
      renderNotice({ status });
      expect(
        screen.queryByRole("region", { name: "自己ベスト更新" }),
      ).toBeNull();
    },
  );

  test("保存失敗では成功を告げずに失敗を表示すること", () => {
    renderNotice({ status: "failed" });
    expect(
      screen.getByText("このプレイの記録を保存できませんでした"),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "自己ベスト更新" })).toBeNull();
  });
});
