import { StartConditionOption } from "@/components/StartConditionOption";
import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { ParkingJamDifficultyPreview } from "@/games/parking-jam/ui/ParkingJamDifficultyPreview";
import { Link } from "@/router";

type ParkingJamDifficultyOptionProps = {
  difficulty: ParkingJamDifficulty;
  label: string;
};

export function ParkingJamDifficultyOption({
  difficulty,
  label,
}: ParkingJamDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/parking-jam/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-2xl focus-visible:outline-none"
    >
      <StartConditionOption label={label}>
        <ParkingJamDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
