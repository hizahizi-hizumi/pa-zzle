import { Navigate } from "@/router";

export default function TsumeShogiDifficultyRedirect() {
  return (
    <Navigate
      to="/puzzles/tsume-shogi/play/:difficulty"
      params={{ difficulty: "1" }}
      replace
    />
  );
}
