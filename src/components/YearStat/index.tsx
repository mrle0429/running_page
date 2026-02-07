import { lazy, Suspense } from 'react';
import Stat from '@/components/Stat';
import useActivities from '@/hooks/useActivities';
import { formatPace } from '@/utils/utils';
import useHover from '@/hooks/useHover';
import { yearStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';
import { DIST_UNIT, M_TO_DIST, M_TO_ELEV } from '@/utils/utils';

// 运动类型图标映射
const activityIcons: Record<string, string> = {
  running: '🏃',
  Run: '🏃',
  hiking: '🥾',
  Hike: '🥾',
  cycling: '🚴',
  Ride: '🚴',
  walking: '🚶',
  Walk: '🚶',
  swimming: '🏊',
  Swim: '🏊',
};

// 运动类型中文名称映射
const activityNames: Record<string, string> = {
  running: '跑步',
  Run: '跑步',
  hiking: '徒步',
  Hike: '徒步',
  cycling: '骑行',
  Ride: '骑行',
  walking: '健走',
  Walk: '健走',
  swimming: '游泳',
  Swim: '游泳',
};

const YearStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  let { activities: runs, years } = useActivities();
  // for hover
  const [hovered, eventHandlers] = useHover();
  // lazy Component
  const YearSVG = lazy(() => loadSvgComponent(yearStats, `./year_${year}.svg`));

  if (years.includes(year)) {
    runs = runs.filter((run) => run.start_date_local.slice(0, 4) === year);
  }
  
  // 按运动类型分组统计
  const activityTypeStats: Record<string, { count: number; distance: number }> = {};
  
  let sumDistance = 0;
  let streak = 0;
  let sumElevationGain = 0;
  let _pace = 0;
  let _paceNullCount = 0;
  let heartRate = 0;
  let heartRateNullCount = 0;
  let totalMetersAvail = 0;
  let totalSecondsAvail = 0;
  
  runs.forEach((run) => {
    const activityType = run.type || 'Unknown';
    
    // 统计各类型活动
    if (!activityTypeStats[activityType]) {
      activityTypeStats[activityType] = { count: 0, distance: 0 };
    }
    activityTypeStats[activityType].count += 1;
    activityTypeStats[activityType].distance += run.distance || 0;
    
    // 原有的总体统计
    sumDistance += run.distance || 0;
    sumElevationGain += run.elevation_gain || 0;
    if (run.average_speed) {
      _pace += run.average_speed;
      totalMetersAvail += run.distance || 0;
      totalSecondsAvail += (run.distance || 0) / run.average_speed;
    } else {
      _paceNullCount++;
    }
    if (run.average_heartrate) {
      heartRate += run.average_heartrate;
    } else {
      heartRateNullCount++;
    }
    if (run.streak) {
      streak = Math.max(streak, run.streak);
    }
  });
  
  sumDistance = parseFloat((sumDistance / M_TO_DIST).toFixed(1));
  const sumElevationGainStr = (sumElevationGain * M_TO_ELEV).toFixed(0);
  const avgPace = formatPace(totalMetersAvail / totalSecondsAvail);
  const hasHeartRate = !(heartRate === 0);
  const avgHeartRate = (heartRate / (runs.length - heartRateNullCount)).toFixed(
    0
  );
  
  // 按距离排序活动类型
  const sortedActivityTypes = Object.entries(activityTypeStats)
    .sort((a, b) => b[1].distance - a[1].distance)
    .slice(0, 5); // 只显示前5种

  return (
    <div className="cursor-pointer" onClick={() => onClick(year)}>
      <section {...eventHandlers}>
        <Stat value={year} description=" Journey" />
        <Stat value={runs.length} description=" Activities" />
        <Stat value={sumDistance} description={` ${DIST_UNIT}`} />
        {SHOW_ELEVATION_GAIN && (
          <Stat value={sumElevationGainStr} description=" Elevation Gain" />
        )}
        <Stat value={avgPace} description=" Avg Pace" />
        <Stat value={`${streak} day`} description=" Streak" />
        {hasHeartRate && (
          <Stat value={avgHeartRate} description=" Avg Heart Rate" />
        )}
        
        {/* 运动类型分类统计 */}
        {sortedActivityTypes.length > 0 && (
          <div className="mt-4 w-full border-t-2 border-gray-200 pt-3">
            <div className="pb-2 text-base font-semibold italic opacity-70">
              By Activity Type
            </div>
            <div className="grid grid-cols-1 gap-2">
              {sortedActivityTypes.map(([type, stats]) => {
                const icon = activityIcons[type] || '🏃';
                const name = activityNames[type] || type;
                const distance = parseFloat((stats.distance / M_TO_DIST).toFixed(1));
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <span className="text-sm font-semibold">{name}</span>
                    </div>
                    <div className="flex gap-3 text-right">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {stats.count} 次
                      </span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {distance} {DIST_UNIT}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      {year !== 'Total' && hovered && (
        <Suspense fallback="loading...">
          <YearSVG className="year-svg my-4 h-4/6 w-4/6 border-0 p-0" />
        </Suspense>
      )}
      <hr />
    </div>
  );
};

export default YearStat;
