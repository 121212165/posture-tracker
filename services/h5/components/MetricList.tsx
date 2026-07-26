interface MetricListProps {
  metrics: {
    shoulderRoundness: number;
    headForward: number;
    pelvicTilt: number;
    shoulderDiff: number;
    kneeHyperextension: number;
  };
}

// 各指标的量纲、单位、正常/异常阈值（对齐设计文档第 6 节）
const METRIC_CONFIG = [
  {
    key: 'shoulderRoundness' as const,
    name: '圆肩程度',
    unit: '°',
    normalMax: 10,
    abnormalMin: 15,
    icon: '🧍',
  },
  {
    key: 'headForward' as const,
    name: '头前伸',
    unit: 'cm',
    normalMax: 5,
    abnormalMin: 8,
    icon: '🗣️',
  },
  {
    key: 'pelvicTilt' as const,
    name: '骨盆倾斜',
    unit: '°',
    normalMax: 10,
    abnormalMin: 15,
    icon: '⚖️',
  },
  {
    key: 'shoulderDiff' as const,
    name: '高低肩',
    unit: 'cm',
    normalMax: 1,
    abnormalMin: 2,
    icon: '📏',
  },
  {
    key: 'kneeHyperextension' as const,
    name: '膝盖过伸',
    unit: '°',
    normalMax: 180,
    abnormalMin: 185,
    icon: '🦵',
  },
];

function getMetricStatus(value: number, normalMax: number, abnormalMin: number) {
  if (value < normalMax) {
    return { label: '正常', color: 'text-green-600', barColor: 'bg-green-500' };
  }
  if (value >= abnormalMin) {
    return { label: '明显异常', color: 'text-red-600', barColor: 'bg-red-500' };
  }
  return { label: '轻度异常', color: 'text-yellow-600', barColor: 'bg-yellow-500' };
}

// 归一化进度（0-100）：正常范围得满分，超出异常阈值得 0 分，中间线性插值
function normalizePercent(value: number, normalMax: number, abnormalMin: number): number {
  if (value < normalMax) return 100;
  if (value >= abnormalMin) return 0;
  return (100 * (abnormalMin - value)) / (abnormalMin - normalMax);
}

export function MetricList({ metrics }: MetricListProps) {
  return (
    <div className="space-y-3">
      {METRIC_CONFIG.map((config) => {
        const value = metrics[config.key];
        const status = getMetricStatus(value, config.normalMax, config.abnormalMin);
        const percent = normalizePercent(value, config.normalMax, config.abnormalMin);

        return (
          <div key={config.key} className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{config.name}</span>
                <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${status.barColor}`}
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {value.toFixed(1)} {config.unit}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
