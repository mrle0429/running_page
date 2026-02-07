interface TotalYearSwitcherProps {
  activeYear: string;
  years: string[];
  onYearChange: (_year: string) => void;
}

const TotalYearSwitcher = ({
  activeYear,
  years,
  onYearChange,
}: TotalYearSwitcherProps) => {
  return (
    <aside className="w-20 shrink-0">
      <ul className="space-y-1">
        {years.map((year) => {
          const selected = year === activeYear;
          return (
            <li key={year}>
              <button
                type="button"
                onClick={() => onYearChange(year)}
                className={`w-full cursor-pointer rounded px-2 py-1 text-right text-sm transition-colors ${
                  selected
                    ? 'font-semibold text-[var(--color-selected)]'
                    : 'text-[var(--color-secondary)] opacity-75 hover:opacity-100'
                }`}
                aria-pressed={selected}
              >
                {year}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default TotalYearSwitcher;
