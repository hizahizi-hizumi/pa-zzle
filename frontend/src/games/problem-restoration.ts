/**
 * 記録や URL など外から来た identity で問題を復元する。
 * 生成器は復元できない identity を例外で拒否するので、ここで「復元できない」という値に変える。
 */
export function restoreProblemOrNull<Problem>(
  restore: () => Problem,
): Problem | null {
  try {
    return restore();
  } catch {
    return null;
  }
}
