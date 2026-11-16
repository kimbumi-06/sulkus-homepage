import './GameCard.css';
import * as images from '../../assets/images';
import { formatRange, splitList, firstParagraph } from '../../utils/format';

const MAX_MECHANICS = 3;

function GameCard({ game }) {
  const {
    name_ko, name_en, rating, rank,
    min_players, max_players, min_time, max_time,
    mechanics, categories, description, image,
  } = game;

  const mechanicList = splitList(mechanics).slice(0, MAX_MECHANICS);
  const genre = splitList(categories).join(', ');

  return (
    <article className="card">
      <header className="card__header">
        <div className="card__rating">
          <img className="card__rating-bg" src={images.rating} alt="" />
          <span className="card__rating-text">{Number(rating).toFixed(1)}</span>
        </div>
        <div className="card__title">
          <div className="card__title-main" title={name_ko || name_en}>
            {name_ko || name_en}
          </div>
          {name_ko && <div className="card__title-sub">{name_en}</div>}
        </div>
      </header>

      <div className="card__body">
        <aside className="card__stats">
          <div className="card__stat">
            <img src={images.playtime} alt="플레이 시간(분)" />
            <span>{formatRange(min_time, max_time)}</span>
          </div>
          <div className="card__stat">
            <img src={images.players} alt="플레이 인원" />
            <span>{formatRange(min_players, max_players)}인</span>
          </div>
          <div className="card__stat">
            <img src={images.ranking} alt="BGG 랭킹" />
            <span>{rank}위</span>
          </div>
        </aside>

        <img
          className="card__image"
          src={image || images.placeholder}
          alt={name_en}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = images.placeholder;
          }}
        />
      </div>

      <footer className="card__footer">
        <div className="card__tags">
          {mechanicList.map((m) => (
            <span className="card__mechanic" key={m} title={m}>
              {m.charAt(0)}
            </span>
          ))}
          <span className="card__genre" title={genre}>{genre}</span>
        </div>
        <p className="card__desc">{firstParagraph(description)}</p>
      </footer>
    </article>
  );
}

export default GameCard;