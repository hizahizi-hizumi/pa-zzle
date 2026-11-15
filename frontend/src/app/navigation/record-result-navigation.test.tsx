import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import { useRecordResultNavigation } from "@/app/navigation/record-result-navigation";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordSaveOutcome } from "@/features/records/save-play-record";

const playPath = "/puzzles/test-game/play/test-problem";
const record: PlayRecord = {
  id: "record-1",
  gameId: "test-game",
  startedAt: 1_000,
  completedAt: 2_000,
  payloadVersion: 1,
  payload: {},
};
const recordedOutcome: PlayRecordSaveOutcome = { status: "first-record" };
const failedOutcome: PlayRecordSaveOutcome = { status: "failed" };

type RouterWrapperProps = { children: ReactNode };

function RouterWrapper({ children }: RouterWrapperProps) {
  return <MemoryRouter initialEntries={[playPath]}>{children}</MemoryRouter>;
}

function useNavigatedLocation(
  resultReached: boolean,
  playRecord: PlayRecord | null,
  recordOutcome: PlayRecordSaveOutcome | null,
) {
  const navigatesToRecordResult = useRecordResultNavigation(
    resultReached,
    playRecord,
    recordOutcome,
  );
  return {
    navigatesToRecordResult,
    location: useLocation(),
    navigationType: useNavigationType(),
  };
}

describe("useRecordResultNavigation", () => {
  describe("クリアして記録を保存できた場合", () => {
    test("記録の結果画面へ保存結果を state に付けて履歴を置き換えて遷移すること", () => {
      const { result } = renderHook(
        () => useNavigatedLocation(true, record, recordedOutcome),
        { wrapper: RouterWrapper },
      );

      expect(result.current.navigatesToRecordResult).toBe(true);
      expect(result.current.location.pathname).toBe(
        "/puzzles/test-game/result/record-1",
      );
      expect(result.current.location.state).toEqual({
        recordSaveOutcome: recordedOutcome,
      });
      expect(result.current.navigationType).toBe("REPLACE");
    });
  });

  describe("クリアして保存結果が決まる前の場合", () => {
    test("遷移を待ち、プレイ画面に留まること", () => {
      const { result } = renderHook(
        () => useNavigatedLocation(true, record, null),
        { wrapper: RouterWrapper },
      );

      expect(result.current.navigatesToRecordResult).toBe(true);
      expect(result.current.location.pathname).toBe(playPath);
    });
  });

  describe("記録の保存に失敗した場合", () => {
    test("保存できなかった結果を履歴に渡して同じ結果画面へ遷移すること", () => {
      const { result } = renderHook(
        () => useNavigatedLocation(true, record, failedOutcome),
        { wrapper: RouterWrapper },
      );

      expect(result.current.navigatesToRecordResult).toBe(true);
      expect(result.current.location.pathname).toBe(
        "/puzzles/test-game/result/record-1",
      );
      expect(result.current.location.state).toEqual({
        recordSaveOutcome: { status: "failed" },
        unsavedRecord: record,
      });
    });
  });

  const stayingCases = [["クリアしていない", false, record, null]] as const;

  test.each(stayingCases)(
    "%sプレイでは遷移せず、プレイ画面で結果を出させること",
    (_, resultReached, playRecord, recordOutcome) => {
      const { result } = renderHook(
        () => useNavigatedLocation(resultReached, playRecord, recordOutcome),
        { wrapper: RouterWrapper },
      );

      expect(result.current.navigatesToRecordResult).toBe(false);
      expect(result.current.location.pathname).toBe(playPath);
    },
  );
});
