// 웹 앱 (배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자)
//   GET  ?action=games          사이트용 게임 JSON (누구나)
//   POST {action, idToken}      운영진 페이지용 (Google 로그인 토큰 확인 + 시트 편집자만)
//        action: whoami | status | sync | publish
// 스크립트 속성: GOOGLE_CLIENT_ID (운영진 페이지 로그인용 OAuth 클라이언트 ID)
//               ADMIN_EMAILS (선택, 쉼표 구분: 시트 편집자 말고 추가로 허용할 이메일)

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'games';
  if (action !== 'games') return json_({ ok: false, error: 'unknown action' });
  const published = readPublished_();
  return ContentService.createTextOutput(published || '{"games":[],"terms":{}}')
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const email = verifyAdmin_(body.idToken);
    switch (body.action) {
      case 'whoami':
        return json_(Object.assign({ ok: true, email }, sheetInfo_()));
      case 'status':
        return json_(Object.assign({ ok: true }, getStatus_()));
      case 'sync':
        // 요청은 25초만 일하고 바로 응답, 나머지는 시간 트리거가 이어서 진행
        return json_(Object.assign({ ok: true }, startSync_(email, 25 * 1000)));
      case 'publish': {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(20000)) throw new Error('다른 작업이 진행 중이에요. 잠시 뒤 다시 시도하세요.');
        try {
          const count = publish_();
          return json_(Object.assign({ ok: true, count }, getStatus_()));
        } finally {
          lock.releaseLock();
        }
      }
      default:
        throw new Error('알 수 없는 요청');
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 시트 바로가기 정보 (운영진 페이지의 "시트에서 수정" 링크용) */
function sheetInfo_() {
  const ss = ss_();
  const games = sheet_(SHEET.games);
  const terms = sheet_(SHEET.terms);
  const rows = {};
  readRows_(SHEET.games, 1).forEach((r, i) => { if (r[0]) rows[r[0]] = i + 2; });
  return {
    sheetUrl: ss.getUrl(),
    gids: { games: games ? games.getSheetId() : null, terms: terms ? terms.getSheetId() : null },
    rows,
  };
}

// ---------- 운영진 확인 ----------

/** 운영진 = 이 스프레드시트의 소유자·편집자 (+ ADMIN_EMAILS) */
function adminEmails_() {
  const ss = ss_();
  const emails = new Set();
  try {
    ss.getEditors().forEach((u) => emails.add(u.getEmail().toLowerCase()));
    const owner = ss.getOwner();
    if (owner) emails.add(owner.getEmail().toLowerCase());
  } catch (e) {
    console.warn('편집자 목록을 못 읽음', e);
  }
  const extra = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  extra.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((m) => emails.add(m));
  return emails;
}

/** Google ID 토큰 확인 → 운영진이면 이메일, 아니면 오류 */
function verifyAdmin_(idToken) {
  if (!idToken) throw new Error('로그인이 필요해요.');
  const cache = CacheService.getScriptCache();
  const cacheKey = `tok:${hashText_(idToken)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const res = UrlFetchApp.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('로그인이 만료됐어요. 다시 로그인하세요.');
  const info = JSON.parse(res.getContentText());
  const clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId || info.aud !== clientId) throw new Error('로그인 설정이 맞지 않아요. (GOOGLE_CLIENT_ID)');
  if (String(info.email_verified) !== 'true') throw new Error('이메일 인증이 안 된 계정이에요.');
  if (Number(info.exp) * 1000 < Date.now()) throw new Error('로그인이 만료됐어요. 다시 로그인하세요.');

  const email = String(info.email).toLowerCase();
  if (!adminEmails_().has(email)) throw new Error('권한이 없어요.');
  cache.put(cacheKey, email, 600);
  return email;
}
