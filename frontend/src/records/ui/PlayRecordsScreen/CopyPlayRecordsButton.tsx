import { Check, Clipboard } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlayRecord } from "@/records/play-record";
import { serializePlayRecordsForCopy } from "@/records/play-record-copy";

type CopyState = "idle" | "copied" | "failed";

type CopyPlayRecordsButtonProps = {
  records: readonly PlayRecord[];
  label: string;
};

export function CopyPlayRecordsButton({
  records,
  label: idleLabel,
}: CopyPlayRecordsButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyRecords() {
    try {
      await navigator.clipboard.writeText(serializePlayRecordsForCopy(records));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("failed");
    }
  }

  const label =
    copyState === "copied"
      ? "コピーしました"
      : copyState === "failed"
        ? "コピーできませんでした"
        : idleLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={copyRecords}
    >
      {copyState === "copied" ? <Check /> : <Clipboard />}
    </Button>
  );
}
