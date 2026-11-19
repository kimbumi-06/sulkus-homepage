import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import './AdminPage.css';
import { APPS_SCRIPT_URL, callAdmin } from './api';
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

// 스프레드시트 주소·시트 번호·게임별 행 번호 ("시트에서 수정" 링크용)
function useSheetInfo() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let cancelled = false;
    callAdmin('info')
      .then((data) => !cancelled && setInfo(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

const TABS = [
  { id: 'games', label: '게임' },
  { id: 'terms', label: '장르·메커니즘 사전' },
];

/** 확인용 페이지: 수정은 스프레드시트에서 (시트는 편집자로 공유된 운영진만 열 수 있음) */
function AdminPage() {
  useNoIndex();
  const [tab, setTab] = useState('games');
  const data = usePublishedData();
  const sheet = useSheetInfo();

  if (!APPS_SCRIPT_URL) {
    // 개발 중에만 안내 (배포된 사이트에서는 빈 화면)
    return (
      <div className="admin admin--center">
        {import.meta.env.DEV && 'VITE_APPS_SCRIPT_URL 설정이 없습니다. (.env.local)'}
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <h1>운영진</h1>
        {sheet && (
          <a className="admin__btn admin__btn--ghost admin__btn--small" href={sheet.sheetUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} strokeWidth={1.75} /> 스프레드시트 열기
          </a>
        )}
      </header>

      <SyncPanel onChanged={data.reload} />

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

      {tab === 'games' && <GamesView games={data.games} sheet={sheet} />}
      {tab === 'terms' && <TermsView games={data.games} terms={data.terms} sheet={sheet} />}
    </div>
  );
}

export default AdminPage;
