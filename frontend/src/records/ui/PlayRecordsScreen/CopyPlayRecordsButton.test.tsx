import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type { PlayRecord } from "@/records/play-record";
import { serializePlayRecordsForCopy } from "@/records/play-record-copy";
import { CopyPlayRecordsButton } from "@/records/ui/PlayRecordsScreen/CopyPlayRecordsButton";

const records: PlayRecord[] = [
  {
    id: "record-1",
    gameId: "test",
    startedAt: 1_000,
    completedAt: 2_000,
    payloadVersion: 1,
    payload: {},
  },
];

describe("CopyPlayRecordsButton", () => {
  let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

  beforeEach(() => {
    writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CopyPlayRecordsButton records={records} />);
  });

  afterEach(cleanup);

  test("一覧の記録をJSONでコピーして完了状態を表示すること", async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "一覧の記録をJSONでコピー" }),
    );

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText).toHaveBeenCalledWith(
      serializePlayRecordsForCopy(records),
    );
    expect(screen.getByRole("button", { name: "コピーしました" })).toBeTruthy();
  });
});
