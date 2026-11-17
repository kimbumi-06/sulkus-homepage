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

// ---------- 필터 ----------
export const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 = 8명 이상
export const TIME_OPTIONS = [
  { value: '30', label: '30분 이내' },
  { value: '60', label: '1시간 이내' },
  { value: '90', label: '1시간 반 이내' },
  { value: '120', label: '2시간 이내' },
  { value: 'long', label: '2시간 이상' },
];
export const RATING_OPTIONS = [6, 7, 7.5, 8];

// URL의 mech 값 구분자 (메커니즘 이름에 쉼표가 들어갈 수 있어서 | 사용)
export const MECH_SEP = '|';
export const parseMechs = (value) => (value ? value.split(MECH_SEP).filter(Boolean) : []);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function matchesPlayers(g, players) {
  if (!players) return true;
  const n = num(players);
  const min = num(g.min_players);
  const max = num(g.max_players) || min;
  if (n >= 8) return max >= 8;
  return min <= n && n <= max;
}

function matchesTime(g, time) {
  if (!time) return true;
  const t = num(g.max_time) || num(g.min_time);
  if (!t) return false; // 시간 정보 없는 게임은 제외
  if (time === 'long') return t >= 120;
  return t <= num(time);
}

function matchesRating(g, rating) {
  return !rating || num(g.rating) >= num(rating);
}

function matchesMechs(g, mechs) {
  if (mechs.length === 0) return true;
  const have = g.mechanics_ko || [];
  return mechs.every((m) => have.includes(m));
}

// 데이터에 있는 모든 메커니즘을 많이 쓰이는 순으로
export function collectMechanics(games) {
  const counts = new Map();
  games.forEach((g) =>
    (g.mechanics_ko || []).forEach((m) => counts.set(m, (counts.get(m) || 0) + 1))
  );
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

// 켜져 있는 필터 개수 (버튼 배지용)
export function countActiveFilters(params) {
  return (
    ['players', 'time', 'rating'].filter((k) => params.get(k)).length +
    parseMechs(params.get('mech')).length
  );
}

// URLSearchParams를 받아 걸러지고 정렬된 목록을 돌려준다
export function applyQuery(games, params) {
  const q = params.get('q') || '';
  const sort = comparators[params.get('sort')] ? params.get('sort') : DEFAULT_SORT;
  const players = params.get('players');
  const time = params.get('time');
  const rating = params.get('rating');
  const mechs = parseMechs(params.get('mech'));

  return games
    .filter(
      (g) =>
        matchesSearch(g, q) &&
        matchesPlayers(g, players) &&
        matchesTime(g, time) &&
        matchesRating(g, rating) &&
        matchesMechs(g, mechs)
    )
    .sort(comparators[sort]);
}
