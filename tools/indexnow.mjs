/* IndexNow — 바뀐 주소를 검색엔진에 바로 알린다(Bing·네이버·Yandex·Seznam 등이 공유).
   계정이 필요 없다. 소유 확인은 사이트 루트의 <키>.txt 파일로 한다.

     node tools/indexnow.mjs            # sitemap.xml의 모든 주소
     node tools/indexnow.mjs /guide/a   # 지정한 경로만

   배포가 끝난 뒤(키 파일이 실제로 열릴 때) 돌린다. */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://its-a-trap-page.vercel.app").replace(/\/$/, "");
const keyFile = readdirSync(root).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error("❌ 루트에 IndexNow 키 파일(<32자 hex>.txt)이 없다"); process.exit(1); }
const key = keyFile.slice(0, -4);

const args = process.argv.slice(2);
const urls = args.length
  ? args.map((p) => `${SITE}${p.startsWith("/") ? p : `/${p}`}`)
  : [...readFileSync(resolve(root, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const live = await fetch(`${SITE}/${keyFile}`).then((r) => r.ok && r.text()).catch(() => null);
if (live !== key) { console.error(`❌ ${SITE}/${keyFile}가 아직 열리지 않는다 — 배포 뒤에 다시`); process.exit(1); }

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls })
});
console.log(`${res.ok ? "✅" : "❌"} IndexNow ${res.status} — ${urls.length}개 주소`);
for (const u of urls) console.log("   " + u);
if (!res.ok) { console.error(await res.text()); process.exit(1); }
