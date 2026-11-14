import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type RandomProblemStatus,
  randomProblemSettings,
  randomProblemStatuses,
} from "@/features/random-play/random-problem-settings";
import { useGameCatalog } from "@/features/settings/GameCatalogContext";
import { RandomProblemStatusChecklist } from "@/features/settings/SettingsDialog/RandomProblemStatusChecklist";

type RandomProblemSettingsPanelProps = {
  initialGameId?: string;
};

export function RandomProblemSettingsPanel({
  initialGameId,
}: RandomProblemSettingsPanelProps) {
  const [scope, setScope] = useState(initialGameId ?? "global");
  const gameCatalog = useGameCatalog();
  const settings = useSyncExternalStore(
    randomProblemSettings.subscribe,
    randomProblemSettings.getSnapshot,
    randomProblemSettings.getSnapshot,
  );
  const isGlobal = scope === "global";
  const custom = !isGlobal && Object.hasOwn(settings.overrides, scope);
  const selected =
    (custom ? settings.overrides[scope] : settings.global) ?? settings.global;

  function changeStatuses(statuses: readonly RandomProblemStatus[]): void {
    if (isGlobal) randomProblemSettings.setGlobal(statuses);
    else randomProblemSettings.setGame(scope, statuses);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="random-problem-scope"
          className="shrink-0 text-supporting font-medium"
        >
          適用先
        </label>
        <NativeSelect
          id="random-problem-scope"
          className="min-w-0 max-w-52 flex-1"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <NativeSelectOption value="global">全パズル</NativeSelectOption>
          {gameCatalog.map((game) => (
            <NativeSelectOption key={game.id} value={game.id}>
              {game.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <span className="text-supporting font-medium">出題対象</span>
          <div className="flex items-center gap-1">
            {custom && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-1.5"
                onClick={() => randomProblemSettings.clearGame(scope)}
              >
                共通に戻す
              </Button>
            )}
            {selected.length < randomProblemStatuses.length && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-1.5"
                onClick={() => changeStatuses(randomProblemStatuses)}
              >
                すべて選択
              </Button>
            )}
          </div>
        </div>
        <RandomProblemStatusChecklist
          selected={selected}
          onChange={changeStatuses}
        />
      </div>
    </div>
  );
}
