import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type { PlayRecord } from "@/records/play-record";
import { serializePlayRecordForCopy } from "@/records/play-record-copy";
import type { PlayRecordDefinition } from "@/records/play-record-definition";
import { PlayRecordRow } from "@/records/ui/PlayRecordsScreen/PlayRecordRow";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

const record: PlayRecord = {
  id: "record-1",
  gameId: "test",
  startedAt: 1_000,
  completedAt: 2_000,
  payloadVersion: 1,
  payload: {},
};

const definition = {
  gameId: "test",
  isRecord(candidate: PlayRecord) {
    return candidate.gameId === "test";
  },
  getComparisonKey() {
    return "default";
  },
  personalBestMetrics: [
    {
      id: "score",
      direction: "higher",
      getValue() {
        return 100;
      },
    },
  ],
} as const satisfies PlayRecordDefinition;

const display = createPlayRecordDisplay({
  definition,
  getComparisonLabel() {
    return "テスト";
  },
  metrics: {
    score: {
      label: "スコア",
      historyLabel: "スコア",
      formatValue(value: number) {
        return `${value}点`;
      },
    },
  },
});

describe("PlayRecordRow", () => {
  let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(() => {
    writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <PlayRecordRow
        record={record}
        display={display}
        personalBests={[]}
        onReplay={vi.fn()}
      />,
    );
  });

  afterEach(cleanup);

  test("履歴の再現用JSONをコピーして完了状態を表示すること", async () => {
    fireEvent.click(screen.getByRole("button", { name: "再現用JSONをコピー" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(serializePlayRecordForCopy(record));
    expect(screen.getByRole("button", { name: "コピーしました" })).toBeTruthy();
  });
});
