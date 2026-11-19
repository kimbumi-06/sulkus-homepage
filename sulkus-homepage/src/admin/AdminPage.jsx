import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import './AdminPage.css';
import { isFirebaseConfigured } from './firebase';
import { useAdminAuth } from './useAdminAuth';
import { usePublishedData } from './usePublishedData';
import GamesTab from './GamesTab';
import DictionaryTab from './DictionaryTab';
import SyncPanel from './SyncPanel';
import { callPublish } from './api';

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

const TABS = [
  { id: 'games', label: '게임' },
  { id: 'terms', label: '장르·메커니즘 사전' },
];

const PUBLISH_DELAY_MS = 3000;

// 수정할 때마다 바로 반영하지 않고, 마지막 수정 3초 뒤 한 번만 반영
function useAutoPublish(onPublished) {
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const request = useCallback(() => {
    clearTimeout(timer.current);
    setState('waiting');
    timer.current = setTimeout(async () => {
      setState('publishing');
      try {
        await callPublish();
        setState('done');
        onPublished?.();
      } catch (e) {
        setError(e.message);
        setState('error');
      }
    }, PUBLISH_DELAY_MS);
  }, [onPublished]);

  return { state, error, request };
}

function AdminContent() {
  const [tab, setTab] = useState('games');
  const data = usePublishedData();
  const publish = useAutoPublish(data.reload);

  return (
    <>
      <SyncPanel publishState={publish.state} publishError={publish.error} onSynced={data.reload} />

      <nav className="admin__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="admin__source">
          {data.source === 'published'
            ? `반영된 데이터 기준${data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleString('ko-KR')}` : ''}`
            : '아직 반영 전 · 저장소 기본 데이터 기준'}
        </span>
      </nav>

      {tab === 'games' && <GamesTab games={data.games} onSaved={publish.request} />}
      {tab === 'terms' && <DictionaryTab games={data.games} terms={data.terms} onSaved={publish.request} />}
    </>
  );
}

function AdminPage() {
  useNoIndex();
  const { status, user, signIn, signOut } = useAdminAuth();

  if (!isFirebaseConfigured) {
    return <div className="admin admin--center">Firebase 설정이 없습니다. (.env.local)</div>;
  }

  if (status === 'loading') return <div className="admin admin--center" />;

  // 로그인 전 / 권한 없음: 무슨 페이지인지 드러내지 않고 로그인 버튼만
  if (status !== 'admin') {
    return (
      <div className="admin admin--center">
        <button type="button" className="admin__btn" onClick={status === 'denied' ? signOut : signIn}>
          {status === 'denied' ? (
            <>
              <LogOut size={16} strokeWidth={1.75} /> 다른 계정으로 로그인
            </>
          ) : (
            <>
              <LogIn size={16} strokeWidth={1.75} /> Google 로그인
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <h1>운영진</h1>
        <div className="admin__user">
          <span>{user.email}</span>
          <button type="button" className="admin__btn admin__btn--ghost" onClick={signOut}>
            <LogOut size={14} strokeWidth={1.75} /> 로그아웃
          </button>
        </div>
      </header>
      <AdminContent />
    </div>
  );
}

export default AdminPage;
