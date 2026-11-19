// 장르/메커니즘 목록 도우미 (운영진 페이지 확인용)
import dictionary from '../data/dictionary';
import mechanicInfo from '../data/mechanicInfo';

export const TERM_TYPES = [
  { id: 'mechanics', label: '메커니즘', field: 'mechanics', koField: 'mechanics_ko' },
  { id: 'categories', label: '장르', field: 'categories', koField: 'categories_ko' },
];

const koToEn = Object.fromEntries(Object.entries(dictionary).map(([en, ko]) => [ko, en]));

// 새 형식(동기화 후)은 game.mechanics 가 영문 배열, 예전 형식은 한글 배열(mechanics_ko)만 믿을 수 있어서 역변환
function termsOfGame(game, type) {
  const raw = game[type.field];
  if (Array.isArray(raw)) return raw;
  return (game[type.koField] || []).map((ko) => koToEn[ko] || ko);
}

// 아직 한 번도 동기화하지 않았을 때: 기본 사전 값을 보여줌
function legacyTerm(en) {
  const ko = dictionary[en];
  if (!ko) return { ko: '', desc: '', source: 'none' };
  return { ko, desc: mechanicInfo[ko]?.desc || '', source: 'builtin' };
}

/** 화면에 보여줄 용어 목록: [{ en, count, published: {ko, desc, source} }] (많이 쓰인 순) */
export function collectTerms(games, publishedTerms, typeId) {
  const type = TERM_TYPES.find((t) => t.id === typeId);
  const counts = new Map();
  games.forEach((g) =>
    termsOfGame(g, type).forEach((en) => counts.set(en, (counts.get(en) || 0) + 1))
  );
  const published = publishedTerms?.[typeId] || {};
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([en, count]) => ({ en, count, published: published[en] || legacyTerm(en) }));
}
