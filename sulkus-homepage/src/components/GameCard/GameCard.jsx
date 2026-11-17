import './GameCard.css';
import * as images from '../../assets/images';
import { formatRange, splitList, firstParagraph } from '../../utils/format';
import Marquee from '../Marquee/Marquee';

const MAX_MECHANICS = 3;

function GameCard({ game }) {
  const {
    name_ko, name_en, rating, rank,
    min_players, max_players, min_time, max_time,
    mechanics_ko = [], categories_ko = [], description, image,
  } = game;

  const mechanicList = mechanics_ko.slice(0, MAX_MECHANICS);
  const genre = categories_ko.join(', ');

  return (
    <article className="card">
      <header className="card__header">
        <div className="card__rating">
          <img className="card__rating-bg" src={images.rating} alt="" />
          <span className="card__rating-text">{Number(rating).toFixed(1)}</span>
        </div>
        <div className="card__title">
          <Marquee align='center' className="card__title-main" title={name_ko || name_en}>
            {name_ko || name_en}
          </Marquee>
          {name_ko && <Marquee align='center' className="card__title-sub">{name_en}</Marquee>}
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
            {rank === 'N/A' ? <span>랭킹 외</span> : <span>{rank}위</span>}
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
            <div className="card__mechanic" key={m} title={m}>
              {m.charAt(0)}
            </div>
          ))}
          <Marquee align='left' className="card__genre" title={genre}>{genre}</Marquee>
        </div>
        <div className="card__desc">
          <div className="card__desctext_box">
            <h className="description-text">{firstParagraph(description)}</h>
          </div>
        </div>
      </footer>
    </article>
  );
}

export default GameCard;