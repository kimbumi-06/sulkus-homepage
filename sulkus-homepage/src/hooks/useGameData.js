import { useEffect, useMemo, useState } from 'react';
import { bundledData, fetchPublished } from '../data/published';
import { cleanGames } from '../utils/gameQuery';

/**
 * 사이트용 게임 데이터.
 * 처음엔 저장소에 들어 있는 데이터로 바로 그리고, 운영진 페이지에서 반영한 최신 데이터가 있으면 바꿔 끼운다.
 */
export function useGameData() {
  const [data, setData] = useState(bundledData);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublished({ signal: controller.signal })
      .then((pub) => pub && setData(pub))
      .catch(() => {}); // 실패하면 저장소 데이터 그대로
    return () => controller.abort();
  }, []);

  const games = useMemo(() => cleanGames(data.games), [data]);

  // 한글 이름 → 설명 (운영진 사전 / AI 번역에서 온 것)
  const termDescs = useMemo(() => {
    const byKo = {};
    for (const type of ['mechanics', 'categories']) {
      byKo[type] = {};
      for (const t of Object.values(data.terms?.[type] || {})) {
        if (t?.ko && t?.desc) byKo[type][t.ko] = t.desc;
      }
    }
    return byKo;
  }, [data]);

  return { games, termDescs };
}
