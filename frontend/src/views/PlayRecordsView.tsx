import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation } from "react-router";
import { CollectionScreen } from "@/collection/ui/CollectionScreen";
import { HomeBackLink } from "@/components/HomeBackLink";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createGameNavigation } from "@/game-catalog/game-navigation";
import {
  describePlayTimelineEntry,
  findPlayTimelineEntryDestination,
  listCatalogPlayTimelineEntries,
} from "@/game-catalog/play-timeline";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import {
  createPlayRecordsLocationState,
  readPlayRecordsLocationState,
} from "@/records/play-records-location-state";
import type { PlayTimelineEntry } from "@/records/play-timeline";
import { readPlayRecords } from "@/records/storage";
import {
  INITIAL_SHOWN_ENTRY_COUNT,
  PlayRecordsScreen,
} from "@/records/ui/PlayRecordsScreen";
import { Link, useNavigate } from "@/router";

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());
  const [now] = useState(() => Date.now());
  // 直前のプレイ画面の離脱は、この画面を描画したあとに保存されるので、保存へ追従する。
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const entries = useMemo(
    () => listCatalogPlayTimelineEntries(records, attempts),
    [records, attempts],
  );
  const navigate = useNavigate();
  const locationState = useLocation().state;
  // 一覧から開いたプレイから戻ったときは、一覧を同じ所まで描き、同じ位置へ戻す。
  const [returnedPosition] = useState(() =>
    readPlayRecordsLocationState(locationState),
  );
  const [shownEntryCount, setShownEntryCount] = useState(
    returnedPosition?.shownEntryCount ?? INITIAL_SHOWN_ENTRY_COUNT,
  );
  // 描き足すたびに行の操作を作り直して全行を描き直さないよう、開くときに読む数は ref でも持つ。
  const shownEntryCountRef = useRef(shownEntryCount);

  useLayoutEffect(() => {
    if (returnedPosition !== null) {
      window.scrollTo(0, returnedPosition.scrollY);
    }
  }, [returnedPosition]);

  const changeShownEntryCount = useCallback((count: number) => {
    shownEntryCountRef.current = count;
    setShownEntryCount(count);
  }, []);

  const openEntry = useCallback(
    (entry: PlayTimelineEntry) => {
      navigate("/records", {
        replace: true,
        state: createPlayRecordsLocationState(
          shownEntryCountRef.current,
          window.scrollY,
        ),
      });
      const destination = findPlayTimelineEntryDestination(entry);
      if (destination.kind === "result") {
        navigate("/puzzles/:game/result/:recordId", {
          params: {
            game: destination.game.id,
            recordId: destination.record.id,
          },
        });
        return;
      }
      createGameNavigation(navigate, destination.game).openGameHome(
        destination.problemId,
      );
    },
    [navigate],
  );

  return (
    <section className="mx-auto w-full max-w-5xl">
      <HomeBackLink />
      <header className="mt-2 mb-4">
        <h1 className="text-screen-title">記録</h1>
      </header>
      <Tabs defaultValue={returnedPosition ? "history" : "collection"}>
        <div>
          <TabsList>
            <TabsTrigger value="collection">コレクション</TabsTrigger>
            <TabsTrigger value="history">プレイ履歴</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="collection">
          <CollectionScreen records={records} now={now} />
        </TabsContent>
        <div className="max-w-3xl">
          <TabsContent value="history">
            <PlayRecordsScreen
              newestFirstEntries={entries}
              now={now}
              describeEntry={describePlayTimelineEntry}
              onOpenEntry={openEntry}
              shownEntryCount={shownEntryCount}
              onShownEntryCountChange={changeShownEntryCount}
              emptyAction={<Link to="/">パズルを選ぶ</Link>}
              showHeading={false}
            />
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
