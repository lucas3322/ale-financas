// Gera src/lib/icons/bundle.json só com os ícones do Iconify que o app usa.
// Procura nomes "ph:..." e "simple-icons:..." no código do front e nos padrões do servidor,
// então qualquer ícone novo referenciado entra automaticamente — sem depender da API do Iconify em produção.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getIcons } from "@iconify/utils";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sources = [join(root, "src"), join(root, "../server/src"), join(root, "../server/prisma/migrations")];
const SETS = { ph: "@iconify-json/ph/icons.json", "simple-icons": "@iconify-json/simple-icons/icons.json" };
const RE = /\b(ph|simple-icons):([a-z0-9]+(?:-[a-z0-9]+)*)\b/g;

const found = { ph: new Set(), "simple-icons": new Set() };
function walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist" || e === "bundle.json") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|sql|mjs)$/.test(e)) for (const m of readFileSync(p, "utf8").matchAll(RE)) found[m[1]].add(m[2]);
  }
}
sources.forEach(walk);

const require = (await import("node:module")).createRequire(import.meta.url);
const out = [];
for (const [prefix, pkg] of Object.entries(SETS)) {
  const data = getIcons(require(pkg), [...found[prefix]], true);
  if (!data) continue;
  const missing = [...found[prefix]].filter((n) => !data.icons[n] && !data.aliases?.[n]);
  if (missing.length) {
    console.error(`[icons] não existem em ${prefix}: ${missing.join(", ")}`);
    process.exit(1);
  }
  out.push(data);
}
writeFileSync(join(root, "src/lib/icons/bundle.json"), JSON.stringify(out));
console.log(`[icons] ${out.map((d) => `${d.prefix}: ${Object.keys(d.icons).length}`).join(" · ")}`);
