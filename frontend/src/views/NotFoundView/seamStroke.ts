/**
 * 継ぎ目の線の色。数字・見出し・導線より前へ出ないよう、1px の淡い線にする。
 * - `back`: 絵柄の下に敷く線。白地で目的の濃さになる不透明色にし、濃い字面の上でも線が埋もれないようにする。
 * - `front`: 絵柄の上に重ねる線。同じ色を半透明にし、白地では `back` と同じ見え方のまま、字面の上だけ淡く切れ目を見せる。
 */
export const seamStrokeClassNames = {
  back: "stroke-[color-mix(in_oklab,var(--color-muted-foreground)_20%,var(--color-background))]",
  front:
    "stroke-[color-mix(in_oklab,var(--color-muted-foreground)_20%,var(--color-background))]/40",
} as const;
