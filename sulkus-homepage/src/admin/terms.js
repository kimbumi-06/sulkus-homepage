// 장르/메커니즘 사전 도우미
// 번역 우선순위: ① 운영진이 고친 값(Firestore terms, source: 'admin')
//               ② 기본 사전(src/data/dictionary.js + mechanicInfo.js의 설명)
//               ③ AI 번역(동기화 때 자동 생성, source: 'ai')
import dictionary from '../data/dictionary';
import mechanicInfo from '../data/mechanicInfo';

export const TERM_TYPES = [
  { id: 'mechanics', label: '메커니즘', field: 'mechanics', koField: 'mechanics_ko' },
  { id: 'categories', label: '장르', field: 'categories', koField: 'categories_ko' },
];

// Firestore 문서 id (영문 용어에 / 가 들어갈 수 있어서 인코딩)
export const termDocId = (type, en) => `${type}~${encodeURIComponent(en)}`;

const descByKo = Object.fromEntries(
  Object.entries(mechanicInfo).map(([ko, info]) => [ko, info.desc]).filter(([, d]) => d)
);

/** 기본 사전: 동기화 함수에도 그대로 넘겨서 ② 우선순위로 쓴다 */
export const builtinDictionary = { ko: dictionary, descByKo };

export function builtinTerm(en) {
  const ko = dictionary[en];
  return ko ? { ko, desc: descByKo[ko] || '' } : null;
}

const koToEn = Object.fromEntries(Object.entries(dictionary).map(([en, ko]) => [ko, en]));

// 반영된 게임 데이터에서 영문 용어 목록 뽑기.
// 새 형식은 game.mechanics 가 영문 배열, 예전 형식은 한글 배열(mechanics_ko)만 믿을 수 있어서 역변환
function termsOfGame(game, type) {
  const raw = game[type.field];
  if (Array.isArray(raw)) return raw;
  return (game[type.koField] || []).map((ko) => koToEn[ko] || ko);
}

/**
 * 화면에 보여줄 용어 목록: [{ en, count, published: {ko, desc} | null }]
 * (많이 쓰인 순)
 */
export function collectTerms(games, publishedTerms, typeId) {
  const type = TERM_TYPES.find((t) => t.id === typeId);
  const counts = new Map();
  games.forEach((g) =>
    termsOfGame(g, type).forEach((en) => counts.set(en, (counts.get(en) || 0) + 1))
  );
  const published = publishedTerms?.[typeId] || {};
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([en, count]) => ({ en, count, published: published[en] || null }));
}
