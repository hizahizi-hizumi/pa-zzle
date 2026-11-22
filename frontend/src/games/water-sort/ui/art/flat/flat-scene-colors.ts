/**
 * フラットの絵の色。部材ごとに平らな色を1〜2色だけ持つ。
 * 地・試験管立て・試験管が別々の要素に描かれるので、それぞれの一番外の要素にこのクラスを付けて同じ色を読む。
 */
export const flatSceneColorClassName =
  "[--flat-wall:#d3dcd3] [--flat-seam:#bfc9bf] [--flat-frame:#f1efe8] [--flat-sky:#c4dbdc] [--flat-tree:#a8c6b2] " +
  "[--flat-bench:#272c2f] [--flat-wood:#d9aa6b] [--flat-wood-deep:#b9874d] [--flat-metal:#8e999d] [--flat-handle:#a4aeac] [--flat-rubber:#b4523c] " +
  "dark:[--flat-wall:#192124] dark:[--flat-seam:#10161a] dark:[--flat-frame:#2b3338] dark:[--flat-sky:#28304a] dark:[--flat-tree:#181d2a] " +
  "dark:[--flat-bench:#0b0d0f] dark:[--flat-wood:#94704a] dark:[--flat-wood-deep:#6e5235] dark:[--flat-metal:#6c777c] dark:[--flat-handle:#3c4549] dark:[--flat-rubber:#953f2e]";
