// 스프레드시트 구조와 읽기/쓰기
// 운영진은 노란색 열(… (수정))만 고치면 된다. 나머지 열은 동기화가 채운다.

const SHEET = {
  games: '게임',
  terms: '사전',
  bgg: '_bgg', // BGG 원본 (숨김)
  bggTmp: '_bgg_tmp', // 동기화 중 임시 (숨김)
  published: '_published', // 사이트용 JSON 조각 (숨김)
};

// 게임 시트 열 (1부터)
const G = {
  id: 1, nameEn: 2, nameKoEdit: 3, descKoEdit: 4, nameKoAuto: 5, descKoAuto: 6, descEn: 7, descHash: 8,
};
const GAME_HEADERS = [
  'BGG ID', '영문 제목', '한글 제목 (수정)', '한글 설명 (수정)',
  '자동 한글 제목', '자동 한글 설명', '영문 설명', '설명 해시',
];

// 사전 시트 열
const T = {
  type: 1, en: 2, koEdit: 3, descEdit: 4, koBase: 5, descBase: 6, koAi: 7, descAi: 8, count: 9,
};
const TERM_HEADERS = [
  '종류', '영문', '한글 (수정)', '설명 (수정)',
  '기본 사전 한글', '기본 사전 설명', '자동 한글', '자동 설명', '게임 수',
];
const TERM_TYPE_LABEL = { mechanics: '메커니즘', categories: '장르' };
const TERM_TYPE_BY_LABEL = { 메커니즘: 'mechanics', 장르: 'categories' };

const CELL_CHUNK = 45000; // 셀 하나 최대 5만 자

// 메뉴에서 실행할 땐 열린 시트, 웹 앱·시간 트리거에서는 setup 때 저장한 ID로 연다
function ss_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('먼저 스프레드시트에서 Sulkus > 처음 설정 을 실행하세요.');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  return ss_().getSheetByName(name);
}

function ensureSheet_(name, headers, hidden) {
  let sh = sheet_(name);
  if (!sh) sh = ss_().insertSheet(name);
  if (headers) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  if (hidden) sh.hideSheet();
  return sh;
}

/** 헤더 제외 전체 행 (값은 문자열로) */
function readRows_(name, width) {
  const sh = sheet_(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, width).getDisplayValues();
}

/** 헤더 아래를 통째로 바꿔 쓰기 */
function writeRows_(name, width, rows) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(width, sh.getLastColumn())).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
}

// ---------- BGG 원본 ----------
function readBggGames_() {
  return readRows_(SHEET.bgg, 2)
    .filter((r) => r[1])
    .map((r) => JSON.parse(r[1]));
}

// ---------- 사이트용 JSON 저장 (긴 문자열을 여러 셀에 나눠서) ----------
function writePublished_(json) {
  const sh = ensureSheet_(SHEET.published, null, true);
  sh.clearContents();
  const parts = [];
  for (let i = 0; i < json.length; i += CELL_CHUNK) parts.push([json.slice(i, i + CELL_CHUNK)]);
  sh.getRange(1, 1, parts.length, 1).setValues(parts);
  cachePut_('published', json);
}

function readPublished_() {
  const cached = cacheGet_('published');
  if (cached) return cached;
  const sh = sheet_(SHEET.published);
  if (!sh || sh.getLastRow() < 1) return null;
  const json = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map((r) => r[0]).join('');
  if (json) cachePut_('published', json);
  return json || null;
}

// ---------- 캐시 (값 하나 100KB 제한이라 쪼개서) ----------
const CACHE_PART = 90000;
const CACHE_SECONDS = 6 * 60 * 60;

function cachePut_(key, text) {
  const cache = CacheService.getScriptCache();
  const parts = {};
  let n = 0;
  for (let i = 0; i < text.length; i += CACHE_PART, n++) parts[`${key}:${n}`] = text.slice(i, i + CACHE_PART);
  parts[`${key}:n`] = String(n);
  try {
    cache.putAll(parts, CACHE_SECONDS);
  } catch (e) {
    console.warn('cache put 실패', e);
  }
}

function cacheGet_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(`${key}:n`));
  if (!n) return null;
  const keys = Array.from({ length: n }, (_, i) => `${key}:${i}`);
  const got = cache.getAll(keys);
  if (keys.some((k) => got[k] == null)) return null;
  return keys.map((k) => got[k]).join('');
}

function cacheClear_(key) {
  CacheService.getScriptCache().remove(`${key}:n`);
}
