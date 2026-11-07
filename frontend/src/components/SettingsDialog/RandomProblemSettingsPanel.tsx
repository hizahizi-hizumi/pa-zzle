import { useState, useSyncExternalStore } from "react";
import { useRandomProblemGameOptions } from "@/components/RandomProblemGameOptionsContext";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  type RandomProblemStatus,
  randomProblemSettings,
  randomProblemStatuses,
} from "@/lib/random-problem-settings";

type RandomProblemSettingsPanelProps = {
  initialGameId?: string;
};

const statusLabels: Record<
  RandomProblemStatus,
  { name: string; detail: string }
> = {
  untouched: { name: "未挑戦", detail: "挑戦した記録がない" },
  attempted: { name: "挑戦中", detail: "まだクリアしていない" },
  clear: { name: "clear", detail: "80点未満" },
  good: { name: "good", detail: "80〜89点" },
  great: { name: "great", detail: "90〜99点" },
  perfect: { name: "perfect", detail: "100点" },
};

/** 共通の出題対象を基本とし、必要なゲームだけ独立した条件を保存する。 */
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

  function changeStatus(status: RandomProblemStatus, checked: boolean): void {
    const next = checked
      ? [...selected, status]
      : selected.filter((item) => item !== status);
    if (isGlobal) randomProblemSettings.setGlobal(next);
    else randomProblemSettings.setGame(scope, next);
  }

  return (
    <div className="grid gap-4">
      <p className="text-supporting text-muted-foreground">
        チェックした状態の問題からランダムに出題します。評価は問題ごとの最高スコアです。
      </p>
      <div className="grid gap-2">
        <label
          htmlFor="random-problem-scope"
          className="text-supporting font-medium"
        >
          設定するゲーム
        </label>
        <NativeSelect
          id="random-problem-scope"
          className="w-full"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <NativeSelectOption value="global">全ゲーム共通</NativeSelectOption>
          {gameCatalog.map((game) => (
            <NativeSelectOption key={game.id} value={game.id}>
              {game.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {!isGlobal && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
          <p className="text-supporting text-muted-foreground">
            {custom
              ? "このゲーム固有の設定を使用中"
              : "全ゲーム共通の設定を使用中"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (custom) randomProblemSettings.clearGame(scope);
              else randomProblemSettings.setGame(scope, settings.global);
            }}
          >
            {custom ? "共通に戻す" : "個別に設定"}
          </Button>
        </div>
      )}
      <fieldset
        disabled={!isGlobal && !custom}
        className="grid gap-2 disabled:opacity-60"
      >
        <legend className="mb-2 text-supporting font-medium">出題対象</legend>
        <div className="grid grid-cols-2 gap-2">
          {randomProblemStatuses.map((status) => {
            const checked = selected.includes(status);
            const label = statusLabels[status];
            return (
              <label
                key={status}
                className="flex items-start gap-2 rounded-md border border-border p-2.5 text-supporting"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={checked}
                  disabled={checked && selected.length === 1}
                  onChange={(event) =>
                    changeStatus(status, event.target.checked)
                  }
                />
                <span className="grid gap-0.5">
                  <span className="font-medium">{label.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {label.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {selected.length}種類を選択中。候補がないときは出題しません。
        </p>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={!isGlobal && !custom}
          onClick={() => {
            if (isGlobal)
              randomProblemSettings.setGlobal(randomProblemStatuses);
            else randomProblemSettings.setGame(scope, randomProblemStatuses);
          }}
        >
          すべて選択
        </Button>
      </div>
    </div>
  );
}
