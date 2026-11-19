// 운영진 페이지의 "반영"으로 만들어진 게임 목록(JSON)을 불러온다.
// 아직 한 번도 반영하지 않았거나 불러오기에 실패하면, 저장소에 들어 있는 games.ko.json을 쓴다.
import bundledGames from './games.ko.json';

const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

export const PUBLISHED_URL =
  import.meta.env.VITE_GAMES_URL ||
  (bucket
    ? `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/public%2Fgames.json?alt=media`
    : null);

/**
 * 반영된 JSON은 { updatedAt, games: [...], terms: { mechanics: {...}, categories: {...} } } 형태.
 * 예전 형식(게임 배열만 있는 JSON)도 같은 모양으로 맞춰준다.
 */
export function normalizePublished(data) {
  if (Array.isArray(data)) return { updatedAt: null, games: data, terms: {} };
  return {
    updatedAt: data?.updatedAt ?? null,
    games: Array.isArray(data?.games) ? data.games : [],
    terms: data?.terms ?? {},
  };
}

export const bundledData = normalizePublished(bundledGames);

export async function fetchPublished({ signal } = {}) {
  if (!PUBLISHED_URL) return null;
  const res = await fetch(PUBLISHED_URL, { signal, cache: 'no-cache' });
  if (!res.ok) return null;
  const data = normalizePublished(await res.json());
  return data.games.length ? data : null;
}
