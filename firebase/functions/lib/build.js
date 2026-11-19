// 사이트용 JSON 만들기 (AI 호출 없음, 순수 함수)
// 번역 우선순위
//   제목/설명: 운영진 수정(gameEdits) → (제목만) BGG 한글 대체 이름 → AI 번역 캐시 → 영문
//   장르/메커니즘: 운영진 수정(terms, source=admin) → 기본 사전(builtin) → AI 번역(terms, source=ai) → 영문
import { createHash } from 'node:crypto';

export const TERM_TYPES = ['mechanics', 'categories'];

export const hashText = (text) => createHash('sha1').update(text || '').digest('hex');

export const termKey = (type, en) => `${type}~${en}`;

/** Firestore terms 문서들 → Map(termKey → data) */
export function termsMap(docs) {
  const map = new Map();
  for (const d of docs) if (d?.type && d?.en) map.set(termKey(d.type, d.en), d);
  return map;
}

/** 한 용어의 최종 값 { ko, desc, source } */
export function resolveTerm(type, en, stored, builtin) {
  const s = stored.get(termKey(type, en));
  if (s?.source === 'admin' && s.ko) return { ko: s.ko, desc: s.desc || '', source: 'admin' };
  const bko = builtin?.ko?.[en];
  if (bko) {
    // 기본 사전은 설명이 없을 수 있어서, 그때는 AI 설명을 빌려옴
    const desc = builtin?.descByKo?.[bko] || (s?.desc ?? '');
    return { ko: bko, desc, source: 'builtin' };
  }
  if (s?.ko) return { ko: s.ko, desc: s.desc || '', source: s.source || 'ai' };
  return { ko: en, desc: '', source: 'none' };
}

/** 번역이 아직 없는 용어 (AI에 맡길 것) */
export function missingTerms(rawGames, stored, builtin) {
  const seen = new Set();
  const out = [];
  for (const g of rawGames) {
    for (const type of TERM_TYPES) {
      for (const en of g[type] || []) {
        const key = termKey(type, en);
        if (seen.has(key)) continue;
        seen.add(key);
        if (resolveTerm(type, en, stored, builtin).source === 'none') out.push({ type, en });
      }
    }
  }
  return out;
}

export function resolveName(g, edit, cache) {
  return edit?.name_ko || g.name_ko_bgg || cache?.name_ko || '';
}

export function resolveDescription(g, edit, cache) {
  if (edit?.description_ko) return edit.description_ko;
  if (cache?.description_ko && cache.descHash === hashText(g.description)) return cache.description_ko;
  return '';
}

/**
 * @param raw      BGG에서 가져온 게임 목록 (lib/bgg.js parseItem 형태)
 * @param edits    Map(id → gameEdits 문서)
 * @param stored   termsMap(...)
 * @param aiCache  Map(id → aiCache 문서)
 * @param builtin  { ko: {en: ko}, descByKo: {ko: desc} }
 */
export function buildPublished({ raw, edits, stored, aiCache, builtin, now = new Date() }) {
  const terms = { mechanics: {}, categories: {} };

  const games = raw.map((g) => {
    const edit = edits.get(g.id);
    const cache = aiCache.get(g.id);
    const koOf = (type) =>
      (g[type] || []).map((en) => {
        const t = resolveTerm(type, en, stored, builtin);
        terms[type][en] = t;
        return t.ko;
      });

    const { name_ko_bgg: _ignored, ...rest } = g;
    return {
      ...rest,
      name_ko: resolveName(g, edit, cache),
      description_ko: resolveDescription(g, edit, cache),
      mechanics_ko: koOf('mechanics'),
      categories_ko: koOf('categories'),
    };
  });

  return { updatedAt: now.toISOString(), games, terms };
}
