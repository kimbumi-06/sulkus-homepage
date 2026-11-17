import { Link } from 'react-router-dom';
import './PageNav.css';

// 1 ... 4 5 [6] 7 8 ... 42 형태로 표시
function getPageList(current, total, delta = 2) {
  const list = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      list.push(i);
    } else if (list[list.length - 1] !== '...') {
      list.push('...');
    }
  }
  return list;
}

function PageNav({ current, totalPages, hrefFor }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="page-nav">
      {current > 1 && <Link to={hrefFor(current - 1)}>이전</Link>}
      {getPageList(current, totalPages).map((p, idx) =>
        p === '...' ? (
          <span key={`dots-${idx}`}>…</span>
        ) : (
          <Link
            key={p}
            to={hrefFor(p)}
            className={p === current ? 'active' : ''}
          >
            {p}
          </Link>
        )
      )}
      {current < totalPages && <Link to={hrefFor(current + 1)}>다음</Link>}
    </nav>
  );
}

export default PageNav;
