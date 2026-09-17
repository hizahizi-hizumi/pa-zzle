const waterSortColors = [
  { label: "赤", color: "#ef5350" },
  { label: "青", color: "#4d7ee8" },
  { label: "緑", color: "#35b96b" },
  { label: "黄", color: "#f2c94c" },
  { label: "紫", color: "#9b6de3" },
  { label: "橙", color: "#f2994a" },
  { label: "水色", color: "#42b9d3" },
  { label: "桃", color: "#df6ca6" },
  { label: "黄緑", color: "#9fc84a" },
  { label: "紺", color: "#3856a6" },
  { label: "茶", color: "#a96d45" },
  { label: "青緑", color: "#269a91" },
] as const;

export function getWaterColorView(colorIndex: number) {
  const color = waterSortColors[colorIndex];
  if (!color) {
    return {
      label: `色 ${colorIndex + 1}`,
      color: `hsl(${(colorIndex * 47) % 360} 70% 58%)`,
    };
  }

  return color;
}
