export function escapeTableCell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderTableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}
