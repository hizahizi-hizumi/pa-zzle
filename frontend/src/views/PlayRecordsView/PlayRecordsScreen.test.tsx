import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { PlayTimelineEntryDescription } from "@/app/game-integration/play-timeline-entry-description";
import { getGameResultStyle } from "@/components/game-result-style";
import type { PlayAttempt } from "@/features/records/play-attempt";
import type { PlayRecord } from "@/features/records/play-record";
import {
  listPlayTimelineEntries,
  type PlayTimelineEntry,
} from "@/features/records/play-timeline";
import { PlayRecordsScreen } from "@/views/PlayRecordsView/PlayRecordsScreen";

function at(month: number, day: number, hour: number): number {
  return new Date(2026, month - 1, day, hour).getTime();
}

function createRecord(completedAt: number): PlayRecord {
  return {
    id: `test:${completedAt}`,
    gameId: "test",
    startedAt: completedAt - 60_000,
    completedAt,
    payloadVersion: 1,
    payload: {},
  };
}

const now = at(11, 4, 15);
const greatRecord = createRecord(at(11, 1, 21));
const morningRecord = createRecord(at(11, 1, 9));
const olderRecord = createRecord(at(10, 31, 20));
const abandonedAttempt: PlayAttempt = {
  gameId: "test",
  startedAt: at(11, 1, 10),
  start: { difficulty: "3", problemIdentity: { seed: "abandoned" } },
  abandonment: { abandonedAt: at(11, 1, 11), progress: { elapsedMs: 1 } },
};
const entries = listPlayTimelineEntries(
  [greatRecord, morningRecord, olderRecord],
  [abandonedAttempt],
);

function describeEntry(entry: PlayTimelineEntry): PlayTimelineEntryDescription {
  return {
    gameName: "ウォーターソート",
    pictogramSvg: "<svg></svg>",
    levelLabel: "レベル 3",
    zukanNumber: { number: 42, problemCount: 5000 },
    score:
      entry.kind === "abandoned"
        ? null
        : entry.playedAt === greatRecord.completedAt
          ? 92
          : 70,
  };
}

const onOpenEntry = vi.fn();
const onShownEntryCountChange = vi.fn();

afterEach(() => {
  cleanup();
  onOpenEntry.mockClear();
  onShownEntryCountChange.mockClear();
});

describe("PlayRecordsScreen", () => {
  describe("記録が無い場合", () => {
    beforeEach(() => {
      render(
        <PlayRecordsScreen
          newestFirstEntries={[]}
          now={now}
          describeEntry={describeEntry}
          onOpenEntry={onOpenEntry}
          shownEntryCount={40}
          onShownEntryCountChange={onShownEntryCountChange}
          emptyAction={<a href="/">パズルを選ぶ</a>}
        />,
      );
    });

    test("まだ記録が無いことと、パズルを選ぶ操作を示すこと", () => {
      const message = screen.getByText("まだ記録がありません");
      const action = screen.getByRole("link", { name: "パズルを選ぶ" });

      expect(message).toBeTruthy();
      expect(action).toBeTruthy();
    });

    test("遊んでいない日だけのカレンダーを示すこと", () => {
      const calendar = screen.getByRole("img", { name: "直近13週に遊んだ日" });
      const amounts = [...calendar.querySelectorAll("[data-play-amount]")].map(
        (day) => day.getAttribute("data-play-amount"),
      );

      expect(new Set(amounts)).toEqual(new Set(["0"]));
    });
  });

  describe("記録がある場合", () => {
    beforeEach(() => {
      render(
        <PlayRecordsScreen
          newestFirstEntries={entries}
          now={now}
          describeEntry={describeEntry}
          onOpenEntry={onOpenEntry}
          shownEntryCount={40}
          onShownEntryCountChange={onShownEntryCountChange}
          emptyAction={<a href="/">パズルを選ぶ</a>}
        />,
      );
    });

    test("遊んだ日の見出しを新しい日から並べること", () => {
      const days = within(
        screen.getByRole("list", { name: "遊んだ日" }),
      ).getAllByRole("heading");

      expect(days.map((day) => day.textContent)).toEqual([
        "11/1（日）",
        "10/31（土）",
      ]);
    });

    test("その日のプレイを新しい順に、ゲーム・レベル・図鑑の番号・点か離脱・時刻で示すこと", () => {
      const rows = screen.getAllByRole("button");

      expect(rows.map((row) => row.textContent)).toEqual([
        "ウォーターソートレベル 3No.004292点21:00",
        "ウォーターソートレベル 3No.0042離脱11:00",
        "ウォーターソートレベル 3No.004270点09:00",
        "ウォーターソートレベル 3No.004270点20:00",
      ]);
    });

    test("点を、結果画面と同じ評価段階の色で示すこと", () => {
      const score = screen.getByText("92点");

      expect(score.className).toContain(
        getGameResultStyle("great").scoreClassName,
      );
    });

    test("プレイの行を押すと、そのプレイを開くこと", () => {
      fireEvent.click(screen.getByRole("button", { name: /離脱/ }));

      expect(onOpenEntry).toHaveBeenCalledWith(
        entries.find(({ kind }) => kind === "abandoned"),
      );
    });

    test("カレンダーの日ごとのマスを、その日に遊んだ数の段階で示すこと", () => {
      const calendar = screen.getByRole("img", { name: "直近13週に遊んだ日" });
      const amountOf = (time: number) =>
        calendar
          .querySelector(`[data-day-start="${time}"]`)
          ?.getAttribute("data-play-amount");

      expect(amountOf(at(11, 1, 0))).toBe("2");
      expect(amountOf(at(10, 31, 0))).toBe("1");
      expect(amountOf(at(10, 30, 0))).toBe("0");
      expect(amountOf(at(11, 5, 0))).toBeNull();
    });
  });

  describe("一覧に一度に描くより多くのプレイがある場合", () => {
    const manyEntries = listPlayTimelineEntries(
      Array.from({ length: 100 }, (_, index) =>
        createRecord(at(11, 1, 0) - index * 3_600_000),
      ),
      [],
    );
    let reportIntersection: () => void;

    beforeEach(() => {
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            reportIntersection = () =>
              callback(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
              );
          }
          observe() {}
          disconnect() {}
        },
      );
      render(
        <PlayRecordsScreen
          newestFirstEntries={manyEntries}
          now={now}
          describeEntry={describeEntry}
          onOpenEntry={onOpenEntry}
          shownEntryCount={40}
          onShownEntryCountChange={onShownEntryCountChange}
          emptyAction={<a href="/">パズルを選ぶ</a>}
        />,
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test("開いたときは新しいものから一部だけを描くこと", () => {
      const rows = screen.getAllByRole("button");

      expect(rows).toHaveLength(40);
    });

    test("一覧の終わりが近づくと、続きを描き足した数を知らせること", () => {
      act(() => reportIntersection());

      expect(onShownEntryCountChange).toHaveBeenCalledWith(80);
    });
  });
});
