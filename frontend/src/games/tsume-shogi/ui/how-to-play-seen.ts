import { createHowToPlaySeenStore } from "@/components/how-to-play-seen";

export const {
  read: readTsumeShogiHowToPlaySeen,
  write: writeTsumeShogiHowToPlaySeen,
} = createHowToPlaySeenStore("tsume-shogi");
