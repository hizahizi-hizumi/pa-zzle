const waterSortColors = [
  { name: "赤", color: "#ef5350" },
  { name: "青", color: "#4d7ee8" },
  { name: "緑", color: "#35b96b" },
  { name: "黄", color: "#f2c94c" },
  { name: "紫", color: "#9b6de3" },
  { name: "橙", color: "#f2994a" },
  { name: "水色", color: "#42b9d3" },
  { name: "桃", color: "#df6ca6" },
  { name: "黄緑", color: "#9fc84a" },
  { name: "紺", color: "#3856a6" },
  { name: "茶", color: "#a96d45" },
  { name: "青緑", color: "#269a91" },
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
