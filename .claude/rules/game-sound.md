---
paths:
  - "frontend/src/games/*/ui/**/*sound*.ts"
  - "frontend/src/games/*/ui/*{Play,Tutorial}.tsx"
  - "frontend/src/games/*/assets/**/*.{flac,mp3,ogg,opus,wav,m4a,aac,webm}"
  - "scripts/assets/*_sounds.{py,ts}"
  - "!**/*.test.ts"
---

# ゲームの効果音

## 効果音

- 効果音の音と鳴らす時を決めるときは `DESIGN.md` の「音」を読む
- ゲームの音声ファイルは FLAC にする
- 効果音は `frontend/src/lib/sound-effects.ts` の `playSound` か `playLayeredSound` で鳴らす
- 盤面操作の音は `frontend/src/games/play-sound-effects.ts` の `useOperationSound` で鳴らす
- クリア音は `frontend/src/games/play-sound-effects.ts` の `useClearSound` で鳴らす
- 決定音は `frontend/src/components/app-decision-sound.ts` に任せる
- BGM は、プレイ中も `frontend/src/components/app-background-music.ts` に任せる
