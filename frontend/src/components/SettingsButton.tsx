import { Settings } from "lucide-react";
import { useState } from "react";

import { SettingsDialog } from "@/components/SettingsDialog";

/** 設定のダイアログを開く小さなアイコンのボタン。開く操作には音を鳴らさない。 */
export function SettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          aria-label="設定"
          title="設定"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Settings className="size-4.5" aria-hidden="true" />
        </button>
      }
    />
  );
}
