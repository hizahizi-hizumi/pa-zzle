export type SeparationNoticeLines = {
  situation: string;
  rule: string;
};

export function getSeparationNoticeLines(
  groupCount: number,
): SeparationNoticeLines {
  return {
    situation: `島が${groupCount}組に分かれています`,
    rule: "全部の島を1つにつなげます",
  };
}
