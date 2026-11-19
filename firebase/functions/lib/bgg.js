// BGG XML API2 에서 컬렉션 → 게임 상세 가져오기 (bgg-fetch/bgg-fetch.py 를 Node로 옮긴 것)
import { XMLParser } from 'fast-xml-parser';
import { decodeHTML } from 'entities';

const BASE = 'https://boardgamegeek.com/xmlapi2';
const CHUNK = 10; // thing 호출당 게임 수 (최대 20)
const SLEEP_MS = 2500; // 호출 간 대기

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  htmlEntities: true,
  // 태그만 배열로 (rank의 name 같은 속성은 제외)
  isArray: (name, _jpath, _isLeaf, isAttribute) =>
    !isAttribute && ['item', 'name', 'link', 'rank'].includes(name),
});

async function fetchXml(path, params, token, retries = 8) {
  const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': 'boardgame-club-sync',
        Accept: 'application/xml',
      },
    });
    if (res.status === 202) { await sleep(10_000); continue; } // 컬렉션 생성 대기
    if (res.status === 429) { await sleep(15_000); continue; } // 요청 과다
    if (!res.ok) throw new Error(`BGG ${path} ${res.status}`);
    return parser.parse(await res.text());
  }
  throw new Error(`BGG ${path} 요청 실패(재시도 초과)`);
}

export async function fetchCollectionIds(username, token) {
  const xml = await fetchXml('collection', { username, showprivate: 1, version: 2 }, token);
  return (xml.items?.item || []).map((it) => String(it.objectid));
}

const val = (node) => (node && typeof node === 'object' ? node.value ?? '' : '');

const fmt = (x, digits) => {
  const n = Number.parseFloat(x);
  return Number.isFinite(n) ? n.toFixed(digits) : '';
};

// 이중 인코딩된 엔티티(&amp;mdash; 등)까지 풀고 HTML 태그 제거
export function cleanDescription(text) {
  let s = typeof text === 'string' ? text : '';
  for (let i = 0; i < 2; i++) s = decodeHTML(s);
  return s.replace(/<[^>]+>/g, '').trim();
}

export function parseItem(it) {
  const names = it.name || [];
  const name_en = names.find((n) => n.type === 'primary')?.value ?? '';
  // BGG 대체 이름 중 한글이 들어간 것 (공식 한글판 이름인 경우가 많음)
  const name_ko_bgg = names.map((n) => String(n.value ?? '')).find((v) => /[가-힣]/.test(v)) ?? '';

  const ranks = it.statistics?.ratings?.ranks?.rank || [];
  let rank = String(ranks.find((r) => r.name === 'boardgame')?.value ?? '');
  if (!rank || rank === 'Not Ranked') rank = 'N/A';

  const links = it.link || [];
  const pick = (type) => links.filter((l) => l.type === type).map((l) => String(l.value));

  return {
    id: String(it.id),
    name_en: String(name_en),
    name_ko_bgg,
    rank,
    rating: fmt(val(it.statistics?.ratings?.average), 1),
    mechanics: pick('boardgamemechanic'),
    categories: pick('boardgamecategory'),
    weight: fmt(val(it.statistics?.ratings?.averageweight), 2),
    min_players: String(val(it.minplayers)),
    max_players: String(val(it.maxplayers)),
    min_time: String(val(it.minplaytime)),
    max_time: String(val(it.maxplaytime)),
    has_expansion: links.some((l) => l.type === 'boardgameexpansion') ? 'Yes' : 'No',
    description: cleanDescription(it.description),
    image: String(it.image || it.thumbnail || ''),
  };
}

/** 컬렉션 전체 게임 상세. onProgress(done, total) */
export async function fetchGames({ username, token, onProgress, limit } = {}) {
  let ids = await fetchCollectionIds(username, token);
  if (limit) ids = ids.slice(0, limit);
  const byId = new Map();
  for (let n = 0; n < ids.length; n += CHUNK) {
    const chunk = ids.slice(n, n + CHUNK);
    try {
      const xml = await fetchXml('thing', { id: chunk.join(','), stats: 1 }, token);
      for (const it of xml.items?.item || []) byId.set(String(it.id), parseItem(it));
    } catch (e) {
      console.warn(`thing ${n + 1}~${n + chunk.length} 실패`, e);
    }
    await onProgress?.(Math.min(n + CHUNK, ids.length), ids.length);
    if (n + CHUNK < ids.length) await sleep(SLEEP_MS);
  }
  // 컬렉션 순서 유지, 못 받은 게임은 빼고 (다음 동기화 때 다시 시도)
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
