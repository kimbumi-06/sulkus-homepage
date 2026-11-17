import { SORT_OPTIONS } from '../../utils/gameQuery';

function SortSelect({ value, onChange }) {
  return (
    <div className="sortselect" role="radiogroup" aria-label="정렬">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default SortSelect;
