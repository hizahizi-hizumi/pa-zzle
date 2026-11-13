import { lazy, Suspense } from "react";

import { useParams } from "@/router";
import { NotFoundView } from "@/views/NotFoundView";

/** 開発時だけ読み込む試遊。本番のビルドでは読み込まず、試遊用の問題も含めない。 */
const HakoiriMusumePlaytest = import.meta.env.DEV
  ? lazy(async () => ({
      default: (
        await import("@/game-catalog/hakoiri-musume/HakoiriMusumePlaytest")
      ).HakoiriMusumePlaytest,
    }))
  : null;

/** 盤の作りを広げた箱入り娘の試遊用の問題を遊ぶ、開発時だけの画面。本番では見つからない画面にする。 */
export function HakoiriMusumePlaytestView() {
  const { problem } = useParams("/puzzles/hakoiri-musume/playtest/:problem");

  if (!HakoiriMusumePlaytest) {
    return <NotFoundView />;
  }

  return (
    <Suspense>
      <HakoiriMusumePlaytest problemId={problem} />
    </Suspense>
  );
}
