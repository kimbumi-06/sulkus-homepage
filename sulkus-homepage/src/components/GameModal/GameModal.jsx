import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './GameModal.css';
import * as images from '../../assets/images';
import { formatRange } from '../../utils/format';
import { X, ExternalLink } from 'lucide-react';
import mechanicInfo from '../../data/mechanicInfo';

function GameModal({ game, onClose }) {
  // Esc로 닫기 + 모달 떠 있는 동안 뒤 페이지 스크롤 막기
  useEffect(() => {
    if (!game) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [game, onClose]);

  if (!game) return null;

  const {
    id, name_ko, name_en, rating, rank, weight,
    min_players, max_players, min_time, max_time,
    mechanics_ko = [], categories_ko = [], description, image,
  } = game;

  const paragraphs = (description || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  return createPortal(
    <div className="modal__overlay" onClick={onClose}>
      <article
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={name_ko || name_en}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="닫기">
          <X size={20} strokeWidth={1.75} />
        </button>

        <header className="modal__header">
          <div className="modal__rating">
            <img src={images.rating} alt="" />
            <span>{Number(rating).toFixed(1)}</span>
          </div>
          <div className="modal__title">
            <h2>{name_ko || name_en}</h2>
            {name_ko && <p>{name_en}</p>}
          </div>
        </header>

        <div className="modal__body">
          {image && <img className="modal__image" src={image} alt={name_en} />}

          <div className="modal__info">
            <ul className="modal__stats">
              <li>
                <img src={images.playtime} alt="" />
                <span>{formatRange(min_time, max_time)}분</span>
              </li>
              <li>
                <img src={images.players} alt="" />
                <span>{formatRange(min_players, max_players)}인</span>
              </li>
              <li>
                <img src={images.ranking} alt="" />
                <span>{rank === 'N/A' ? '랭킹 외' : `${rank}위`}</span>
              </li>
              {weight && Number(weight) > 0 && (
                <li>
                  <span className="modal__weight">난이도</span>
                  <span>{Number(weight).toFixed(1)} / 5</span>
                </li>
              )}
            </ul>

            {categories_ko.length > 0 && (
              <section>
                <h3>장르</h3>
                <div className="modal__chips">
                  {categories_ko.map((c) => <span key={c}>{c}</span>)}
                </div>
              </section>
            )}

            {mechanics_ko.length > 0 && (
              <section>
                <h3>메커니즘</h3>
                <div className="modal__chips modal__chips--mechanic">
                  {mechanics_ko.map((m) => {
                    const Icon = mechanicInfo[m]?.icon;
                    return (
                    <span key={m} className="modal__mech">
                      {Icon && <Icon className="modal__mech-icon" size={14} strokeWidth={1.75} />}
                      {m}
                      {mechanicInfo[m]?.desc && (
                        <span className="modal__mech-desc">{mechanicInfo[m].desc}</span>
                      )}
                    </span>
                    );
                  })}
                </div>
              </section>
            )}

            <a
              className="modal__bgg"
              href={`https://boardgamegeek.com/boardgame/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              BGG에서 보기 <ExternalLink size={13} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        {paragraphs.length > 0 && (
          <div className="modal__desc">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </article>
    </div>,
    document.body
  );
}

export default GameModal;
