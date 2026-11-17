import {
  VIOLATION_MARK_DELAY_MS,
  violationMarkTimingClassName,
} from "@/games/takuzu/ui/board/violation-mark-timing";

describe("violationMarkTimingClassName", () => {
  test("違反の印を、印に添える言葉と同じ時間だけ待ってから出すこと", () => {
    const className = violationMarkTimingClassName;

    expect(className).toContain(
      `group-data-violated:delay-[${VIOLATION_MARK_DELAY_MS}ms]`,
    );
  });
});
