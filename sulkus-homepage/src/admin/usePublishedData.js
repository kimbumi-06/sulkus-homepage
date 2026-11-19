import { useCallback, useEffect, useState } from 'react';
import { bundledData, fetchPublished } from '../data/published';
import { cleanGames } from '../utils/gameQuery';

/** 운영진 페이지용: 현재 사이트에 반영된 데이터 (없으면 저장소 기본 데이터) */
export function usePublishedData() {
  const [data, setData] = useState(() => ({
    ...bundledData,
    games: cleanGames(bundledData.games),
    source: 'bundled',
  }));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublished({ signal: controller.signal })
      .then((pub) => {
        if (pub) setData({ ...pub, games: cleanGames(pub.games), source: 'published' });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...data, reload };
}
