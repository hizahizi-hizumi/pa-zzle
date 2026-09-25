import { Navigate } from "@/router";

export default function TakuzuDifficultyRedirect() {
  return (
    <Navigate
      to="/puzzles/takuzu/play/:difficulty"
      params={{ difficulty: "1" }}
      replace
    />
  );
}
