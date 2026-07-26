interface ScoreCardProps {
  score: number;
}

export function ScoreCard({ score }: ScoreCardProps) {
  const level = score >= 80 ? '良好' : score >= 60 ? '一般' : '需改善';
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const bgColor = score >= 80 ? 'bg-green-50' : score >= 60 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className={`rounded-2xl shadow-sm p-5 ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">总体体态评分</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${color}`}>{score.toFixed(1)}</span>
            <span className="text-sm text-gray-400">/ 100</span>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${color} bg-white`}>
            {level}
          </span>
        </div>
      </div>
      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
