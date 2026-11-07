import { useState, useSyncExternalStore } from "react";

import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { randomProblemUnavailable } from "@/lib/random-problem-unavailable";

/** 出題条件に該当する別問が無いとき、条件を変えずに設定へ誘導する。 */
export function RandomProblemUnavailableDialog() {
  const notice = useSyncExternalStore(
    randomProblemUnavailable.subscribe,
    randomProblemUnavailable.getSnapshot,
    randomProblemUnavailable.getSnapshot,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGameId, setSettingsGameId] = useState<string | undefined>();

  return (
    <>
      <Dialog
        open={notice !== null}
        onOpenChange={(open) => {
          if (!open) randomProblemUnavailable.dismiss();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>条件に合う別の問題がありません</DialogTitle>
            <DialogDescription>
              {notice?.gameName}
              の選択中の難易度には、出題設定に該当する別の問題がありません。設定で出題対象を変更できます。
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            onClick={() => {
              setSettingsGameId(notice?.gameId);
              randomProblemUnavailable.dismiss();
              setSettingsOpen(true);
            }}
          >
            出題設定を開く
          </Button>
        </DialogContent>
      </Dialog>
      <SettingsDialog
        key={settingsGameId ?? "global"}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialPanel="random"
        initialGameId={settingsGameId}
      />
    </>
  );
}
