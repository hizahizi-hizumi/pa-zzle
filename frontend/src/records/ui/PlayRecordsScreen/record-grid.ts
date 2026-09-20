export function getPlayRecordGridTemplateColumns(metricCount: number): string {
  return `4.75rem repeat(${metricCount}, minmax(0, 1fr)) 2rem`;
}
