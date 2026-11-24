/**
 * 紙に鉛筆で書く筆算を題材にした色。色は役割ごとに1つにし、同じ意味の所で使い回す。
 * - 地は方眼のある紙。式の文字と罫線は鉛筆の黒鉛の色で書く。
 * - 札は紙より明るい厚紙の面に濃い数字を刷る。式の文字に入れた札も、列にある札と同じ面と数字にする。
 * - 選んでいる文字と札は、青鉛筆の色の輪郭で示す。
 * - 知らせ（先頭の0・計算違い）は赤鉛筆の色にする。× と残りの候補の数はメモなので、知らせと紛れない黒鉛の色で書く。
 *   × は札の数字の後ろに、数字より淡い黒鉛の色で書き、数字を潰さない。
 */
export const fukumenzanToneClassNames = {
  paper: "bg-[#f3efe4] dark:bg-[#202328]",
  paperRule: "stroke-[#ddd5c1] dark:stroke-[#2e3238]",
  ink: "text-[#3b3933] dark:text-[#d9d4c7]",
  inkLine: "bg-[#3b3933] dark:bg-[#d9d4c7]",
  cardFace:
    "bg-[#fffdf7] border-[#b4aa8f] text-[#24221d] dark:bg-[#3a3e46] dark:border-[#646a75] dark:text-[#f3efe5]",
  cardSlot: "border-[#c9c0a8] dark:border-[#3f444c]",
  selection: "outline-[#2f6fb3] dark:outline-[#86b8ee]",
  notice: "text-[#c22f3a] dark:text-[#ff8080]",
  noticeFill: "bg-[#c22f3a]/15 dark:bg-[#ff8080]/20",
  noticeLine: "bg-[#c22f3a] dark:bg-[#ff8080]",
  cross: "stroke-[#8c8677] dark:stroke-[#8f8b80]",
  candidateCount:
    "border-[#8c8677] text-[#5d5a51] dark:border-[#8f8b80] dark:text-[#bdb8ab]",
} as const;
