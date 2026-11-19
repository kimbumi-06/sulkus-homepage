// Apps Script 웹 앱 호출
// (Content-Type을 text/plain으로 보내야 브라우저가 사전 확인(preflight) 없이 바로 보냄 → Apps Script에서 CORS 문제 없음)
export const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;

export async function callAdmin(action) {
  if (!APPS_SCRIPT_URL) throw new Error('VITE_APPS_SCRIPT_URL 설정이 없어요.');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '요청 실패');
  return data;
}
