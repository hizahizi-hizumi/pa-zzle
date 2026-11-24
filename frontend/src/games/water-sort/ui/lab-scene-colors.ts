/**
 * 理科室の地と飾りの色。壁・窓・試験管立て・実験台・流しの戸棚は、地・盤面の後ろ・遊び方の図と別々の要素に描くので、
 * それぞれの一番外の要素にこのクラスを付けて同じ色を読む。
 * どの色も彩度を低く抑える。試験管の後ろとまわりに来る壁・木・戸棚の色は、明るさを試験管の壁（`GlassFront`）より明るく
 * ガラス（`GlassBack`）より暗い間に収め、試験管の輪郭が地から浮くようにする。試験管より下に置く実験台の縁だけは、盤面の下の端を締めるために暗くする。
 * 実験台の下の戸棚の前の面は、壁と見分けられるよう壁より少しだけ暗くし、その上に置く補助の文字も読める明るさに留める。
 */
export const labSceneColorClassName =
  "[--lab-wall:#e0e6e3] [--lab-cabinet:#d6ddda] [--lab-seam:#c4ccc9] [--lab-handle:#bac3c0] [--lab-frame:#f4f5f2] [--lab-pane:#eaf0f0] [--lab-tree:#dbe3de] " +
  "[--lab-bench:#8d989c] [--lab-wood:#e3d6c1] [--lab-wood-deep:#dacbb1] " +
  "dark:[--lab-wall:#1c2528] dark:[--lab-cabinet:#161e21] dark:[--lab-seam:#0c1214] dark:[--lab-handle:#2a3438] dark:[--lab-frame:#2b3438] dark:[--lab-pane:#222c32] dark:[--lab-tree:#1f292b] " +
  "dark:[--lab-bench:#0e1214] dark:[--lab-wood:#4b4336] dark:[--lab-wood-deep:#3e372c]";
