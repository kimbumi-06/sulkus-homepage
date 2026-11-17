import './MechanicIcon.css';
import mechanicInfo from '../../data/mechanicInfo';

// 이미지 경로인지(이모지가 아닌지) 판별
const isImagePath = (icon) => typeof icon === 'string' && /[./]/.test(icon);

/**
 * 메커니즘 동그라미 아이콘. 마우스를 올리면 이름 + 설명 말풍선이 뜬다.
 * 말풍선은 가장 가까운 position: relative 조상 기준으로 위에 표시된다.
 */
function MechanicIcon({ name, className = '' }) {
  const info = mechanicInfo[name];
  const icon = info?.icon;

  return (
    <span className={`mechanic ${className}`}>
      <span className="mechanic__circle" aria-label={name}>
        {isImagePath(icon) ? (
          <img src={icon} alt="" />
        ) : (
          icon || name.charAt(0)
        )}
      </span>
      <span className="mechanic__tip" role="tooltip">
        <strong>{name}</strong>
        {info?.desc && <span>{info.desc}</span>}
      </span>
    </span>
  );
}

export default MechanicIcon;
