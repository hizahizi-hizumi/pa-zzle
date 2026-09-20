import { parkingJamDifficulties } from "@/games/parking-jam/difficulty";
import { Link } from "@/router";
import { ParkingJamDifficultyOption } from "@/views/ParkingJamDifficultyView/ParkingJamDifficultyOption";

export function ParkingJamDifficultyView() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">パーキングジャム</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {parkingJamDifficulties.map((difficulty) => (
          <ParkingJamDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
