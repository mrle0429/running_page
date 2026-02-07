import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import RunMap from '@/components/RunMap';
import useActivities from '@/hooks/useActivities';
import { useTheme, useThemeChangeCounter } from '@/hooks/useTheme';
import {
  IViewState,
  filterAndSortRuns,
  filterYearRuns,
  geoJsonForRuns,
  sortDateFunc,
} from '@/utils/utils';

const TIANANMEN_VIEW: IViewState = {
  longitude: 116.3975,
  latitude: 39.9087,
  zoom: 3,
};

const WidgetRouteMap = () => {
  const { activities, years } = useActivities();
  const themeChangeCounter = useThemeChangeCounter();
  const { theme } = useTheme();

  const [year, setYear] = useState('Total');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!years.length) return;

    const qpYear = new URLSearchParams(window.location.search).get('year');
    if (!qpYear) return;
    if (qpYear === 'Total') {
      setYear('Total');
      return;
    }
    if (qpYear === 'auto') {
      setYear('Total');
      return;
    }
    if (years.includes(qpYear)) {
      setYear(qpYear);
    }
  }, [years]);

  const runs = useMemo(() => {
    return filterAndSortRuns(activities, year, filterYearRuns, sortDateFunc);
  }, [activities, year]);

  const geoData = useMemo(() => {
    return geoJsonForRuns(runs);
  }, [runs, themeChangeCounter]);

  const [viewState, setViewState] = useState<IViewState>(() => ({
    ...TIANANMEN_VIEW,
  }));

  const changeYear = useCallback((y: string) => {
    setYear(y);
  }, []);

  const title = useMemo(() => {
    if (year === 'Total') return 'Total Year Running Heatmap';
    return `${year} Year Running Heatmap`;
  }, [year]);

  return (
    <>
      <Helmet>
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="mx-auto w-full max-w-[1200px] p-2">
        <RunMap
          title={title}
          viewState={viewState}
          geoData={geoData}
          setViewState={setViewState}
          changeYear={changeYear}
          thisYear={year}
        />
      </div>
    </>
  );
};

export default WidgetRouteMap;
