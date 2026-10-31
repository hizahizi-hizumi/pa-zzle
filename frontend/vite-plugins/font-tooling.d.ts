declare module "subset-font" {
  type SubsetFontOptions = {
    targetFormat?: "sfnt" | "woff" | "woff2";
  };

  // biome-ignore lint/style/noDefaultExport: subset-font は default export だけを公開している。
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: SubsetFontOptions,
  ): Promise<Buffer>;
}

declare module "fontverter" {
  export function convert(
    font: Uint8Array,
    toFormat: "sfnt" | "woff" | "woff2",
  ): Promise<Buffer>;
}
