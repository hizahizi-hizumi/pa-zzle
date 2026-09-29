import { Navigate } from "@/router";

export default function ReflectionDifficultyRedirect() {
  return (
    <Navigate
      to="/puzzles/reflection/play/:difficulty"
      params={{ difficulty: "1" }}
      replace
    />
  );
}
