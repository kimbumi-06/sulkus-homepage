import './GameCard.css';
import * as images from '../../assets/images';
import { formatRange, firstParagraph } from '../../utils/format';
import Marquee from '../Marquee/Marquee';
import Mechanism from '../Mechanism/Mechanism';
import FadeScroll from '../FadeScroll/FadeScroll';

const MAX_MECHANICS = 3;

function GameCard({ game, onOpen }) {
  const {
    name_ko, name_en, rating, rank,
    min_players, max_players, min_time, max_time,
    mechanics_ko = [], categories_ko = [], description, description_ko, image,
  } = game;

  const mechanicList = mechanics_ko.slice(0, MAX_MECHANICS);
  const genre = categories_ko.join(', ');

  return (
    <article
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => {
        // 글자를 드래그해서 선택 중이면 모달을 열지 않음
        if (window.getSelection()?.toString()) return;
        onOpen?.(game);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(game);
        }
      }}
    >
      <header className="card__header">
        <div className="card__rating">
          <img className="card__rating-bg" src={images.rating} alt="" />
          <span className="card__rating-text">{Number(rating).toFixed(1)}</span>
        </div>
        <div className="card__title">
          <Marquee align='center' className="card__title-main">
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
          src={image}
          alt={name_en}
          loading="lazy"
        />
      </div>

      <footer className="card__footer">
        <div className="card__tags">
          {mechanicList.map((m) => (
            <Mechanism className="card__mechanic" key={m} name={m} />
          ))}
          <Marquee align='left' className="card__genre">{genre}</Marquee>
        </div>
        <div className="card__desc">
          <FadeScroll className="card__desctext_box">
            <p className="description-text">{firstParagraph(description_ko || description)}</p>
          </FadeScroll>
        </div>
      </footer>
    </article>
  );
}

export default GameCard;