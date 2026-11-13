import { Fragment } from "react";

// `budoux` の入口から読むと HTML を扱う部品（linkedom）まで束に入るので、文節に分ける部品と日本語のモデルだけを直接読む。
// パッケージの exports に無い場所なので、相対パスで指す。
// biome-ignore lint/style/noRestrictedImports: 上の理由で、パッケージの中のファイルを相対パスで読む。
import { model } from "../../node_modules/budoux/module/data/models/ja.js";
// biome-ignore lint/style/noRestrictedImports: 同上。
import { Parser } from "../../node_modules/budoux/module/parser.js";

type PhrasedTextProps = {
  /** 表示する文。`\n` は改行として残す。 */
  text: string;
};

const parser = new Parser(model);

/**
 * 日本語の文を、文節の切れ目でだけ折り返せるようにして描く。
 * CSS の `word-break: auto-phrase` は iOS の Safari に無く、そのままでは「同／じ色」のように語の途中で折り返す。
 * 文節の間に `<wbr>` を挟み、親の要素に `word-break: keep-all` を付けることで、どのブラウザでも文節の切れ目で折り返す。
 * 文字は同じ要素の中に並べるので、要素の文字としては元の文のまま読める。
 */
export function PhrasedText({ text }: PhrasedTextProps) {
  const phrases = parser.parse(text);
  return (
    <>
      {phrases.map((phrase, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 文節は並び順でしか区別できず、同じ文節が2度出ることがある。
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {phrase}
        </Fragment>
      ))}
    </>
  );
}
