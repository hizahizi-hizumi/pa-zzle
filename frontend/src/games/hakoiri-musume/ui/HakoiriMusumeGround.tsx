import { hakoiriMusumeToneClassNames } from "@/games/hakoiri-musume/ui/hakoiri-musume-tone";
import { cn } from "@/lib/utils";

export function HakoiriMusumeGround() {
  return (
    <div
      className={cn("size-full", hakoiriMusumeToneClassNames.tableSurface)}
    />
  );
}
