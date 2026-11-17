import './MainPage.css';
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import GameCard from '../../components/GameCard/GameCard';
import Pagination from '../../components/Pagination/Pagination';
import GameModal from '../../components/GameModal/GameModal';
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
  const [selected, setSelected] = useState(null);
  const closeModal = useCallback(() => setSelected(null), []);

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
          <GameCard key={game.id} game={game} onOpen={setSelected} />
        ))}
      </main>

      <Pagination current={current} totalPages={totalPages} hrefFor={pageHref} />

      <GameModal game={selected} onClose={closeModal} />
    </div>
  );
}

export default MainPage;
