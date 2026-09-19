const waterSortColors = [
  { name: "赤", color: "#d86a68" },
  { name: "青", color: "#4a67e8" },
  { name: "緑", color: "#43b85a" },
  { name: "黄", color: "#f2cf4a" },
  { name: "紫", color: "#a85cd6" },
  { name: "橙", color: "#f0a24c" },
  { name: "水色", color: "#72d3ec" },
  { name: "桃", color: "#e86cab" },
  { name: "黄緑", color: "#b7d34a" },
  { name: "薄紫", color: "#bd9dfc" },
  { name: "薄い灰", color: "#bcc6d3" },
  { name: "青緑", color: "#4aa7b5" },
] as const;

export function getWaterColorView(colorIndex: number) {
  const color = waterSortColors[colorIndex];
  if (!color) {
    return {
      name: `色 ${colorIndex + 1}`,
      color: `hsl(${(colorIndex * 47) % 360} 70% 58%)`,
    };
  }

  return color;
}
