import type { Dispatch } from "react";

import type { SettingsAction, SettingsState } from "./settings-reducer";

type SettingsPanelProps = {
  settings: SettingsState;
  dispatch: Dispatch<SettingsAction>;
};

export function SettingsPanel({ settings, dispatch }: SettingsPanelProps) {
  return (
    <label>
      効果音
      <input
        type="checkbox"
        checked={settings.soundEnabled}
        onChange={(event) =>
          dispatch({ type: "patch", patch: { soundEnabled: event.target.checked } })
        }
      />
    </label>
  );
}
