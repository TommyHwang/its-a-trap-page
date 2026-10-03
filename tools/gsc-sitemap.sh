#!/bin/sh
# 구글 서치 콘솔에 sitemap.xml을 다시 제출한다(새 글을 올린 뒤).
# 서비스 계정 seo-console@its-a-trap-5454(사이트 소유자)로 가장한다. 키 파일 없음.
set -e
SITE="${SITE_URL:-https://its-a-trap.app}/"
PROPERTY="${GSC_PROPERTY:-sc-domain:its-a-trap.app}"   # 도메인 속성(DNS TXT로 확인)
T=$(gcloud auth print-access-token --impersonate-service-account=seo-console@its-a-trap-5454.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/webmasters 2>/dev/null)
enc() { python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=''))" "$1"; }
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer $T" \
  "https://www.googleapis.com/webmasters/v3/sites/$(enc "$PROPERTY")/sitemaps/$(enc "${SITE}sitemap.xml")")
[ "$code" = 204 ] && echo "✅ 서치 콘솔 사이트맵 제출" || { echo "❌ 서치 콘솔 $code"; exit 1; }
