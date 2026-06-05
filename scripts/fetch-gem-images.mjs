import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "image-sources.json");
const creditsJsonPath = path.join(root, "data", "image-credits.json");
const creditsJsPath = path.join(root, "data", "image-credits.js");
const assetsDir = path.join(root, "assets", "gems");
const force = process.argv.includes("--force");

const API_URL = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "GemIdentifyPWA/1.0 (personal offline gem encyclopedia; https://github.com/siyachen06-tech/gem-identify-pwa)";

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const NEGATIVE_TERMS = [
  "logo",
  "map",
  "diagram",
  "crystal structure",
  "molecular",
  "chemical structure",
  "icon",
  "flag",
  "stamp",
  "coin",
  "painting",
  "drawing",
  "poster",
  "book cover",
  "necklace",
  "bracelet",
  "earring",
  "ring",
];

const POSITIVE_TERMS = ["specimen", "crystal", "mineral", "rough", "quartz", "gemstone", "var ", "matrix"];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const sources = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  fs.mkdirSync(assetsDir, { recursive: true });

  const credits = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: sources.source,
    sourceUrl: "https://commons.wikimedia.org/",
    note: "图片用于宝石百科离线展示。每张图保留 Wikimedia Commons 文件页、作者和许可信息。",
    images: {},
  };

  const entries = Object.entries(sources.images);
  const missing = [];

  for (let index = 0; index < entries.length; index += 1) {
    const [imageKey, config] = entries[index];
    process.stdout.write(`[${index + 1}/${entries.length}] ${config.label} -> `);

    const match = await findBestImage(config);
    if (!match) {
      missing.push(imageKey);
      console.log("未找到");
      continue;
    }

    const imageUrl = match.info.thumburl || match.info.url;
    const extension = extensionFromUrl(imageUrl) || MIME_EXTENSIONS[match.info.mime] || "jpg";
    const fileName = `${imageKey}.${extension}`;
    const outputPath = path.join(assetsDir, fileName);
    const publicPath = `assets/gems/${fileName}`;

    if (force || !fs.existsSync(outputPath)) {
      await downloadFile(imageUrl, outputPath);
      await sleep(120);
    }

    credits.images[imageKey] = {
      label: config.label,
      path: publicPath,
      query: match.query,
      title: match.page.title.replace(/^File:/, ""),
      pageUrl: match.info.descriptionurl,
      sourceUrl: match.info.url,
      thumbnailUrl: imageUrl,
      license: metadataValue(match.info.extmetadata, "LicenseShortName") || metadataValue(match.info.extmetadata, "UsageTerms") || "未标注",
      licenseUrl: metadataValue(match.info.extmetadata, "LicenseUrl"),
      artist: cleanMetadata(metadataValue(match.info.extmetadata, "Artist") || metadataValue(match.info.extmetadata, "Credit") || "Wikimedia Commons contributor"),
      credit: cleanMetadata(metadataValue(match.info.extmetadata, "Credit")),
      description: cleanMetadata(metadataValue(match.info.extmetadata, "ImageDescription") || metadataValue(match.info.extmetadata, "ObjectName")),
    };

    console.log(`${match.page.title.replace(/^File:/, "")}`);
  }

  fs.writeFileSync(creditsJsonPath, `${JSON.stringify(credits, null, 2)}\n`);
  fs.writeFileSync(creditsJsPath, `window.GEM_IMAGE_CREDITS = ${JSON.stringify(credits, null, 2)};\n`);

  if (missing.length) {
    throw new Error(`以下图片没有找到：${missing.join(", ")}`);
  }

  console.log(`Generated ${entries.length} local images and credits.`);
}

async function findBestImage(config) {
  for (const title of config.preferredTitles || []) {
    const page = await commonsFileInfo(title);
    const info = page?.imageinfo?.[0];
    if (info && isSupportedImage(info)) {
      return {
        query: `preferred:${title}`,
        page,
        info,
        score: Number.POSITIVE_INFINITY,
      };
    }
    await sleep(120);
  }

  const candidates = [];

  for (const query of config.queries) {
    const results = await commonsSearch(query);
    for (const page of results) {
      const info = page.imageinfo?.[0];
      if (!info || !isSupportedImage(info)) continue;
      candidates.push({
        query,
        page,
        info,
        score: scoreCandidate(page, info, config),
      });
    }
    await sleep(120);
  }

  candidates.sort((a, b) => b.score - a.score || (a.page.index || 999) - (b.page.index || 999));
  return candidates[0] || null;
}

async function commonsFileInfo(title) {
  const normalizedTitle = title.startsWith("File:") ? title : `File:${title}`;
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", normalizedTitle);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "720");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = await fetchJson(url);
  return Object.values(json.query?.pages || {}).find((page) => !page.missing);
}

async function commonsSearch(query) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "10");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "720");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const json = await fetchJson(url);
  return Object.values(json.query?.pages || {}).sort((a, b) => (a.index || 999) - (b.index || 999));
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikimedia API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function downloadFile(url, outputPath) {
  const response = await fetchWithRetry(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Download ${response.status}: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function isSupportedImage(info) {
  if (!info.thumburl && !info.url) return false;
  if (info.mime === "image/svg+xml") return false;
  if (MIME_EXTENSIONS[info.mime]) return true;
  return Boolean(info.thumburl && /\.(jpe?g|png|webp)(?:$|\?)/i.test(info.thumburl));
}

function scoreCandidate(page, info, config) {
  const meta = info.extmetadata || {};
  const text = cleanMetadata(
    [
      page.title,
      metadataValue(meta, "ObjectName"),
      metadataValue(meta, "ImageDescription"),
      metadataValue(meta, "Categories"),
    ]
      .filter(Boolean)
      .join(" "),
  ).toLowerCase();

  let score = 100 - (page.index || 50);

  let matches = 0;
  for (const term of config.matchTerms || []) {
    if (text.includes(term.toLowerCase())) matches += 1;
  }
  score += matches * 16;
  if ((config.matchTerms || []).length && matches === 0) score -= 35;

  for (const term of config.requiredTerms || []) {
    if (!text.includes(term.toLowerCase())) score -= 120;
  }

  for (const term of POSITIVE_TERMS) {
    if (text.includes(term)) score += 4;
  }

  for (const term of NEGATIVE_TERMS) {
    if (text.includes(term)) score -= 18;
  }

  const assessments = metadataValue(meta, "Assessments") || "";
  if (/featured|quality/i.test(assessments)) score += 8;
  if ((info.width || 0) >= 900 && (info.height || 0) >= 600) score += 2;

  return score;
}

function metadataValue(meta, key) {
  return meta?.[key]?.value || "";
}

function cleanMetadata(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  const match = pathname.match(/\.([a-z0-9]+)(?:$|[/?#])/);
  if (!match) return "";
  const extension = match[1].replace("jpeg", "jpg");
  return ["jpg", "png", "webp"].includes(extension) ? extension : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
