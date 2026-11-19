import { useEffect } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import './AdminPage.css';
import { isFirebaseConfigured } from './firebase';
import { useAdminAuth } from './useAdminAuth';

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
    </div>
  );
}

export default AdminPage;
