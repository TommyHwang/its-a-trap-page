/* 방문 분석 — Vercel Web Analytics(쿠키 없음). 개인정보 처리방침 5-3항.

   이 파일은 /_vercel/insights/script.js보다 먼저(같은 defer 순서로) 읽힌다.
   ① 보내기 전에 주소를 다듬는다. utm_* 말고 query는 모두 떼고 # 뒤도 뗀다.
      /check는 안드로이드 공유로 열리면 ?text=<문자 내용>이 붙고, "결과 보내기" 링크는
      # 뒤에 내용을 담는다. 어느 쪽도 Vercel로 가지 않게 하려는 것이다.
   ② 웹스토어 링크 클릭을 센다. 무료(Hobby) 요금제는 사용자 지정 이벤트가 없어서
      클릭을 가상 페이지뷰 /go/store/<클릭한 페이지>로 남긴다. 대시보드 Pages에서
      /go/store로 시작하는 행을 더하면 클릭 수다. "설치 링크를 내 메일로 보내기"는
      /go/send-to-pc/<클릭한 페이지>.
   ③ 운영자 제외: 아무 페이지나 주소 끝에 #no-stats를 붙여 한 번 열면 그 브라우저는
      더 세지 않는다(#stats로 되돌림). Vercel 문서의 va-disable 방식이다. */
(function () {
  var w = window;
  w.va = w.va || function () { (w.vaq = w.vaq || []).push(arguments); };

  try {
    if (location.hash === "#no-stats") localStorage.setItem("va-disable", "1");
    if (location.hash === "#stats") localStorage.removeItem("va-disable");
  } catch (e) { /* 저장소를 못 쓰면 그냥 센다 */ }

  w.va("beforeSend", function (event) {
    try { if (localStorage.getItem("va-disable")) return null; } catch (e) { /* 무시 */ }
    var url = new URL(event.url);
    var keep = new URLSearchParams();
    url.searchParams.forEach(function (v, k) { if (/^utm_/.test(k)) keep.append(k, v); });
    url.search = keep.toString();
    url.hash = "";
    return Object.assign({}, event, { url: url.toString() });
  });

  var from = location.pathname.replace(/\/$/, "") || "/home";
  function track(e) {
    if (e.type === "auxclick" && e.button !== 1) return;
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    var kind = href.indexOf("https://chromewebstore.google.com/") === 0 ? "store"
      : (href.indexOf("mailto:") === 0 && href.indexOf("chromewebstore") > 0) ? "send-to-pc" : null;
    if (!kind) return;
    w.va("pageview", { path: "/go/" + kind + from });
  }
  document.addEventListener("click", track, true);
  document.addEventListener("auxclick", track, true);
})();
