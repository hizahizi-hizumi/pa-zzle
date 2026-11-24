/** どの手順でも今より多くの札を組札に置けないことの知らせの言葉。遊び方の説明も、この言葉にそろえる。 */
export const SOLITAIRE_STUCK_NOTICE_LABEL = "組札へ運べない";

/**
 * 状態の知らせ。下の帯の、待ったの丸の左に1行で出す。
 * 戻る操作は、待ったの丸と見出しのメニューの盤面を戻すを使い、知らせの中には並べない。
 */
export function SolitaireStuckNotice() {
  return (
    <p role="status" className="whitespace-nowrap text-play-context">
      {SOLITAIRE_STUCK_NOTICE_LABEL}
    </p>
  );
}
