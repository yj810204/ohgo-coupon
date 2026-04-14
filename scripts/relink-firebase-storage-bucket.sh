#!/usr/bin/env bash
# Firebase Storage: GCS 버킷을 Firebase 프로젝트에 다시 연결(addFirebase).
# 사전: Google Cloud SDK(gcloud) 설치, `gcloud auth login` 완료, Cloud Storage for Firebase API 사용 설정.
# 사용: 프로젝트 루트에서 ./scripts/relink-firebase-storage-bucket.sh
#      또는 npm run storage:relink-bucket

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-ohgo-dev-bc602}"
BUCKET_ID="${STORAGE_BUCKET_ID:-ohgo-dev-bc602.firebasestorage.app}"

# npm run 이 bash로 실행되면 .zshrc 를 읽지 않아 PATH에 gcloud가 없을 수 있음 → 흔한 설치 경로를 직접 탐색
GCLOUD="$(command -v gcloud 2>/dev/null || true)"
if [[ -z "${GCLOUD}" ]]; then
  for C in \
    "${HOME}/Downloads/google-cloud-sdk/bin/gcloud" \
    "${HOME}/google-cloud-sdk/bin/gcloud"; do
    if [[ -x "${C}" ]]; then
      GCLOUD="${C}"
      break
    fi
  done
fi
if [[ -z "${GCLOUD}" ]]; then
  echo "오류: gcloud CLI를 찾을 수 없습니다." >&2
  echo "터미널에서 한 번 실행: source ~/.zshrc" >&2
  echo "또는: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

"${GCLOUD}" config set project "${PROJECT_ID}" >/dev/null
PROJECT_NUMBER="$("${GCLOUD}" projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
URL="https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_NUMBER}/buckets/${BUCKET_ID}:addFirebase"

echo "addFirebase 호출 중..."
echo "  project_id=${PROJECT_ID}"
echo "  project_number=${PROJECT_NUMBER}"
echo "  bucket=${BUCKET_ID}"
echo "  URL=${URL}"
echo

OUT="$(mktemp)"
HTTP_CODE="$(curl -sS -o "${OUT}" -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $("${GCLOUD}" auth print-access-token)" \
  -H "Content-Type: application/json" \
  "${URL}")"
cat "${OUT}"
rm -f "${OUT}"
echo
if [[ "${HTTP_CODE}" =~ ^2 ]]; then
  echo "HTTP ${HTTP_CODE} — 완료. 몇 분 후 앱에서 업로드를 다시 시도하세요."
  exit 0
fi
echo "HTTP ${HTTP_CODE} — 실패했을 수 있습니다. 위 JSON 메시지를 확인하세요." >&2
exit 1
