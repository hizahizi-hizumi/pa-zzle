import { Eraser, Pencil } from "lucide-react";
import { HowToPlayPressHint } from "@/components/HowToPlayPressHint";

import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import type { NanpureExampleInputAvailability } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import type { NanpureExamplePress } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-hint";
import type { NanpureExampleControl } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { nanpurePressHintPlacement } from "@/games/nanpure/ui/NanpureHowToPlayDialog/press-hint-placement";
import { NANPURE_INPUT_LABELS } from "@/games/nanpure/ui/play/input-labels";
import { NanpureDigitPad } from "@/games/nanpure/ui/play/NanpureDigitPad";
import { PlayActionButton } from "@/games/nanpure/ui/play/PlayActionButton";

type InputControlsProps = {
  controls: readonly NanpureExampleControl[];
  availability: NanpureExampleInputAvailability;
  notesMode: boolean;
  hint: NanpureExamplePress | null;
  onInputDigit: (digit: NanpureDigit) => void;
  onErase: () => void;
  onToggleNotesMode: () => void;
};

/**
 * 例の下に置く、本番の入力の段のボタン。本番と同じ部品と、押せるかの決まりで描く。
 * 段の幅は9マスの盤面と同じにし、消す・メモは本番と同じく段を3つに分けた1つ分の幅にする。
 * 例は1つのボタンだけを置くので、本番の位置（消すは中央、メモは右）に寄せず、どちらも中央に置いて、片側に浮いて見えないようにする。
 */
export function InputControls({
  controls,
  availability,
  notesMode,
  hint,
  onInputDigit,
  onErase,
  onToggleNotesMode,
}: InputControlsProps) {
  const showsErase = controls.includes("erase");
  const showsNotes = controls.includes("notes");
  return (
    <div className="grid w-[calc(9*var(--nanpure-figure-cell)+4px)] gap-2">
      {showsErase || showsNotes ? (
        <div className="grid grid-cols-3">
          {showsErase ? (
            <span className="col-start-2 grid">
              <PlayActionButton
                icon={<Eraser />}
                label={NANPURE_INPUT_LABELS.erase}
                disabled={!availability.canErase}
                overlay={
                  hint?.kind === "erase" ? (
                    <HowToPlayPressHint {...nanpurePressHintPlacement} />
                  ) : null
                }
                onClick={onErase}
              />
            </span>
          ) : null}
          {showsNotes ? (
            <span className="col-start-2 grid">
              <PlayActionButton
                icon={<Pencil />}
                label={NANPURE_INPUT_LABELS.notes}
                active={notesMode}
                overlay={
                  hint?.kind === "notes" ? (
                    <HowToPlayPressHint {...nanpurePressHintPlacement} />
                  ) : null
                }
                onClick={onToggleNotesMode}
              />
            </span>
          ) : null}
        </div>
      ) : null}
      {controls.includes("digits") ? (
        <NanpureDigitPad
          notesMode={notesMode}
          canEnterDigit={availability.canEnterDigit}
          completedDigits={availability.completedDigits}
          size="compact"
          renderDigitOverlay={(digit) =>
            hint?.kind === "digit" && hint.digit === digit ? (
              <HowToPlayPressHint {...nanpurePressHintPlacement} />
            ) : null
          }
          onInputDigit={onInputDigit}
        />
      ) : null}
    </div>
  );
}
