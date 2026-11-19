// Google 로그인 (Google Identity Services). 로그인하면 ID 토큰(1시간 유효)을 받아 Apps Script에 같이 보낸다.
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const STORAGE_KEY = 'sulkus-admin-token';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했어요.'));
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

// JWT 가운데 부분 읽기 (서버에서 다시 검증하므로 여기선 만료 시간만 봄)
function tokenExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

/** 새로고침해도 다시 로그인하지 않도록 탭이 열려 있는 동안만 보관 */
export function savedToken() {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    return token && tokenExp(token) > Date.now() + 60_000 ? token : null;
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰는 환경이면 무시
  }
  window.google?.accounts?.id?.disableAutoSelect();
}

/** element 자리에 Google 로그인 버튼 그리기. 로그인하면 onToken(idToken) */
export async function renderLoginButton(element, onToken) {
  await loadGis();
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: ({ credential }) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, credential);
      } catch {
        // 저장 못 해도 이번 화면에서는 로그인 유지
      }
      onToken(credential);
    },
  });
  window.google.accounts.id.renderButton(element, {
    theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko',
  });
}
