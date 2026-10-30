/* its-a-trap 붙여넣기 검사 서비스 워커 — docs/spec/07-message-check.md §2.

   하는 일 두 가지.
   ① /check 화면 파일을 캐시해 두고 네트워크가 없을 때 쓴다.
   ② 안드로이드 공유 대상은 /check?text=<문자 내용>으로 화면을 연다. 이 요청을
      가로채 query를 뗀 /check를 받아 온다. 문자 내용이 서버 접근 기록에 남지
      않게 하려는 것이다. 주소창의 query는 페이지 스크립트가 읽고 지운다.

   빌드 산출물이다(scripts/build-web.mjs가 a2003dd848을 채운다). */

const CACHE = "iat-check-__VERSION__";
const SHELL = ["/check", "/check/check.css", "/check/check.js", "/tokens.css", "/home.css", "/fonts/pretendard.css", "/icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("iat-check-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const key = url.pathname.replace(/\/$/, "") || "/";
  if (!SHELL.includes(key)) return;
  /* 네트워크 먼저(판정 규칙이 바뀌면 바로 받게), 안 되면 캐시. 어느 쪽이든 query는 붙이지 않는다 */
  e.respondWith(
    fetch(key, { credentials: "same-origin" })
      .then((res) => {
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
        }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error()))
  );
});
