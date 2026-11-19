# 운영진 페이지 · 스프레드시트 설정 가이드

## 구조

```
구글 스프레드시트 (운영진만 편집자로 공유)  ← 여기서 수정
 ├─ 게임 시트 : 노란 열 "한글 제목 (수정)", "한글 설명 (수정)"
 ├─ 사전 시트 : 노란 열 "한글 (수정)", "설명 (수정)"   (장르·메커니즘)
 ├─ 메뉴 Sulkus : BGG 동기화 / 수정 내용 사이트에 반영 / 진행 상황
 └─ Apps Script (시트에 붙은 코드, apps-script/ 폴더)
      - BGG 컬렉션 가져오기 → 번역 안 된 것만 Claude로 번역 → 사이트용 JSON 만들기
      - 게임·사전 시트를 고치면 그때 바로 반영 (주기적으로 돌지 않음)
      - 웹 앱: 사이트에 게임 JSON 제공 + 운영진 페이지 요청 처리

운영진 페이지 /wlqqnwjsdyd  ← 확인 + 동기화 버튼
 - Google 로그인 (스프레드시트 편집자만 통과)
 - 게임·사전이 지금 어떻게 보이는지, 번역 출처(운영진/기본 사전/BGG/AI) 확인
 - "BGG 동기화", "지금 반영" 버튼, 진행 상황
 - 각 항목에서 "스프레드시트에서 수정" 바로가기

사이트 (방문자)
 - Apps Script 웹 앱의 게임 JSON을 읽음 (실패하면 저장소의 games.ko.json)
```

### 번역 우선순위

| 항목 | 1순위 | 2순위 | 3순위 | 4순위 |
|---|---|---|---|---|
| 게임 제목 | 시트 "한글 제목 (수정)" | BGG 한글 대체 이름 | AI 번역 | 영문 |
| 게임 설명 | 시트 "한글 설명 (수정)" | AI 번역 (영문이 바뀌면 다시 번역) | 영문 | |
| 장르·메커니즘 이름/설명 | 사전 시트 "(수정)" 열 | 기본 사전 (`Dictionary.gs`) | AI 번역 | 영문 |

- AI 설명 번역에는 위 사전이 용어집으로 들어가서, 설명 속 용어도 사전과 똑같이 번역됨.
- AI는 Claude Haiku 5.5. 이미 번역한 건 다시 번역하지 않으므로 첫 동기화(게임 약 500개) 이후엔 새 게임만 비용이 듦.
- 게임 추가·삭제 기능은 없음. 목록은 항상 BGG 컬렉션 기준 (컬렉션에서 빠진 게임은 시트에서도 빠짐, 다시 들어오면 예전 수정은 없음).
- 번역 실패한 칸은 `-` 로 표시되고, 다음 동기화 때 다시 번역됨.

## 처음 한 번 설정

### 1. 스프레드시트 만들기

1. 새 구글 스프레드시트 만들기 (이름 자유)
2. **공유** → 운영진 Google 계정을 **편집자**로 추가. 편집자 = 운영진 페이지 접속 가능한 사람.

### 2. Apps Script 코드 넣기

방법 A — 복사·붙여넣기
1. 스프레드시트 → **확장 프로그램 → Apps Script**
2. `apps-script/` 의 `.gs` 파일들(Bgg, Build, Dictionary, Menu, Sheets, Sync, Translate, Web)을 같은 이름으로 만들고 내용 붙여넣기
3. 프로젝트 설정(톱니바퀴) → "appsscript.json 매니페스트 파일 표시" 켜기 → `appsscript.json` 내용 붙여넣기

방법 B — clasp
```bash
npm install -g @google/clasp
clasp login
cd apps-script
cp .clasp.json.example .clasp.json   # scriptId 채우기 (Apps Script 프로젝트 설정에 있음)
clasp push
```

### 3. 스크립트 속성 (비밀 값)

Apps Script → 프로젝트 설정 → **스크립트 속성**에 추가:

| 속성 | 값 |
|---|---|
| `BGG_USERNAME` | BGG 사용자 이름 |
| `BGG_TOKEN` | BGG API 토큰 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `GOOGLE_CLIENT_ID` | 5번에서 만든 OAuth 클라이언트 ID |
| `ADMIN_EMAILS` | (선택) 편집자 말고 추가로 허용할 이메일, 쉼표 구분 |

> 시트 편집자는 Apps Script도 열 수 있어서 이 값들을 볼 수 있음. 편집자는 믿을 수 있는 운영진만.

### 4. 처음 설정 실행

스프레드시트 새로고침 → 메뉴 **Sulkus → 처음 설정** → 권한 허용.
게임·사전 시트, 숨은 시트, "시트를 고치면 반영" 트리거가 만들어짐.

### 5. Google 로그인용 OAuth 클라이언트

1. https://console.cloud.google.com → 프로젝트 만들기(아무 이름)
2. **API 및 서비스 → OAuth 동의 화면**: 외부, 앱 이름 입력, 게시 상태 "프로덕션" (기본 프로필·이메일만 쓰므로 검수 필요 없음)
3. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기** → 웹 애플리케이션
   - 승인된 JavaScript 원본: 사이트 주소(예: `https://sulkus.vercel.app`), 개발용 `http://localhost:5173`
4. 나온 클라이언트 ID(`...apps.googleusercontent.com`)를 3번 `GOOGLE_CLIENT_ID` 와 6번 `VITE_GOOGLE_CLIENT_ID` 에 넣기

### 6. 웹 앱 배포

Apps Script → **배포 → 새 배포** → 유형: 웹 앱
- 실행: **나**
- 액세스 권한: **모든 사용자**

나온 웹 앱 URL(`https://script.google.com/macros/s/.../exec`)을 복사.
코드를 고친 뒤엔 **배포 관리 → 수정 → 새 버전**으로 다시 배포 (URL 유지).

### 7. 사이트 환경 변수

`sulkus-homepage/.env.example` → `.env.local` 로 복사해서 채우기:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

Vercel/Netlify에도 같은 두 값을 환경 변수로 등록하고 다시 배포.
- Vercel: 루트 `sulkus-homepage`, `vercel.json` 이 모든 주소를 index.html로
- Netlify: 베이스 `sulkus-homepage`, 빌드 `npm run build`, 배포 폴더 `dist`, `public/_redirects`

### 8. 첫 동기화

시트 메뉴 **Sulkus → BGG 동기화** 또는 운영진 페이지의 **BGG 동기화** 버튼.
Apps Script는 한 번에 6분까지만 돌 수 있어서, 남은 일은 1분 뒤 자동으로 이어서 진행됨 (처음엔 총 5~15분).
진행 상황은 운영진 페이지나 메뉴 **진행 상황 보기**에서 확인.

## 자주 하는 일

- **BGG 컬렉션에 게임 추가/삭제** → 동기화 한 번
- **번역이 어색함** → 시트의 노란 열에 고쳐 쓰기 → 몇 초 안에 자동 반영 (동기화 중이면 동기화 끝날 때 반영)
- **운영진 수정 취소** → 노란 칸을 비우기 (자동 번역으로 돌아감)
- **기본 사전(`src/data/dictionary.js`)을 고침** → `npm --prefix apps-script run dictionary` 로 `Dictionary.gs` 다시 만들고 Apps Script에 올리기
- **로그 확인** → Apps Script → 실행 기록

## 코드 테스트 (로컬)

```bash
cd apps-script
npm install
npm test     # 번역 우선순위, 시트 합치기, BGG 파싱, 동기화 전체 흐름(서비스 흉내)
```
