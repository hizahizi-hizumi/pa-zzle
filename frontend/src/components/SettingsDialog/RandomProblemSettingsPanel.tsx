import { useState, useSyncExternalStore } from "react";
import { useRandomProblemGameOptions } from "@/components/RandomProblemGameOptionsContext";
import { RandomProblemStatusChecklist } from "@/components/SettingsDialog/RandomProblemStatusChecklist";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type RandomProblemStatus,
  randomProblemSettings,
} from "@/lib/random-problem-settings";

type RandomProblemSettingsPanelProps = {
  initialGameId?: string;
};

/** 共通設定を初期表示し、必要なゲームだけ例外へ切り替えて編集する。 */
export function RandomProblemSettingsPanel({
  initialGameId,
}: RandomProblemSettingsPanelProps) {
  const [scope, setScope] = useState(initialGameId ?? "global");
  const gameCatalog = useRandomProblemGameOptions();
  const settings = useSyncExternalStore(
    randomProblemSettings.subscribe,
    randomProblemSettings.getSnapshot,
    randomProblemSettings.getSnapshot,
  );
  const isGlobal = scope === "global";
  const custom = !isGlobal && Object.hasOwn(settings.overrides, scope);
  const selected =
    (custom ? settings.overrides[scope] : settings.global) ?? settings.global;
  const gameName =
    gameCatalog.find((game) => game.id === scope)?.name ?? "このゲーム";

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
          <NativeSelectOption value="global">全ゲーム共通</NativeSelectOption>
          {gameCatalog.map((game) => (
            <NativeSelectOption key={game.id} value={game.id}>
              {game.name}
              {Object.hasOwn(settings.overrides, game.id) ? "（個別設定）" : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {!isGlobal && !custom ? (
        <div className="grid gap-3 border-t border-border pt-4">
          <p className="text-supporting text-muted-foreground">
            {gameName}は全ゲーム共通の出題対象を使用しています。
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              randomProblemSettings.setGame(scope, settings.global)
            }
          >
            このゲームだけ出題対象を変更
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {custom && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-supporting text-muted-foreground">
                {gameName}の個別設定
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => randomProblemSettings.clearGame(scope)}
              >
                共通に戻す
              </Button>
            </div>
          )}
          <RandomProblemStatusChecklist
            selected={selected}
            onChange={changeStatuses}
          />
        </div>
      )}
    </div>
  );
}
