import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";

export function MagicSquareGround() {
  return (
    <div
      className="size-full"
      style={{ backgroundColor: magicSquareTone.ground }}
    />
  );
}
