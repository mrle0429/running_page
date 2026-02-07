import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { totalStat, githubStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import { initSvgColorAdjustments } from '@/utils/colorUtils';
import TotalYearSwitcher from './TotalYearSwitcher';

// Lazy load grid.svg
const GridSvg = lazy(() => loadSvgComponent(totalStat, './grid.svg'));

interface SVGStatProps {
  year?: string;
}

const SVGStat = ({ year }: SVGStatProps) => {
  const currentYear = year ?? 'Total';

  const githubYears = useMemo(() => {
    return Object.keys(githubStats)
      .map((path) => path.match(/github_(\d{4})\.svg$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Number(b) - Number(a));
  }, []);

  const [totalViewYear, setTotalViewYear] = useState<string>('Total');
  const availableTotalYears = useMemo(
    () => ['Total', ...githubYears],
    [githubYears]
  );

  const displayYear = currentYear === 'Total' ? totalViewYear : currentYear;

  useEffect(() => {
    // Initialize SVG color adjustments when component mounts
    const timer = setTimeout(() => {
      initSvgColorAdjustments();
    }, 100); // Small delay to ensure SVG is rendered

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentYear !== 'Total') {
      setTotalViewYear(currentYear);
      return;
    }

    if (!availableTotalYears.includes(totalViewYear)) {
      setTotalViewYear('Total');
    }
  }, [currentYear, totalViewYear, availableTotalYears]);

  // Lazy load github svg based on year
  const GithubSvg = useMemo(
    () =>
      lazy(() => {
        if (displayYear && displayYear !== 'Total') {
          return loadSvgComponent(githubStats, `./github_${displayYear}.svg`);
        }
        return loadSvgComponent(totalStat, './github.svg');
      }),
    [displayYear]
  );

  return (
    <div id="svgStat" className="mt-4">
      <div className={currentYear === 'Total' ? 'flex items-start gap-3' : ''}>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<div className="text-center">Loading...</div>}>
            <GithubSvg className="github-svg h-auto w-full" />
            {displayYear === 'Total' && (
              <GridSvg className="grid-svg mt-4 h-auto w-full" />
            )}
          </Suspense>
        </div>
        {currentYear === 'Total' && (
          <TotalYearSwitcher
            activeYear={displayYear}
            years={availableTotalYears}
            onYearChange={setTotalViewYear}
          />
        )}
      </div>
    </div>
  );
};

export default SVGStat;
