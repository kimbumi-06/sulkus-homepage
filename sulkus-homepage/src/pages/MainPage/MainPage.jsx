import './MainPage.css';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import GameCard from '../../components/GameCard/GameCard';
import Pagination from '../../components/Pagination/Pagination';
import { useGameQuery } from '../../hooks/useGameQuery';
import { cleanGames } from '../../utils/gameQuery';
import * as images from '../../assets/images/index';
import allGames from '../../data/games.ko.json';

const PAGE_SIZE = 12;

// 모듈 로드 시 1회만 계산
const games = cleanGames(allGames);

function MainPage() {
  const { pageGames, totalPages, current, isValidPage, pageHref } =
    useGameQuery(games, PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [current]);

  if (!isValidPage) {
    return <Navigate to={pageHref(1)} replace />;
  }

  return (
    <div className="mainpage">
      <header className="mainpage__header">
        <img className="mainpage__logo" src={images.logo} alt="Sulkus" />
        <h1 className="mainpage__title">보드게임 리스트</h1>
      </header>

      <main className="mainpage__list">
        {pageGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </main>

      <Pagination current={current} totalPages={totalPages} hrefFor={pageHref} />
    </div>
  );
}

export default MainPage;
