import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { convert } from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import subsetFont from "subset-font";
import type { Plugin } from "vite";

const FONT_FAMILY = "Zen Kaku Gothic New";
const FONT_WEIGHTS = [400, 500, 700] as const;
const FONTSOURCE_PACKAGE = "@fontsource/zen-kaku-gothic-new";
const PRIMARY_SOURCE_PREFIX = "zen-kaku-gothic-new-japanese-";
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
};

type FontSource = {
  fileName: string;
  codePoints: ReadonlySet<number>;
};

type FontFile = {
  fileName: string;
  weight: number;
  /** 補助ファイルだけが持つ。主ファイルは全範囲を受け持つ。 */
  codePoints: readonly number[] | null;
};

type Manifest = {
  key: string;
  files: FontFile[];
};

/**
 * UI書体を、アプリのソースに現れる文字だけのフォントへ縮めて生成する。
 *
 * Fontsource の unicode-range 分割のままだと、ページ遷移で初めて出る文字のたびに
 * 分割ファイルを取りに行き、到着時に字形が差し替わる。文字を限ってウェイトごとに
 * 少数のファイルへまとめ、起動時に読み切れる大きさにする。
 */
export function uiFontSubset({ root, outputDir }: UiFontSubsetOptions): Plugin {
  const fontsourceFilesDir = path.join(
    root,
    "node_modules",
    FONTSOURCE_PACKAGE,
    "files",
  );
  let pending: Promise<void> = Promise.resolve();

  function regenerate(): Promise<void> {
    // 失敗した生成のあとも、次の変更で作り直せるようにする。
    pending = pending
      .catch(() => undefined)
      .then(() => generateUiFont({ root, outputDir, fontsourceFilesDir }));
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

async function generateUiFont({
  root,
  outputDir,
  fontsourceFilesDir,
}: UiFontSubsetOptions & { fontsourceFilesDir: string }): Promise<void> {
  const text = await collectUiText(root);
  const fontsourceVersion = await readFontsourceVersion(root);
  const key = createHash("sha256")
    .update(JSON.stringify({ text, fontsourceVersion, FONT_WEIGHTS }))
    .digest("hex");

  const current = await readManifest(outputDir);
  if (current?.key === key) {
    return;
  }

  const files = (
    await Promise.all(
      FONT_WEIGHTS.map((weight) =>
        subsetWeight({ text, weight, fontsourceFilesDir }),
      ),
    )
  ).flat();

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await Promise.all(
    files.map(({ file, font }) =>
      writeFile(path.join(outputDir, file.fileName), font),
    ),
  );
  const fontFiles = files.map(({ file }) => file);
  await writeFile(
    path.join(outputDir, STYLESHEET_FILE),
    renderStylesheet(fontFiles),
  );
  await writeFile(
    path.join(outputDir, MANIFEST_FILE),
    `${JSON.stringify({ key, files: fontFiles } satisfies Manifest)}\n`,
  );
}

async function collectUiText(root: string): Promise<string> {
  const characters = new Set(PRINTABLE_ASCII);
  for (const relativePath of await listTextSources(root)) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const line of source.split("\n")) {
      // 行全体がコメントの行は画面に出ないため除き、書体の容量を抑える。
      // 行末コメントは残るが、余分な字形が入るだけで表示は崩れない。
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

async function subsetWeight({
  text,
  weight,
  fontsourceFilesDir,
}: {
  text: string;
  weight: number;
  fontsourceFilesDir: string;
}): Promise<{ file: FontFile; font: Buffer }[]> {
  const codePoints = [...text].map(
    (character) => character.codePointAt(0) ?? 0,
  );
  const primary = await readFontSource(
    fontsourceFilesDir,
    `${PRIMARY_SOURCE_PREFIX}${weight}-normal.woff2`,
  );
  const uncovered = codePoints.filter(
    (codePoint) => !primary.codePoints.has(codePoint),
  );
  const supplements =
    uncovered.length > 0
      ? assignCodePointsToSources(
          uncovered,
          await readSupplementSources(fontsourceFilesDir, weight),
        )
      : [];
  const groups = [
    {
      source: primary,
      codePoints: codePoints.filter((codePoint) =>
        primary.codePoints.has(codePoint),
      ),
    },
    ...supplements,
  ];

  return Promise.all(
    groups.map(async ({ source, codePoints: assigned }, index) => {
      const font = await subsetFont(
        await readFile(path.join(fontsourceFilesDir, source.fileName)),
        String.fromCodePoint(...assigned),
        { targetFormat: "woff2" },
      );
      const isPrimary = index === 0;
      const file: FontFile = {
        fileName: isPrimary
          ? `zen-kaku-gothic-new-${weight}.woff2`
          : `zen-kaku-gothic-new-${weight}-supplement-${index}.woff2`,
        weight,
        codePoints: isPrimary ? null : assigned,
      };
      return { file, font };
    }),
  );
}

async function readFontSource(
  fontsourceFilesDir: string,
  fileName: string,
): Promise<FontSource> {
  const sfnt = await convert(
    await readFile(path.join(fontsourceFilesDir, fileName)),
    "sfnt",
  );
  return {
    fileName,
    codePoints: new Set(new Face(new Blob(sfnt), 0).collectUnicodes()),
  };
}

/**
 * Fontsource の japanese ファイルは一部の記号を持たず、それらは unicode-range
 * 分割ファイルにだけ収録されている。
 */
async function readSupplementSources(
  fontsourceFilesDir: string,
  weight: number,
): Promise<FontSource[]> {
  const suffix = `-${weight}-normal.woff2`;
  const fileNames = (await readdir(fontsourceFilesDir))
    .filter(
      (fileName) =>
        fileName.endsWith(suffix) &&
        !fileName.startsWith(PRIMARY_SOURCE_PREFIX),
    )
    .sort();
  return Promise.all(
    fileNames.map((fileName) => readFontSource(fontsourceFilesDir, fileName)),
  );
}

/** どのソースにもない文字は落とし、表示時は後続の書体へ委ねる。 */
function assignCodePointsToSources(
  codePoints: readonly number[],
  sources: readonly FontSource[],
): { source: FontSource; codePoints: number[] }[] {
  const groups = new Map<FontSource, number[]>();
  for (const codePoint of codePoints) {
    const source = sources.find((candidate) =>
      candidate.codePoints.has(codePoint),
    );
    if (source) {
      groups.set(source, [...(groups.get(source) ?? []), codePoint]);
    }
  }
  return [...groups].map(([source, assigned]) => ({
    source,
    codePoints: assigned,
  }));
}

function renderStylesheet(files: readonly FontFile[]): string {
  return files
    .map((file) =>
      [
        "@font-face {",
        `  font-family: "${FONT_FAMILY}";`,
        "  font-style: normal;",
        "  font-display: swap;",
        `  font-weight: ${file.weight};`,
        `  src: url("./${file.fileName}") format("woff2");`,
        ...(file.codePoints
          ? [`  unicode-range: ${formatUnicodeRange(file.codePoints)};`]
          : []),
        "}",
      ].join("\n"),
    )
    .join("\n\n")
    .concat("\n");
}

function formatUnicodeRange(codePoints: readonly number[]): string {
  return [...codePoints]
    .sort((a, b) => a - b)
    .map((codePoint) => `U+${codePoint.toString(16).toUpperCase()}`)
    .join(", ");
}
