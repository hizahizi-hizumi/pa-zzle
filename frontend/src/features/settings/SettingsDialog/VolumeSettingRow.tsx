import type { LucideIcon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MAX_VOLUME } from "@/lib/audio/stored-volume-setting";

const VOLUME_STEP = 1;

type VolumeSettingRowProps = {
  label: string;
  volume: number;
  icon: LucideIcon;
  mutedIcon: LucideIcon;
  /** スライダーを動かしている間、動かした先の音量を渡す。 */
  onChange: (volume: number) => void;
  /** スライダーを離したときや、キーで動かしたときに、選び終えた音量を渡す。 */
  onCommit: (volume: number) => void;
  onToggleMuted: () => void;
};

export function VolumeSettingRow({
  label,
  volume,
  icon: Icon,
  mutedIcon: MutedIcon,
  onChange,
  onCommit,
  onToggleMuted,
}: VolumeSettingRowProps) {
  const labelId = useId();
  const muted = volume === 0;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex items-center gap-2"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={`${label}を消音`}
        aria-pressed={muted}
        onClick={onToggleMuted}
      >
        {muted ? <MutedIcon /> : <Icon />}
      </Button>
      <div className="grid min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span id={labelId} className="text-supporting font-medium">
            {label}
          </span>
          <span className="text-supporting text-muted-foreground tabular-nums">
            {volume}
          </span>
        </div>
        <Slider
          value={[volume]}
          max={MAX_VOLUME}
          step={VOLUME_STEP}
          onValueChange={([next]) => onChange(next ?? volume)}
          onValueCommit={([next]) => onCommit(next ?? volume)}
          className="h-8"
        />
      </div>
    </div>
  );
}
