import type { CollectionMonth } from "@/features/collection/collection";

export function formatCollectionMonth({
  year,
  month,
}: CollectionMonth): string {
  return `${year}年${month}月`;
}
