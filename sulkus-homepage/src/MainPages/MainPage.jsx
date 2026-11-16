import './MainPage.css';
import GameCard from '../components/GameCard/GameCard'
import * as images from '../assets/images/index'
import games from '../data/games.json'


function MainPage() {
  return (
    <div className="mainpage">
      <header className="mainpage__header">
        <img className="mainpage__logo" src={images.logo} alt="Sulkus" />
        <h1 className="mainpage__title">보드게임 리스트</h1>
      </header>

      <main className="mainpage__list">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </main>
    </div>
  );
}

export default MainPage;