import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applyQuery } from '../utils/gameQuery';

/**
 * URL 쿼리(?page=3&q=...&sort=...)를 읽어서 현재 페이지에 보여줄 게임 목록을 돌려준다.
 * 검색/정렬/필터 값을 바꾸면 page는 자동으로 1로 돌아간다.
 */
export function useGameQuery(allGames, pageSize) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filtered = useMemo(
    () => applyQuery(allGames, searchParams),
    [allGames, searchParams]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Number(searchParams.get('page') ?? 1);
  const isValidPage =
    Number.isInteger(current) && current >= 1 && current <= totalPages;

  const start = (current - 1) * pageSize;
  const pageGames = isValidPage ? filtered.slice(start, start + pageSize) : [];

  // 다른 쿼리는 유지한 채 page만 바꾼 주소
  const pageHref = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    return `?${next.toString()}`;
  };

  // 검색/정렬/필터 값 변경. 값이 비면 주소에서 지우고, page는 1로 초기화
  const setParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  return {
    params: searchParams,
    setParams,
    pageGames,
    totalCount: filtered.length,
    totalPages,
    current,
    isValidPage,
    pageHref,
  };
}
