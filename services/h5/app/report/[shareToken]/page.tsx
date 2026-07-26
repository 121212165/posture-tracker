'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchReport, ReportData } from '../../../../lib/api';
import { ScoreCard } from '../../../../components/ScoreCard';
import { MetricChart } from '../../../../components/MetricChart';
import { MetricList } from '../../../../components/MetricList';
import { Header } from '../../../../components/Header';
import { Loading } from '../../../../components/Loading';
import { ErrorState } from '../../../../components/ErrorState';

export default function ReportPage() {
  const params = useParams<{ shareToken: string }>();
  const { shareToken } = params;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;

    fetchReport(shareToken)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message || err.response?.data?.message || '报告加载失败');
        setLoading(false);
      });
  }, [shareToken]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!report) return <ErrorState message="报告不存在" />;

  const { assessment } = report;
  const metrics = assessment.metrics;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header studioName={assessment.studio.name} studioLogo={assessment.studio.logoUrl} />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 学员信息 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{assessment.member.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(assessment.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {' · '}
                {assessment.type === 'INITIAL' ? '初始评估' : '复评'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">评估教练</p>
              <p className="text-sm font-medium text-gray-700">{assessment.coach.name || '教练'}</p>
            </div>
          </div>
        </div>

        {/* 标注图展示 */}
        {assessment.annotatedImageUrl && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">关键点标注</h3>
            <img
              src={assessment.annotatedImageUrl}
              alt="体态标注图"
              className="w-full rounded-lg"
            />
          </div>
        )}

        {/* 原图对比 */}
        {(assessment.photoFrontUrl || assessment.photoSideUrl) && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">原始照片</h3>
            <div className="grid grid-cols-2 gap-3">
              {assessment.photoFrontUrl && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">正面</p>
                  <img
                    src={assessment.photoFrontUrl}
                    alt="正面照"
                    className="w-full rounded-lg"
                  />
                </div>
              )}
              {assessment.photoSideUrl && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">侧面</p>
                  <img
                    src={assessment.photoSideUrl}
                    alt="侧面照"
                    className="w-full rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 总体评分 */}
        {metrics && <ScoreCard score={metrics.overallScore} />}

        {/* 指标详情 */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">体态指标详情</h3>
            <MetricList metrics={metrics} />
          </div>
        )}

        {/* 指标可视化 */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">指标雷达图</h3>
            <MetricChart metrics={metrics} />
          </div>
        )}

        {/* 改善建议 */}
        {metrics && (
          <div className="bg-gradient-to-br from-primary-50 to-pink-50 rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3">改善建议</h3>
            <SuggestionList metrics={metrics} />
          </div>
        )}

        {/* 底部信息 */}
        <div className="text-center text-xs text-gray-400 py-4">
          <p>本报告由 {assessment.studio.name} 生成</p>
          <p className="mt-1">体态评估仅供参考，具体训练方案请咨询专业教练</p>
        </div>
      </div>
    </div>
  );
}

function SuggestionList({ metrics }: { metrics: any }) {
  const suggestions: string[] = [];

  if (metrics.shoulderRoundness > 15) {
    suggestions.push('圆肩较明显，建议加强背部肌肉训练，如菱形肌、中下斜方肌激活动作');
  }
  if (metrics.headForward > 8) {
    suggestions.push('头前伸现象，建议练习颈部后缩动作，注意日常坐姿');
  }
  if (metrics.pelvicTilt > 15) {
    suggestions.push('骨盆倾斜，建议加强核心稳定训练，矫正骨盆位置');
  }
  if (metrics.shoulderDiff > 2) {
    suggestions.push('高低肩差异明显，建议检查日常习惯性动作，加强弱侧训练');
  }
  if (metrics.kneeHyperextension > 180) {
    suggestions.push('膝盖过伸，建议训练股四头肌控制力，避免站立时锁死膝盖');
  }
  if (suggestions.length === 0) {
    suggestions.push('整体体态良好，建议保持现有训练计划');
    suggestions.push('定期复查以跟踪体态变化');
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion, index) => (
        <div key={index} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">
            {index + 1}
          </span>
          <p className="text-sm text-gray-700 leading-relaxed">{suggestion}</p>
        </div>
      ))}
    </div>
  );
}
