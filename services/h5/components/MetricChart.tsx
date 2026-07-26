import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

interface MetricChartProps {
  metrics: {
    shoulderRoundness: number;
    headForward: number;
    pelvicTilt: number;
    shoulderDiff: number;
    kneeHyperextension: number;
  };
}

// 与后端 metrics.py _normalize_score 对齐的阈值
const THRESHOLDS = [
  { key: 'shoulderRoundness', label: '圆肩', normalMax: 10, abnormalMin: 15 },
  { key: 'headForward', label: '头前伸', normalMax: 5, abnormalMin: 8 },
  { key: 'pelvicTilt', label: '骨盆倾斜', normalMax: 10, abnormalMin: 15 },
  { key: 'shoulderDiff', label: '高低肩', normalMax: 1, abnormalMin: 2 },
  { key: 'kneeHyperextension', label: '膝盖过伸', normalMax: 180, abnormalMin: 185 },
] as const;

function normalize(value: number, normalMax: number, abnormalMin: number): number {
  if (value < normalMax) return 100;
  if (value >= abnormalMin) return 0;
  return (100 * (abnormalMin - value)) / (abnormalMin - normalMax);
}

export function MetricChart({ metrics }: MetricChartProps) {
  const data = THRESHOLDS.map((t) => ({
    metric: t.label,
    value: normalize(metrics[t.key], t.normalMax, t.abnormalMin),
    fullMark: 100,
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
          />
          <Radar
            name="体态评分"
            dataKey="value"
            stroke="#ec4899"
            fill="#ec4899"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
