export function getPlayRecordGridTemplateColumns(
  metricCount: number,
  hasHistoryCopy: boolean,
): string {
  const actionColumnWidth = hasHistoryCopy ? "4.25rem" : "2rem";
  return `4.75rem repeat(${metricCount}, minmax(0, 1fr)) ${actionColumnWidth}`;
}
