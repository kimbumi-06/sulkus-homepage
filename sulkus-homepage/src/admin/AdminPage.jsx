import { useEffect } from 'react';
import './AdminPage.css';

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
  return <div className="admin admin--center" />;
}

export default AdminPage;
