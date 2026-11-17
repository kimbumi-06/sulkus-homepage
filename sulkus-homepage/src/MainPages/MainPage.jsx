import './MainPage.css';
import { useEffect } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import GameCard from '../components/GameCard/GameCard';
import * as images from '../assets/images/index';
import allGames from '../data/games.ko.json';

const PAGE_SIZE = 12;

// 중복 id 제거 + BGG 플레이스홀더(23953) 제외. 모듈 로드 시 1회만 계산
const games = Array.from(
  new Map(
    allGames.filter((g) => g.id !== '23953').map((g) => [g.id, g])
  ).values()
);

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

function MainPage() {
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  const current = Number(searchParams.get('page') ?? 1);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [current]);

  if (!Number.isInteger(current) || current < 1 || current > totalPages) {
    return <Navigate to="/?page=1" replace />;
  }

  const start = (current - 1) * PAGE_SIZE;
  const currentGames = games.slice(start, start + PAGE_SIZE);

  return (
    <div className="mainpage">
      <header className="mainpage__header">
        <img className="mainpage__logo" src={images.logo} alt="Sulkus" />
        <h1 className="mainpage__title">보드게임 리스트</h1>
      </header>

      <main className="mainpage__list">
        {currentGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </main>

      <nav className="mainpage__pagination">
        {current > 1 && <Link to={`/?page=${current - 1}`}>이전</Link>}
        {getPageList(current, totalPages).map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`}>…</span>
          ) : (
            <Link
              key={p}
              to={`/?page=${p}`}
              className={p === current ? 'active' : ''}
            >
              {p}
            </Link>
          )
        )}
        {current < totalPages && <Link to={`/?page=${current + 1}`}>다음</Link>}
      </nav>
    </div>
  );
}

export default MainPage;
