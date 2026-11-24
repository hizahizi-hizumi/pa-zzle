/** `items` の並びを輪とみなして、`selectedIndex` のものから近い順に並べる。カルーセルの両隣から先に用意するのに使う。 */
export function orderFromSelected<T>(
  items: readonly T[],
  selectedIndex: number,
): T[] {
  return items
    .map((item, index) => {
      const distance = Math.abs(index - selectedIndex);
      return { item, distance: Math.min(distance, items.length - distance) };
    })
    .sort((a, b) => a.distance - b.distance)
    .map(({ item }) => item);
}
