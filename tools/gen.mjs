/* 가이드(블로그) 생성기 — 의존성 없음.

   content/guide/*.md(앞머리 YAML + 본문 Markdown) →
     guide/<slug>.html         글 페이지(cleanUrls로 /guide/<slug>)
     guide/index.html          글 목록
     sitemap.xml               전체 페이지
   결과 HTML도 커밋한다. Vercel은 빌드 없이 정적 파일을 그대로 낸다.

     node tools/gen.mjs

   Markdown·YAML은 우리가 쓰는 만큼만 읽는다(제목 ##/###, 문단, 목록, 인용, 링크,
   굵게, 코드 / 스칼라, [a, b], "- { k: v }" 목록). 그 밖의 문법은 오류로 멈춘다 —
   조용히 깨진 페이지를 내보내는 것보다 낫다. */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = (process.env.SITE_URL || "https://its-a-trap.app").replace(/\/$/, "");
const STORE = "https://chromewebstore.google.com/detail/kliegjogabngpjjcmjigngfjjpegacjk";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "content/guide");

/* ---------- 작은 YAML ---------- */
function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}
function flowMap(s) {
  const body = s.trim().replace(/^\{/, "").replace(/\}$/, "");
  const out = {};
  const re = /(\w+):\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^,]*?)(?=\s*,\s*\w+:|\s*$)/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = unquote(m[2]);
  return out;
}
function parseYaml(text) {
  const data = {};
  let listKey = null;
  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      const v = item[1].trim();
      data[listKey].push(v.startsWith("{") ? flowMap(v) : unquote(v));
      continue;
    }
    const kv = raw.match(/^(\w+):\s*(.*)$/);
    if (!kv) throw new Error(`YAML을 읽지 못함: ${raw}`);
    const [, k, v] = kv;
    if (v === "") { data[k] = []; listKey = k; continue; }
    listKey = null;
    data[k] = v.startsWith("[") ? v.slice(1, -1).split(",").map(unquote).filter(Boolean) : unquote(v);
  }
  return data;
}

/* ---------- 작은 Markdown ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const ext = /^https?:\/\//.test(href) && !href.startsWith(SITE);
    return `<a href="${href}"${ext ? ' rel="noopener"' : ""}>${label}</a>`;
  });
  return t;
}
function slugId(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}
function markdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const html = [];
  const toc = [];
  let para = [];
  let list = null;
  let quote = [];
  const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };
  for (const line of lines) {
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      flushAll();
      const lvl = m[1].length, text = m[2].trim(), id = slugId(text);
      if (lvl === 2) toc.push({ id, text });
      html.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);
      continue;
    }
    if (/^#\s/.test(line)) throw new Error("본문에 H1(#)을 쓰지 않는다 — 제목은 앞머리 title");
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1]); continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1]); continue;
    }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    if (/^(```|\|)/.test(line)) throw new Error(`지원하지 않는 Markdown: ${line}`);
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return { html: html.join("\n"), toc };
}

/* ---------- 공통 조각 ---------- */
const storeLink = (campaign) => `${STORE}?utm_source=guide&amp;utm_medium=article&amp;utm_campaign=${encodeURIComponent(campaign)}`;
const fmtDate = (d) => { const [y, m, dd] = d.split("-"); return `${y}년 ${Number(m)}월 ${Number(dd)}일`; };
const ORG = { "@type": "Organization", "@id": `${SITE}/#org`, name: "its-a-trap", url: `${SITE}/`, email: "contact@ys-ware.com", logo: `${SITE}/icon.png`, sameAs: [STORE] };
const kst = (d) => `${d}T09:00:00+09:00`;

function head({ title, description, path, type = "website", jsonld, published, updated, noindex }) {
  const url = `${SITE}${path}`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${noindex ? '\n<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="its-a-trap">
<meta property="og:locale" content="ko_KR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/img/og.png">
<meta name="twitter:card" content="summary_large_image">${published ? `
<meta property="article:published_time" content="${published}">
<meta property="article:modified_time" content="${updated || published}">` : ""}
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/guide.css">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
</head>`;
}
const nav = (campaign) => `<header class="nav">
  <a class="wordmark" href="/"><img src="/icon.png" alt="" width="28" height="28">its-a-trap</a>
  <nav class="nav-links" aria-label="사이트">
    <a href="/guide">가이드</a>
    <a class="btn-line" href="${storeLink(campaign)}">크롬에 추가</a>
  </nav>
</header>`;
const foot = `<footer class="foot">
  <p><a href="/">its-a-trap 소개</a> · <a href="/guide">가이드</a> · <a href="/privacy">개인정보 처리방침</a> · <a href="/support">지원</a> · <a href="mailto:contact@ys-ware.com">contact@ys-ware.com</a></p>
  <p>its-a-trap은 글에 나온 기관이나 회사와 제휴하지 않았습니다.</p>
</footer>`;

/* ---------- 글 ---------- */
function readPosts() {
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir).filter((f) => f.endsWith(".md")).map((f) => {
    const text = readFileSync(join(srcDir, f), "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${f}: 앞머리(---)가 없다`);
    const fm = parseYaml(m[1]);
    for (const k of ["title", "description", "slug", "published"]) if (!fm[k]) throw new Error(`${f}: ${k} 없음`);
    if (!/^[a-z0-9-]+$/.test(fm.slug)) throw new Error(`${f}: slug는 영문 소문자·숫자·하이픈`);
    /* 원고의 게시 전 메모(<!-- -->)는 싣지 않는다 */
    return { ...fm, campaign: fm.campaign || fm.slug, updated: fm.updated || fm.published, body: m[2].replace(/<!--[\s\S]*?-->/g, ""), file: f };
  }).sort((a, b) => b.published.localeCompare(a.published));
}

function postPage(p) {
  const path = `/guide/${p.slug}`;
  const { html, toc } = markdown(p.body);
  const faq = Array.isArray(p.faq) ? p.faq.filter((x) => x.q && x.a) : [];
  const sources = Array.isArray(p.sources) ? p.sources.filter((s) => s.url) : [];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    ORG,
    { "@type": "BlogPosting", "@id": `${SITE}${path}#article`, headline: p.title, description: p.description,
      inLanguage: "ko-KR", datePublished: kst(p.published), dateModified: kst(p.updated),
      mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}${path}` }, isPartOf: { "@id": `${SITE}/guide#blog` }, image: [`${SITE}/img/og.png`],
      keywords: (p.keywords || []).join(", "),
      author: { "@id": `${SITE}/#org` }, publisher: { "@id": `${SITE}/#org` },
      ...(sources.length ? { citation: sources.map((s) => ({ "@type": "CreativeWork", name: s.title || s.url, url: s.url, ...(s.date ? { datePublished: s.date } : {}) })) } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "its-a-trap", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "가이드", item: `${SITE}/guide` },
      { "@type": "ListItem", position: 3, name: p.title }] }
  ] };
  return `${head({ title: `${p.title} | its-a-trap`, description: p.description, path, type: "article", jsonld, published: p.published, updated: p.updated })}
<body>
${nav(p.campaign)}
<main class="article">
  <nav class="crumbs" aria-label="현재 위치"><a href="/">its-a-trap</a> › <a href="/guide">가이드</a></nav>
  <h1>${esc(p.title)}</h1>
  <p class="meta"><time datetime="${p.published}">${fmtDate(p.published)}</time> 작성${p.updated !== p.published ? ` · <time datetime="${p.updated}">${fmtDate(p.updated)}</time> 고침` : ""} · its-a-trap 운영자</p>
  ${toc.length > 2 ? `<nav class="toc" aria-label="목차"><p>이 글의 순서</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ol></nav>` : ""}
  <div class="prose">
${html}
  </div>
  ${faq.length ? `<section class="faq" aria-labelledby="faq"><h2 id="faq">자주 묻는 질문</h2>
    <dl>${faq.map((x) => `<div><dt>${inline(x.q)}</dt><dd>${inline(x.a)}</dd></div>`).join("")}</dl></section>` : ""}
  ${sources.length ? `<section class="sources" aria-labelledby="src"><h2 id="src">출처</h2><ol>${sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title || s.url)}</a>${s.date ? ` · ${esc(s.date)}` : ""}</li>`).join("")}</ol></section>` : ""}
  <aside class="install">
    <p><strong>its-a-trap</strong>은 Gmail과 네이버 메일에서 메일을 열면 보낸 도메인이 그 기관의 공식 도메인인지, 언제 생겼는지 확인해 위험·의심·이상 없음으로 알려 주는 크롬 확장입니다. 판정과 신고는 무료입니다.</p>
    <p><a class="btn" href="${storeLink(p.campaign)}">크롬에 추가하기</a> <a class="link" href="/">어떻게 동작하는지 보기</a></p>
  </aside>
</main>
${foot}
</body>
</html>
`;
}

function indexPage(posts) {
  const path = "/guide";
  const jsonld = { "@context": "https://schema.org", "@graph": [ORG,
    { "@type": ["CollectionPage", "Blog"], "@id": `${SITE}/guide#blog`, name: "its-a-trap 가이드", inLanguage: "ko-KR", url: `${SITE}/guide`, publisher: { "@id": `${SITE}/#org` },
      isPartOf: { "@id": `${SITE}/#site` },
      ...(posts.length ? { blogPost: posts.map((p) => ({ "@id": `${SITE}/guide/${p.slug}#article` })) } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "its-a-trap", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "가이드" }] }] };
  return `${head({ noindex: !posts.length, title: "사칭 메일 확인 가이드 | its-a-trap", description: "기관·거래처를 사칭한 메일을 받았을 때 진짜인지 확인하는 방법을 공지와 출처를 붙여 정리합니다. 1인 사업자와 온라인 셀러가 자주 받는 메일부터 다룹니다.", path, jsonld })}
<body>
${nav("guide-index")}
<main class="article">
  <h1>사칭 메일 확인 가이드</h1>
  <p class="lede">기관이나 거래처를 사칭한 메일을 받았을 때 진짜인지 확인하는 방법을 정리합니다. 사실마다 공지와 기사 출처를 붙입니다.</p>
  ${posts.length ? "" : '<p class="lede">첫 글을 준비하고 있습니다.</p>'}
  <ol class="posts">
${posts.map((p) => `    <li><a href="/guide/${p.slug}"><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><time datetime="${p.updated}">${fmtDate(p.updated)}</time></a></li>`).join("\n")}
  </ol>
</main>
${foot}
</body>
</html>
`;
}

/* ---------- 쓰기 ---------- */
const posts = readPosts();
for (const p of posts) {
  mkdirSync(join(root, "guide"), { recursive: true });
  writeFileSync(join(root, "guide", `${p.slug}.html`), postPage(p));
}
mkdirSync(join(root, "guide"), { recursive: true });
writeFileSync(join(root, "guide/index.html"), indexPage(posts));

const lastmod = (f) => statSync(join(root, f)).mtime.toISOString().slice(0, 10);
const urls = [
  { loc: "/", lastmod: lastmod("index.html") },
  ...(posts.length ? [{ loc: "/guide", lastmod: posts[0].updated }] : []),
  ...posts.map((p) => ({ loc: `/guide/${p.slug}`, lastmod: p.updated })),
  { loc: "/privacy", lastmod: lastmod("privacy/index.html") },
  { loc: "/support", lastmod: lastmod("support/index.html") }
];
writeFileSync(join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.loc === "/" ? "/" : u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>
`);
console.log(`✅ 가이드 ${posts.length}편 · guide/index.html · sitemap.xml (${urls.length} URL) — ${SITE}`);
