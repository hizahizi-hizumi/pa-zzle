const base = process.argv[2];
const { model } = await import(base + "/node_modules/budoux/module/data/models/ja.js");
const { Parser } = await import(base + "/node_modules/budoux/module/parser.js");
const p = new Parser(model);
for (const t of process.argv.slice(3)) console.log(p.parse(t).join("|"));
