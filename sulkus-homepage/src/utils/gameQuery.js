// 게임 목록 검색/정렬/필터용 순수 함수 모음

// 중복 id 제거 + BGG 플레이스홀더(23953) 제외
export function cleanGames(allGames) {
  return Array.from(
    new Map(
      allGames.filter((g) => g.id !== '23953').map((g) => [g.id, g])
    ).values()
  );
}

export const SORT_OPTIONS = [
  { value: 'rank', label: '랭킹순' },
  { value: 'name', label: '가나다순' },
  { value: 'rating', label: '평점순' },
];
export const DEFAULT_SORT = 'rank';

// 공백/대소문자 무시 비교용
const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, '');

const displayName = (g) => g.name_ko || g.name_en || '';

// 랭킹 없는(N/A) 게임은 맨 뒤로
const rankValue = (g) => {
  const n = Number(g.rank);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
};

const comparators = {
  rank: (a, b) => rankValue(a) - rankValue(b),
  name: (a, b) => displayName(a).localeCompare(displayName(b), 'ko'),
  rating: (a, b) => Number(b.rating) - Number(a.rating),
};

export function matchesSearch(game, q) {
  const needle = normalize(q);
  if (!needle) return true;
  return (
    normalize(game.name_ko).includes(needle) ||
    normalize(game.name_en).includes(needle)
  );
}

// URLSearchParams를 받아 걸러지고 정렬된 목록을 돌려준다
export function applyQuery(games, params) {
  const q = params.get('q') || '';
  const sort = comparators[params.get('sort')] ? params.get('sort') : DEFAULT_SORT;

  return games
    .filter((g) => matchesSearch(g, q))
    .sort(comparators[sort]);
}
