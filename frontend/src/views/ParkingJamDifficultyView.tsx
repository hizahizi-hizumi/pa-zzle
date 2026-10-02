import { HomeBackLink } from "@/components/HomeBackLink";
import { parkingJamDifficulties } from "@/games/parking-jam/difficulty";
import { ParkingJamDifficultyOption } from "@/views/ParkingJamDifficultyView/ParkingJamDifficultyOption";

export function ParkingJamDifficultyView() {
  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <h1 className="text-screen-title">パーキングジャム</h1>
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
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
