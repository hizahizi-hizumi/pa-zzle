type Reagent = {
  name: string;
  color: string;
};

// 並びは色番号（0〜11）。液は色だけで見分けるので、色相に加えて明るさを散らし、
// どの2色も色差（CIEDE2000）が、正常の見え方で20以上、1型・2型・3型の見え方で10以上離れるようにしている。
const reagents: readonly Reagent[] = [
  { name: "赤", color: "#ed0936" },
  { name: "青", color: "#0a71fd" },
  { name: "緑", color: "#01bd6e" },
  { name: "黄", color: "#fec301" },
  { name: "紫", color: "#854aa3" },
  { name: "橙", color: "#fd7204" },
  { name: "水色", color: "#69e8fc" },
  { name: "桃", color: "#dc7bba" },
  { name: "黄緑", color: "#c6f088" },
  { name: "薄紫", color: "#aaa4ff" },
  { name: "薄い灰", color: "#c4c4c4" },
  { name: "青緑", color: "#00948c" },
];

function getReagent(colorIndex: number): Reagent {
  return (
    reagents[colorIndex] ?? {
      name: `色 ${colorIndex + 1}`,
      color: "#8a8f94",
    }
  );
}

export function getReagentName(colorIndex: number): string {
  return getReagent(colorIndex).name;
}

export function getReagentColor(colorIndex: number): string {
  return getReagent(colorIndex).color;
}
