// BGG 동기화 작업 (Apps Script 실행 시간 6분 제한 때문에 조금씩 나눠서 진행하고, 남으면 이어서 실행)
//   collection → things → merge → terms → names → descriptions → publish → done

const JOB_KEY = 'SYNC_JOB';
const SLICE_MS = 4.5 * 60 * 1000; // 한 번 실행에 쓸 시간
const STALE_MS = 30 * 60 * 1000; // 이보다 오래 멈춰 있으면 끊긴 작업으로 보고 새로 시작 허용

function loadJob_() {
  const raw = PropertiesService.getScriptProperties().getProperty(JOB_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveJob_(job) {
  job.updatedAt = Date.now();
  PropertiesService.getScriptProperties().setProperty(JOB_KEY, JSON.stringify(job));
}

/** 화면에 보여줄 진행 상황 */
function getStatus_() {
  const job = loadJob_();
  const props = PropertiesService.getScriptProperties();
  return {
    job: job && {
      state: job.state, step: job.step, done: job.done || 0, total: job.total || 0,
      message: job.message || '', error: job.error || null, by: job.by || null,
      startedAt: job.startedAt, finishedAt: job.finishedAt || null, updatedAt: job.updatedAt,
    },
    publishedAt: props.getProperty('PUBLISHED_AT'),
    pendingEdits: props.getProperty('DIRTY') === '1',
  };
}

function isRunning_(job) {
  return job && job.state === 'running' && Date.now() - (job.updatedAt || 0) < STALE_MS;
}

/** 동기화 시작. budgetMs 만큼 바로 진행하고, 남으면 트리거로 이어서 */
function startSync_(by, budgetMs) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('다른 작업이 진행 중이에요. 잠시 뒤 다시 시도하세요.');
  try {
    if (isRunning_(loadJob_())) throw new Error('이미 동기화가 진행 중이에요.');
    saveJob_({
      state: 'running', step: 'collection', cursor: 0, done: 0, total: 0,
      message: 'BGG 컬렉션 가져오는 중', by: by || null, startedAt: Date.now(),
    });
  } finally {
    lock.releaseLock();
  }
  return runSyncSlice_(budgetMs || SLICE_MS);
}

/** 시간 트리거가 부르는 함수 (이름 바꾸지 말 것) */
function continueSync() {
  runSyncSlice_(SLICE_MS);
}

function scheduleContinue_() {
  ScriptApp.newTrigger('continueSync').timeBased().after(60 * 1000).create();
}

function clearContinueTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'continueSync')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

function runSyncSlice_(budgetMs) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return getStatus_();
  let job = loadJob_();
  try {
    clearContinueTriggers_();
    const deadline = Date.now() + budgetMs;
    while (job && job.state === 'running' && Date.now() < deadline) {
      const step = syncSteps_()[job.step];
      if (!step) throw new Error(`알 수 없는 단계: ${job.step}`);
      job = step(job, deadline);
      saveJob_(job);
    }
    if (job && job.state === 'running') scheduleContinue_();
  } catch (e) {
    console.error(e);
    job = Object.assign(job || {}, {
      state: 'error', error: String((e && e.message) || e), message: '동기화 실패', finishedAt: Date.now(),
    });
    saveJob_(job);
  } finally {
    lock.releaseLock();
  }
  return getStatus_();
}

// ---------- 단계 ----------
// 각 단계는 deadline 전까지만 일하고, 다음에 이어갈 수 있게 job을 돌려준다.

function stepCollection_(job) {
  const ids = bggCollectionIds_();
  if (!ids.length) throw new Error('BGG 컬렉션이 비어 있어요. 사용자 이름/공개 설정을 확인하세요.');
  const tmp = ensureSheet_(SHEET.bggTmp, ['BGG ID', '데이터(JSON)'], true);
  writeRows_(SHEET.bggTmp, 2, ids.map((id) => [id, '']));
  tmp.hideSheet();
  return Object.assign(job, { step: 'things', cursor: 0, done: 0, total: ids.length, message: `BGG 게임 정보 0/${ids.length}` });
}

function stepThings_(job, deadline) {
  const sh = sheet_(SHEET.bggTmp);
  const ids = readRows_(SHEET.bggTmp, 1).map((r) => r[0]);
  let cursor = job.cursor || 0;
  while (cursor < ids.length && Date.now() < deadline) {
    const chunk = ids.slice(cursor, cursor + BGG_CHUNK);
    let games = [];
    try {
      games = bggThings_(chunk);
    } catch (e) {
      console.warn(`thing ${cursor + 1}~ 실패`, e); // 빠진 게임은 이번 반영에서 제외
    }
    const byId = new Map(games.map((g) => [g.id, g]));
    const values = chunk.map((id) => [byId.has(id) ? JSON.stringify(byId.get(id)) : '']);
    sh.getRange(cursor + 2, 2, chunk.length, 1).setValues(values);
    cursor += chunk.length;
    job.cursor = cursor;
    job.done = cursor;
    job.message = `BGG 게임 정보 ${cursor}/${ids.length}`;
    if (cursor < ids.length) Utilities.sleep(2000);
  }
  if (cursor < ids.length) return job;

  // 다 받았으면 원본 시트 교체
  const rows = readRows_(SHEET.bggTmp, 2).filter((r) => r[1]);
  if (!rows.length) throw new Error('BGG에서 게임 정보를 하나도 받지 못했어요.');
  ensureSheet_(SHEET.bgg, ['BGG ID', '데이터(JSON)'], true);
  writeRows_(SHEET.bgg, 2, rows);
  writeRows_(SHEET.bggTmp, 2, []);
  return Object.assign(job, { step: 'merge', cursor: 0, message: '시트 정리 중' });
}

function stepMerge_(job) {
  const raw = readBggGames_();
  writeRows_(SHEET.games, GAME_HEADERS.length, mergeGameRows_(raw, readRows_(SHEET.games, GAME_HEADERS.length)));
  writeRows_(SHEET.terms, TERM_HEADERS.length, mergeTermRows_(raw, readRows_(SHEET.terms, TERM_HEADERS.length), BUILTIN));
  return Object.assign(job, { step: 'terms', cursor: 0, done: 0, total: 0, message: '장르·메커니즘 번역' });
}

function stepPublish_(job) {
  const count = publish_();
  return Object.assign(job, {
    state: 'done', step: 'done', done: count, total: count,
    message: `완료: 게임 ${count}개`, finishedAt: Date.now(),
  });
}

// 단계 표는 실행할 때 만든다 (Apps Script는 파일 로드 순서가 보장되지 않아서 다른 파일 함수를 최상단에서 참조하지 않음)
function syncSteps_() {
  return {
    collection: stepCollection_,
    things: stepThings_,
    merge: stepMerge_,
    terms: stepTerms_, // Translate.gs
    names: stepNames_,
    descriptions: stepDescriptions_,
    publish: stepPublish_,
  };
}

// ---------- 반영 ----------

/** 시트 내용으로 사이트 JSON 다시 만들기. 게임 수를 돌려줌 */
function publish_() {
  const raw = readBggGames_();
  if (!raw.length) throw new Error('아직 BGG에서 가져온 적이 없어요. 먼저 동기화를 실행하세요.');
  const out = buildPublished_(
    raw,
    readRows_(SHEET.games, GAME_HEADERS.length),
    readRows_(SHEET.terms, TERM_HEADERS.length),
    BUILTIN
  );
  writePublished_(JSON.stringify(out));
  const props = PropertiesService.getScriptProperties();
  props.setProperty('PUBLISHED_AT', out.updatedAt);
  props.deleteProperty('DIRTY');
  return out.games.length;
}
