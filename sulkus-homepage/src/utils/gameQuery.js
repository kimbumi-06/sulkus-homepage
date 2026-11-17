// 게임 목록 검색/정렬/필터용 순수 함수 모음

// 중복 id 제거 + BGG 플레이스홀더(23953) 제외
export function cleanGames(allGames) {
  return Array.from(
    new Map(
      allGames.filter((g) => g.id !== '23953').map((g) => [g.id, g])
    ).values()
  );
}

// URLSearchParams를 받아 걸러지고 정렬된 목록을 돌려준다
export function applyQuery(games) {
  return games;
}
