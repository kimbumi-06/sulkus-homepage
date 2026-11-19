import './MainPage.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import GameCard from '../../components/GameCard/GameCard';
import PageNav from '../../components/PageNav/PageNav';
import GameModal from '../../components/GameModal/GameModal';
import Toolbar from '../../components/Toolbar/Toolbar';
import { useGameQuery } from '../../hooks/useGameQuery';
import { useGameData } from '../../hooks/useGameData';
import { TermDescContext } from '../../data/termDescs';
import { collectMechanics } from '../../utils/gameQuery';
import * as images from '../../assets/images/index';

const PAGE_SIZE = 12;

function MainPage() {
  // 저장소 데이터로 바로 그리고, 운영진 페이지에서 반영한 최신 데이터가 오면 교체
  const { games, termDescs } = useGameData();
  const mechanics = useMemo(() => collectMechanics(games), [games]);
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
    <TermDescContext.Provider value={termDescs}>
      <div className="mainpage">
        <Toolbar
          brand={
            <Link className="mainpage__brand" to="/?page=1">
              <img className="mainpage__logo" src={images.logo} alt="" />
              <span className="mainpage__brand-name">Sulkus</span>
            </Link>
          }
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

        <PageNav current={current} totalPages={totalPages} hrefFor={pageHref} />

        <GameModal game={selected} onClose={closeModal} />
      </div>
    </TermDescContext.Provider>
  );
}

export default MainPage;
