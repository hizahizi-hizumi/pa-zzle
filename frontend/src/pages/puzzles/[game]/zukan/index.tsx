import { Navigate } from "react-router";

import { useParams } from "@/router";

// 図鑑はゲームのホームにあるので、図鑑の URL はそのゲームのホームへ移す。今のアプリに無いゲームは、移った先で見つからない画面になる。
export default function GameZukanRedirect() {
  const { game } = useParams("/puzzles/:game/zukan");
  return <Navigate to={`/puzzles/${game}`} replace />;
}
