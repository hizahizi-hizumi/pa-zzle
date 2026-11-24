import { loadFont, textPath } from "./glyphs.mjs";
const f = loadFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf");
console.log("upem", f.upem);
console.log(f.font.glyphToPath(f.font.getNominalGlyph ? 0 : 0).slice(0,40));
console.log(textPath(f, "15", 60, 60, 20, 1490).slice(0, 120));
