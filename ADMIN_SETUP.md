# 운영진 페이지 설정 가이드

운영진 페이지 주소: `https://<사이트 주소>/wlqqnwjsdyd` (사이트 어디에도 링크하지 않음, 검색엔진 색인 안 됨)

## 구조

```
운영진 페이지 (브라우저)
 ├─ Google 로그인 ─────────────── Firebase Authentication
 ├─ 게임 한글 제목·설명 수정 ──── Firestore  gameEdits/{BGG ID}
 ├─ 장르·메커니즘 번역·설명 수정 ─ Firestore  terms/{종류~영문}
 └─ 버튼 ──────────────────────── Cloud Functions
       syncGames   : BGG 컬렉션 가져오기 → 번역 안 된 것만 AI 번역 → public/games.json 덮어쓰기
       publishGames: 수정 내용만 다시 반영 (수정 후 3초 뒤 자동 호출)

사이트 (방문자)
 └─ Storage public/games.json 읽기 (실패하면 저장소의 games.ko.json)
```

### 번역 우선순위

| 항목 | 1순위 | 2순위 | 3순위 | 4순위 |
|---|---|---|---|---|
| 게임 제목 | 운영진 수정 | BGG 한글 대체 이름 | AI 번역 | 영문 |
| 게임 설명 | 운영진 수정 | AI 번역 (영문이 바뀌면 다시 번역) | 영문 | |
| 장르·메커니즘 | 운영진 사전 | 기본 사전 (`src/data/dictionary.js`, `mechanicInfo.js`) | AI 번역 | 영문 |

- AI 설명 번역에는 1·2순위 사전이 용어집으로 함께 들어가서, 설명 속 용어도 사전과 똑같이 번역됨.
- AI는 Claude Haiku 5.5. 이미 번역한 것은 다시 번역하지 않아서, 처음 한 번(게임 약 500개) 이후에는 새로 추가된 게임만 비용이 듦.
- 게임 추가·삭제 기능은 없음. 목록은 항상 BGG 컬렉션이 기준.

## 처음 한 번 설정

### 1. Firebase 프로젝트

1. https://console.firebase.google.com 에서 프로젝트 만들기
2. 요금제를 **Blaze**(종량제)로 변경 — Cloud Functions가 외부(BGG, Claude API)에 요청하려면 필요. 동아리 규모는 대부분 무료 한도 안.
3. **Authentication** → 로그인 방법 → **Google** 사용 설정
   - 설정 → 승인된 도메인에 배포 주소(예: `sulkus.vercel.app`) 추가
4. **Firestore Database** 만들기 (위치: `asia-northeast3` 서울)
5. **Storage** 시작하기 (같은 위치)
6. 프로젝트 설정 → 내 앱 → **웹 앱 추가** → 나오는 설정값을 아래 4번에 사용

### 2. 운영진 계정 등록

Firestore 콘솔에서 직접 문서 만들기 (웹에서는 수정 불가):

- 컬렉션 `config` / 문서 ID `admins`
- 필드 `emails` (array) → 운영진 Google 이메일들

운영진 추가·삭제는 이 배열만 고치면 됨.

### 3. 서버 함수 배포

```bash
npm install -g firebase-tools
firebase login
cd firebase
cp .firebaserc.example .firebaserc          # 안의 프로젝트 ID 수정
cp functions/.env.example functions/.env    # BGG_USERNAME 채우기
cd functions && npm install && cd ..
firebase functions:secrets:set ANTHROPIC_API_KEY   # Claude API 키 입력
firebase functions:secrets:set BGG_TOKEN           # BGG API 토큰 입력
firebase deploy --only firestore:rules,storage,functions
```

Storage를 브라우저에서 읽을 수 있게 CORS 설정 (버킷 이름은 Firebase 콘솔 Storage 화면에 있음):

```bash
gcloud storage buckets update gs://<버킷 이름> --cors-file=cors.json
```

### 4. 사이트 환경 변수

`sulkus-homepage/.env.example` 을 `.env.local` 로 복사해서 1-6의 웹 앱 설정값 입력.
Vercel/Netlify에도 같은 `VITE_FIREBASE_*` 값을 환경 변수로 등록하고 다시 배포.

- Vercel: 프로젝트 루트를 `sulkus-homepage` 로. `vercel.json` 이 모든 주소를 index.html로 보냄
- Netlify: 베이스 디렉터리 `sulkus-homepage`, 빌드 `npm run build`, 배포 폴더 `dist`. `public/_redirects` 가 같은 역할

### 5. 첫 동기화

`/wlqqnwjsdyd` 접속 → Google 로그인 → **BGG에서 가져와서 번역 + 반영**.
처음엔 설명 번역이 많아서 몇 분 걸림. 창을 닫아도 서버에서 계속 진행되고, 다시 열면 진행 상황이 보임.

## 자주 하는 일

- **새 게임이 BGG 컬렉션에 추가됨** → 동기화 버튼 한 번
- **번역이 어색함** → 게임 탭 / 사전 탭에서 고치고 저장 (3초 뒤 자동 반영)
- **운영진 수정을 취소** → 게임 탭은 "자동 번역으로 되돌리기" 후 저장, 사전 탭은 되돌리기 버튼
- **함수 로그 확인** → `firebase functions:log` 또는 콘솔 Functions 화면
