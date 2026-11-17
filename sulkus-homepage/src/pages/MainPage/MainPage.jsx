import './MainPage.css';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import GameCard from '../../components/GameCard/GameCard';
import Pagination from '../../components/Pagination/Pagination';
import GameModal from '../../components/GameModal/GameModal';
import Toolbar from '../../components/Toolbar/Toolbar';
import { useGameQuery } from '../../hooks/useGameQuery';
import { cleanGames, collectMechanics } from '../../utils/gameQuery';
import * as images from '../../assets/images/index';
import allGames from '../../data/games.ko.json';

const PAGE_SIZE = 12;

// 모듈 로드 시 1회만 계산
const games = cleanGames(allGames);
const mechanics = collectMechanics(games);

function MainPage() {
  const { params, setParams, pageGames, totalCount, totalPages, current, isValidPage, pageHref } =
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
      <Link className="mainpage__brand" to="/?page=1">
        <img className="mainpage__logo" src={images.logo} alt="" />
        <span className="mainpage__brand-name">Sulkus</span>
      </Link>

      <Toolbar
        params={params}
        setParams={setParams}
        mechanics={mechanics}
      />

      {totalCount === 0 && (
        <p className="mainpage__empty">조건에 맞는 게임이 없어요.</p>
      )}

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
