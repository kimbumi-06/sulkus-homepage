import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, LogOut } from 'lucide-react';
import './AdminPage.css';
import { APPS_SCRIPT_URL, callAdmin } from './api';
import { GOOGLE_CLIENT_ID, clearToken, renderLoginButton, savedToken } from './googleLogin';
import { usePublishedData } from './usePublishedData';
import SyncPanel from './SyncPanel';
import GamesView from './GamesView';
import TermsView from './TermsView';

// 검색엔진에 노출되지 않도록 (robots.txt에 경로를 적으면 오히려 주소가 드러나서 meta로만 처리)
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Sulkus';
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);
}

/**
 * 로그인 + 운영진 확인 (확인은 Apps Script가 Google 토큰과 시트 편집자 목록으로 함)
 * status: 'signedOut' | 'checking' | 'admin' | 'denied'
 */
function useAdmin() {
  const [token, setToken] = useState(() => savedToken());
  const [state, setState] = useState(() => ({ status: token ? 'checking' : 'signedOut' }));

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    callAdmin('whoami', token)
      .then((info) => !cancelled && setState({ status: 'admin', info }))
      .catch((e) => {
        if (cancelled) return;
        if (e.expired) {
          clearToken();
          setToken(null);
          setState({ status: 'signedOut' });
        } else {
          setState({ status: 'denied', error: e.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const signIn = useCallback((t) => {
    setState({ status: 'checking' });
    setToken(t);
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
    setState({ status: 'signedOut' });
  }, []);

  // 요청 중 로그인이 만료되면 로그인 화면으로
  const onError = useCallback((e) => e.expired && signOut(), [signOut]);

  return { ...state, token, signIn, signOut, onError };
}

function LoginButton({ onToken }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    renderLoginButton(ref.current, onToken).catch((e) => setError(e.message));
  }, [onToken]);
  return (
    <div>
      <div ref={ref} />
      {error && <p className="sync__error">{error}</p>}
    </div>
  );
}

const TABS = [
  { id: 'games', label: '게임' },
  { id: 'terms', label: '장르·메커니즘 사전' },
];

function AdminContent({ token, info, onError }) {
  const [tab, setTab] = useState('games');
  const data = usePublishedData();

  return (
    <>
      <SyncPanel token={token} onError={onError} onChanged={data.reload} />

      <nav className="admin__tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <span className="admin__source">
          {data.source === 'published'
            ? `반영된 데이터${data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleString('ko-KR')}` : ''}`
            : '아직 반영 전 · 저장소 기본 데이터'}
        </span>
      </nav>

      {tab === 'games' && <GamesView games={data.games} sheet={info} />}
      {tab === 'terms' && <TermsView games={data.games} terms={data.terms} sheet={info} />}
    </>
  );
}

function AdminPage() {
  useNoIndex();
  const admin = useAdmin();

  if (!APPS_SCRIPT_URL || !GOOGLE_CLIENT_ID) {
    // 개발 중에만 안내 (배포된 사이트에서는 빈 화면)
    return (
      <div className="admin admin--center">
        {import.meta.env.DEV && 'VITE_APPS_SCRIPT_URL / VITE_GOOGLE_CLIENT_ID 설정이 없습니다. (.env.local)'}
      </div>
    );
  }

  if (admin.status === 'signedOut') {
    return (
      <div className="admin admin--center">
        <LoginButton onToken={admin.signIn} />
      </div>
    );
  }

  if (admin.status === 'checking') return <div className="admin admin--center" />;

  // 권한 없음: 무슨 페이지인지 드러내지 않고 다른 계정 로그인만
  if (admin.status === 'denied') {
    return (
      <div className="admin admin--center">
        <button type="button" className="admin__btn" onClick={admin.signOut}>
          <LogOut size={16} strokeWidth={1.75} /> 다른 계정으로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <h1>운영진</h1>
        <div className="admin__user">
          <a className="admin__btn admin__btn--ghost admin__btn--small" href={admin.info.sheetUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} strokeWidth={1.75} /> 스프레드시트 열기
          </a>
          <span>{admin.info.email}</span>
          <button type="button" className="admin__btn admin__btn--ghost admin__btn--small" onClick={admin.signOut}>
            <LogOut size={14} strokeWidth={1.75} /> 로그아웃
          </button>
        </div>
      </header>
      <AdminContent token={admin.token} info={admin.info} onError={admin.onError} />
    </div>
  );
}

export default AdminPage;
