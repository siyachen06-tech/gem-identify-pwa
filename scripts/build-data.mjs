import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "crystals_database.json");
const dataDir = path.join(root, "data");
const jsonPath = path.join(dataDir, "gems.json");
const jsPath = path.join(dataDir, "gems.js");

const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const topCategories = [
  {
    id: "crystal",
    name: "水晶类",
    description: "一期重点数据，覆盖石英族水晶、幽灵水晶、发晶、特殊水晶和常见处理水晶。",
    imageKey: "crystal",
  },
  {
    id: "gemstone",
    name: "彩宝类",
    description: "覆盖海蓝宝、碧玺、石榴石、尖晶石、坦桑石等常见彩色宝石。",
    imageKey: "gemstone",
  },
  {
    id: "jade",
    name: "玉石类",
    description: "覆盖翡翠、绿松石、青金石、玛瑙等佩戴和收藏场景常见品类。",
    imageKey: "jade",
  },
  {
    id: "mineral",
    name: "矿石标本类",
    description: "覆盖萤石、方解石、黄铁矿、天青石、鱼眼石、沙漠玫瑰等观赏标本。",
    imageKey: "mineral",
  },
];

const gemstoneNames = [
  "海蓝宝",
  "摩根石",
  "黄绿柱石",
  "托帕石",
  "碧玺",
  "石榴石",
  "尖晶石",
  "坦桑石",
  "橄榄石",
  "锆石",
  "磷灰石",
  "堇青石",
  "拉长石",
  "月光石",
  "太阳石",
  "天河石",
  "紫龙晶",
  "舒俱徕石",
  "虎眼石",
  "东陵石",
];

const jadeNames = [
  "翡翠",
  "绿松石",
  "青金石",
  "南红",
  "战国红",
  "水草玛瑙",
  "孔雀石",
];

function topCategoryFor(item) {
  if (
    item.category.includes("水晶") ||
    item.category.includes("发晶") ||
    item.name.includes("水晶") ||
    item.name.includes("发晶") ||
    item.name.includes("钛晶")
  ) {
    return "水晶类";
  }

  if (jadeNames.some((name) => item.name.includes(name)) || item.category.includes("玉石")) {
    return "玉石类";
  }

  if (gemstoneNames.some((name) => item.name.includes(name))) {
    return "彩宝类";
  }

  return "矿石标本类";
}

function imageKeyFor(item, topCategory) {
  const name = item.name;
  if (name.includes("紫水晶")) return "amethyst";
  if (name.includes("黄水晶")) return "citrine";
  if (name.includes("粉水晶") || name.includes("芙蓉石")) return "rose-quartz";
  if (name.includes("茶晶") || name.includes("烟晶")) return "smoky-quartz";
  if (name.includes("幽灵") || name.includes("异象")) return "phantom-quartz";
  if (name.includes("发晶") || name.includes("钛晶")) return "rutilated-quartz";
  if (name.includes("白水晶")) return "clear-quartz";
  return {
    水晶类: "crystal",
    彩宝类: "gemstone",
    玉石类: "jade",
    矿石标本类: "mineral",
  }[topCategory];
}

function aliasesFor(item) {
  const aliases = new Set();
  aliases.add(item.name);
  aliases.add(item.englishName);

  const parenMatches = [...item.name.matchAll(/[（(]([^）)]+)[）)]/g)];
  for (const match of parenMatches) aliases.add(match[1]);

  for (const part of item.englishName.split(/[\/,;]+/)) {
    const trimmed = part.trim();
    if (trimmed) aliases.add(trimmed);
  }

  return [...aliases].filter(Boolean);
}

const gems = raw.crystals.map((item) => {
  const topCategory = topCategoryFor(item);
  return {
    id: item.id,
    name: item.name,
    englishName: item.englishName,
    topCategory,
    subCategory: item.category,
    appearance: item.appearance,
    quality: item.quality,
    origins: item.origins,
    uses: item.uses,
    price: item.price,
    authenticity: item.authenticity,
    treatment: item.treatment,
    fengshui: item.fengshui,
    aliases: aliasesFor(item),
    imageKey: imageKeyFor(item, topCategory),
  };
});

const topCategoryCounts = Object.fromEntries(topCategories.map((category) => [category.name, 0]));
for (const gem of gems) topCategoryCounts[gem.topCategory] += 1;

const output = {
  meta: {
    name: "宝石百科与现场识别数据库",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "crystals_database.json",
    total: gems.length,
    fieldSchema: [
      "id",
      "name",
      "englishName",
      "topCategory",
      "subCategory",
      "appearance",
      "quality",
      "origins",
      "uses",
      "price",
      "authenticity",
      "treatment",
      "fengshui",
      "aliases",
      "imageKey",
    ],
  },
  topCategories: topCategories.map((category) => ({
    ...category,
    count: topCategoryCounts[category.name],
  })),
  gems,
};

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(
  jsPath,
  `window.GEM_DATA = ${JSON.stringify(output, null, 2)};\n`,
);

console.log(`Generated ${gems.length} gems at ${path.relative(root, jsonPath)} and ${path.relative(root, jsPath)}`);
