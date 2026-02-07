import { lazy, Suspense, useEffect, useMemo } from 'react';
import { totalStat, githubStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import { initSvgColorAdjustments } from '@/utils/colorUtils';

// Lazy load grid.svg
const GridSvg = lazy(() => loadSvgComponent(totalStat, './grid.svg'));

interface SVGStatProps {
  year?: string;
}

const SVGStat = ({ year }: SVGStatProps) => {
  useEffect(() => {
    // Initialize SVG color adjustments when component mounts
    const timer = setTimeout(() => {
      initSvgColorAdjustments();
    }, 100); // Small delay to ensure SVG is rendered

    return () => clearTimeout(timer);
  }, []);

  // Lazy load github svg based on year
  const GithubSvg = useMemo(() => lazy(() => {
    if (year && year !== 'Total') {
      return loadSvgComponent(githubStats, `./github_${year}.svg`);
    }
    return loadSvgComponent(totalStat, './github.svg');
  }), [year]);

  return (
    <div id="svgStat">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <GithubSvg className="github-svg mt-4 h-auto w-full" />
        {(!year || year === 'Total') && (
          <GridSvg className="grid-svg mt-4 h-auto w-full" />
        )}
      </Suspense>
    </div>
  );
};

export default SVGStat;
