// 웹 앱 (배포 → 웹 앱, 실행: 나, 액세스: 모든 사용자)
//   GET  ?action=games     사이트용 게임 JSON
//   POST {action}          운영진 페이지용: info | status | sync | publish
// 수정은 스프레드시트(편집자만)에서 하므로 여기엔 로그인이 없음.
// 대신 동기화는 10분에 한 번만 시작할 수 있게 막아둠 (BGG에 요청을 너무 자주 보내지 않도록)

const SYNC_COOLDOWN_MS = 10 * 60 * 1000;

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
    switch (body.action) {
      case 'info':
        return json_(Object.assign({ ok: true }, sheetInfo_()));
      case 'status':
        return json_(Object.assign({ ok: true }, getStatus_()));
      case 'sync': {
        const job = loadJob_();
        const last = job && (job.finishedAt || job.startedAt);
        if (!isRunning_(job) && last && Date.now() - last < SYNC_COOLDOWN_MS) {
          const min = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - last)) / 60000);
          throw new Error(`동기화는 10분에 한 번만 할 수 있어요. ${min}분 뒤에 다시 시도하세요.`);
        }
        // 요청은 25초만 일하고 바로 응답, 나머지는 시간 트리거가 이어서 진행
        return json_(Object.assign({ ok: true }, startSync_('운영진 페이지', 25 * 1000)));
      }
      case 'publish': {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(20000)) throw new Error('다른 작업이 진행 중이에요. 잠시 뒤 다시 시도하세요.');
        try {
          const count = publishPending_();
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

/**
 * 시트 바로가기 정보 (운영진 페이지의 "시트에서 수정" 링크용)
 * 시트 자체는 편집자로 공유된 사람만 열 수 있음
 */
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
