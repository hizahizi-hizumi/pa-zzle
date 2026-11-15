import { Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/features/settings/SettingsDialog";

type SettingsButtonProps = {
  initialGameId?: string;
};

export function SettingsButton({ initialGameId }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsDialog
      open={open}
      onOpenChange={setOpen}
      initialGameId={initialGameId}
      trigger={
        <Button
          type="button"
          variant="bare"
          size="icon"
          aria-label="設定"
          title="設定"
        >
          <Settings className="size-4.5" aria-hidden="true" />
        </Button>
      }
    />
  );
}
