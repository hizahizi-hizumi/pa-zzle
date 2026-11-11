import { createHakoiriMusumePlayAttemptProgress } from "@/games/hakoiri-musume/play-attempt";
import { parseHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";
import {
  createHakoiriMusumeSession,
  moveHakoiriMusumeSessionPiece,
  undoHakoiriMusumeSession,
} from "@/games/hakoiri-musume/session/session";

describe("createHakoiriMusumePlayAttemptProgress", () => {
  const started = createHakoiriMusumeSession(
    { pieces: parseHakoiriMusumeBoard("vAAvwAAwv..vwhiws..s")! },
    1_000,
  );
  const session = undoHakoiriMusumeSession(
    moveHakoiriMusumeSessionPiece(started, 6, "right", 2_000).session,
  );

  test("離れた時点までの時間と手数・待った・盤面を戻した回数を写すこと", () => {
    const progress = createHakoiriMusumePlayAttemptProgress(session, 31_000);

    expect(progress).toEqual({
      elapsedMs: 30_000,
      moveCount: 1,
      undoCount: 1,
      restartCount: 0,
    });
  });
});
