import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";
import type { Plugin, Rolldown } from "vite";

const FONT_WEIGHTS = [400, 500, 700] as const;
const FONTSOURCE_PACKAGE = "@fontsource/zen-kaku-gothic-new";
const PRINTABLE_ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, offset) =>
  String.fromCodePoint(0x20 + offset),
).join("");
const TEXT_SOURCE_DIR = "src";
const TEXT_SOURCE_EXTENSION_PATTERN = /\.tsx?$/;
const TEST_SOURCE_PATTERN = /\.(test|spec)\.tsx?$/;
const HTML_ENTRY = "index.html";
const COMMENT_LINE_PATTERN = /^\s*(\/\/|\/\*|\*)/;
const MANIFEST_FILE = "manifest.json";
const STYLESHEET_FILE = "ui-font.css";

type UiFontSubsetOptions = {
  /** 文字を集めるソースの起点。 */
  root: string;
  /** 生成したフォントと `ui-font.css` を置くディレクトリ。 */
  outputDir: string;
  /** 生成するフォントのファミリー名。`--font-ui` の先頭に置く名前と一致させる。 */
  fontFamily: string;
};

type FontFile = {
  fileName: string;
  weight: number;
};

type Manifest = {
  key: string;
  files: FontFile[];
};

/**
 * UI書体 Zen Kaku Gothic New から、アプリのソースに現れる文字だけを切り出した
 * フォントを生成し、`index.html` で preload する。
 *
 * Fontsource の unicode-range 分割のままだと、ページ遷移で初めて出る文字のたびに
 * 分割ファイルを取りに行き、到着時に字形が差し替わる。切り出したフォントを
 * 別ファミリーとして `--font-ui` の先頭に置き、収録されない文字は後続の
 * Fontsource へ文字単位で委ねる。
 */
export function uiFontSubset({
  root,
  outputDir,
  fontFamily,
}: UiFontSubsetOptions): Plugin {
  const sourceFontsDir = path.join(
    root,
    "node_modules",
    FONTSOURCE_PACKAGE,
    "files",
  );
  let pending: Promise<void> = Promise.resolve();
  let base = "/";

  function regenerate(): Promise<void> {
    // 失敗した生成のあとも、次の変更で作り直せるようにする。
    pending = pending
      .catch(() => undefined)
      .then(() =>
        generateUiFont({ root, outputDir, fontFamily, sourceFontsDir }),
      );
    return pending;
  }

  return {
    name: "pa-zzle:ui-font-subset",
    async buildStart() {
      await regenerate();
    },
    configureServer(server) {
      // 開発中に文言を足しても再起動せずに字形が揃うよう、ソース変更で作り直す。
      server.watcher.on("change", (file) => {
        if (isTextSource(path.relative(root, file))) {
          regenerate().catch((error: unknown) => {
            server.config.logger.error(`UI書体の生成に失敗した: ${error}`);
          });
        }
      });
    },
    configResolved(config) {
      base = config.base;
    },
    // 書体は描画で使われてから読まれるため、そのままでは JS の実行後に取りに行き、
    // 初回表示が代替書体で描かれてから差し替わる。HTML から JS と並行して取りに行かせる。
    transformIndexHtml: {
      order: "post",
      async handler(_html, { bundle }) {
        if (!bundle) {
          await pending.catch(() => undefined);
        }
        const fontUrls = bundle
          ? listBundledFontUrls(bundle, { root, outputDir, base })
          : await listGeneratedFontUrls({ root, outputDir, base });
        return fontUrls.map((href) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            href,
            as: "font",
            type: "font/woff2",
            crossorigin: "",
          },
          injectTo: "head-prepend",
        }));
      },
    },
  };
}

function isTextSource(relativePath: string): boolean {
  if (relativePath === HTML_ENTRY) {
    return true;
  }
  return (
    relativePath.startsWith(`${TEXT_SOURCE_DIR}${path.sep}`) &&
    TEXT_SOURCE_EXTENSION_PATTERN.test(relativePath) &&
    !TEST_SOURCE_PATTERN.test(relativePath)
  );
}

type FontUrlContext = {
  root: string;
  outputDir: string;
  base: string;
};

function listBundledFontUrls(
  bundle: Rolldown.OutputBundle,
  { root, outputDir, base }: FontUrlContext,
): string[] {
  return Object.values(bundle)
    .filter(
      (output): output is Rolldown.OutputAsset =>
        output.type === "asset" &&
        output.originalFileNames.some((fileName) =>
          path.resolve(root, fileName).startsWith(outputDir),
        ),
    )
    .map((asset) => `${base}${asset.fileName}`);
}

async function listGeneratedFontUrls({
  root,
  outputDir,
  base,
}: FontUrlContext): Promise<string[]> {
  const manifest = await readManifest(outputDir);
  const urlDir = path.relative(root, outputDir).split(path.sep).join("/");
  return (manifest?.files ?? []).map(
    (file) => `${base}${urlDir}/${file.fileName}`,
  );
}

async function generateUiFont({
  root,
  outputDir,
  fontFamily,
  sourceFontsDir,
}: UiFontSubsetOptions & { sourceFontsDir: string }): Promise<void> {
  const text = await collectUiText(root);
  const fontsourceVersion = await readFontsourceVersion(root);
  const key = createHash("sha256")
    .update(
      JSON.stringify({ text, fontsourceVersion, fontFamily, FONT_WEIGHTS }),
    )
    .digest("hex");

  const current = await readManifest(outputDir);
  if (current?.key === key) {
    return;
  }

  const fonts = await Promise.all(
    FONT_WEIGHTS.map(async (weight) => ({
      file: {
        fileName: `zen-kaku-gothic-new-subset-${weight}.woff2`,
        weight,
      },
      font: await subsetFont(
        await readFile(path.join(sourceFontsDir, sourceFontFileName(weight))),
        text,
        { targetFormat: "woff2" },
      ),
    })),
  );
  const files = fonts.map(({ file }) => file);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    fonts.map(({ file, font }) =>
      writeFile(path.join(outputDir, file.fileName), font),
    ),
  );
  await writeFile(
    path.join(outputDir, STYLESHEET_FILE),
    renderStylesheet(fontFamily, files),
  );
  await writeFile(
    path.join(outputDir, MANIFEST_FILE),
    `${JSON.stringify({ key, files } satisfies Manifest)}\n`,
  );
}

/**
 * Fontsource の japanese ファイルは一部の記号を持たない。収録されない文字は
 * 切り出したフォントからも落ち、後続の Fontsource の分割ファイルが受け持つ。
 */
function sourceFontFileName(weight: number): string {
  return `zen-kaku-gothic-new-japanese-${weight}-normal.woff2`;
}

async function listTextSources(root: string): Promise<string[]> {
  const sourceEntries = await readdir(path.join(root, TEXT_SOURCE_DIR), {
    recursive: true,
  });
  return [
    HTML_ENTRY,
    ...sourceEntries.map((entry) => path.join(TEXT_SOURCE_DIR, entry)),
  ]
    .filter(isTextSource)
    .sort();
}

async function collectUiText(root: string): Promise<string> {
  const characters = new Set(PRINTABLE_ASCII);
  for (const relativePath of await listTextSources(root)) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const line of source.split("\n")) {
      // 行全体がコメントの行は画面に出ないため除き、書体の容量を抑える。
      // 誤って除いた文字も、後続の Fontsource で同じ書体として表示される。
      if (COMMENT_LINE_PATTERN.test(line)) {
        continue;
      }
      for (const character of line) {
        if (character >= " ") {
          characters.add(character);
        }
      }
    }
  }
  return [...characters].sort().join("");
}

async function readFontsourceVersion(root: string): Promise<string> {
  const packageJson = JSON.parse(
    await readFile(
      path.join(root, "node_modules", FONTSOURCE_PACKAGE, "package.json"),
      "utf8",
    ),
  ) as { version: string };
  return packageJson.version;
}

async function readManifest(outputDir: string): Promise<Manifest | null> {
  try {
    return JSON.parse(
      await readFile(path.join(outputDir, MANIFEST_FILE), "utf8"),
    ) as Manifest;
  } catch {
    return null;
  }
}

function renderStylesheet(
  fontFamily: string,
  files: readonly FontFile[],
): string {
  return files
    .map((file) =>
      [
        "@font-face {",
        `  font-family: "${fontFamily}";`,
        "  font-style: normal;",
        "  font-display: swap;",
        `  font-weight: ${file.weight};`,
        `  src: url("./${file.fileName}") format("woff2");`,
        "}",
      ].join("\n"),
    )
    .join("\n\n")
    .concat("\n");
}
