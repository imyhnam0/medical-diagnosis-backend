#!/bin/bash

# Lambda 배포용 zip 파일 생성 스크립트

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 기존 zip 파일 삭제
if [ -f "lambda-deployment.zip" ]; then
  echo "🗑️  기존 lambda-deployment.zip 삭제 중..."
  rm lambda-deployment.zip
fi

echo "📦 Lambda 배포용 zip 파일 생성 중..."

# zip 파일 생성 (필요한 파일들만 포함)
zip -r lambda-deployment.zip \
  server.js \
  package.json \
  package-lock.json \
  config/ \
  routes/ \
  services/ \
  utils/ \
  gradproj-cfcb3-firebase-adminsdk-fbsvc-737da01a71.json \
  node_modules/ \
  -x "*.DS_Store" \
  -x "*.git/*" \
  -x "*.env" \
  -x "*.log" \
  -x "app.zip" \
  -x "lambda-deployment.zip"

echo "✅ lambda-deployment.zip 파일 생성 완료!"
echo "📊 파일 크기: $(du -h lambda-deployment.zip | cut -f1)"

