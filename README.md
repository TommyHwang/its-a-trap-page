# its-a-trap 사이트

[its-a-trap](https://its-a-trap.app)의 홍보 사이트 소스예요. its-a-trap은 Gmail·네이버 메일에서 사칭·사기 메일을 알려 주는 크롬 확장이고, 메일 내용은 기기 밖으로 나가지 않아요.

- 크롬 웹스토어: [its-a-trap 설치](https://chromewebstore.google.com/detail/kliegjogabngpjjcmjigngfjjpegacjk)
- 수상한 문자·카톡·메일 붙여 넣어 확인: [its-a-trap.app/check](https://its-a-trap.app/check)
- 문의: [its-a-trap.app/support](https://its-a-trap.app/support)

## 사칭 메일 가이드

- [한국저작권보호원·저작권위원회 사칭 '저작권 침해' 메일](https://its-a-trap.app/guide/copyright-infringement-notice-email)
- [은행 개인정보 유출 '보상 조회' 사칭](https://its-a-trap.app/guide/bank-leak-compensation-scam)
- [공정위 '조사통지서' 사칭 메일](https://its-a-trap.app/guide/ftc-investigation-notice-email)
- [국세청 전자세금계산서 사칭 메일](https://its-a-trap.app/guide/nts-e-tax-invoice-email)
- [건강보험공단 '보험료 면제·급여정지 안내' 사칭 메일](https://its-a-trap.app/guide/nhis-impersonation-email)
- [경찰서 '출석요구서' 사칭 메일](https://its-a-trap.app/guide/police-summons-email)

전체 목록은 [its-a-trap.app/guide](https://its-a-trap.app/guide)에 있어요.

## 구조

정적 사이트예요. 글 원고는 `content/guide/`에 두고 `node tools/gen.mjs`로 `guide/`의 HTML을 만들어요.
