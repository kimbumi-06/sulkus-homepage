import './Mechanism.css';
import mechanicInfo from '../../data/mechanicInfo';
import { useTermDesc } from '../../data/termDescs';

/**
 * 메커니즘 동그라미 아이콘(선 아이콘). 마우스를 올리면 이름 + 설명 말풍선이 뜬다.
 * 말풍선은 가장 가까운 position: relative 조상 기준으로 위에 표시된다.
 */
function Mechanism({ name, className = '' }) {
  const info = mechanicInfo[name];
  const Icon = info?.icon;
  const desc = useTermDesc('mechanics', name);

  return (
    <span className={`mechanic ${className}`}>
      <span className="mechanic__circle" aria-label={name}>
        {Icon ? <Icon size={15} strokeWidth={1.75} aria-hidden="true" /> : name.charAt(0)}
      </span>
      <span className="mechanic__tip" role="tooltip">
        <strong>{name}</strong>
        {desc && <span>{desc}</span>}
      </span>
    </span>
  );
}

export default Mechanism;
