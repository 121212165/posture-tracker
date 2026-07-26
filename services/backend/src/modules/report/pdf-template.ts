/**
 * PDF 报告 HTML 模板生成
 * 复用 H5 报告页布局，通过 Playwright 渲染为 PDF
 */

export interface ReportAssessment {
  id: string;
  type: string;
  createdAt: string | Date;
  annotatedImageUrl?: string | null;
  member: {
    name: string;
    gender?: string | null;
    ageRange?: string | null;
  };
  coach: {
    name: string | null;
  };
  metrics: {
    shoulderRoundness: number;
    headForward: number;
    pelvicTilt: number;
    shoulderDiff: number;
    kneeHyperextension: number;
    overallScore: number;
  } | null;
  studio: {
    name: string;
    logoUrl?: string | null;
  };
}

/**
 * 根据指标生成改善建议
 * 阈值对齐设计文档第 6 节
 */
export function generateSuggestions(metrics: ReportAssessment['metrics']): string[] {
  if (!metrics) return ['暂无评估数据'];
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

  return suggestions;
}

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '良好', color: '#10b981' };
  if (score >= 60) return { label: '一般', color: '#f59e0b' };
  return { label: '需改善', color: '#ef4444' };
}

function getMetricStatus(value: number, normalMax: number, abnormalMin: number): { label: string; color: string } {
  if (value < normalMax) return { label: '正常', color: '#10b981' };
  if (value >= abnormalMin) return { label: '明显异常', color: '#ef4444' };
  return { label: '轻度异常', color: '#f59e0b' };
}

/**
 * 渲染报告 HTML（用于 Playwright 转 PDF）
 */
export function renderReportHTML(assessment: ReportAssessment): string {
  const metrics = assessment.metrics;
  const scoreLevel = metrics ? getScoreLevel(metrics.overallScore) : null;
  const suggestions = generateSuggestions(metrics);
  const dateStr = new Date(assessment.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const metricItems = metrics ? [
    { name: '圆肩程度', value: metrics.shoulderRoundness, unit: '°', normalMax: 10, abnormalMin: 15, status: getMetricStatus(metrics.shoulderRoundness, 10, 15) },
    { name: '头前伸', value: metrics.headForward, unit: 'cm', normalMax: 5, abnormalMin: 8, status: getMetricStatus(metrics.headForward, 5, 8) },
    { name: '骨盆倾斜', value: metrics.pelvicTilt, unit: '°', normalMax: 10, abnormalMin: 15, status: getMetricStatus(metrics.pelvicTilt, 10, 15) },
    { name: '高低肩', value: metrics.shoulderDiff, unit: 'cm', normalMax: 1, abnormalMin: 2, status: getMetricStatus(metrics.shoulderDiff, 1, 2) },
    { name: '膝盖过伸', value: metrics.kneeHyperextension, unit: '°', normalMax: 180, abnormalMin: 185, status: getMetricStatus(metrics.kneeHyperextension, 180, 185) },
  ] : [];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>体态评估报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      color: #1f2937;
      padding: 40px;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .header h1 { font-size: 28px; color: #111827; margin-bottom: 8px; }
    .header .studio { font-size: 14px; color: #6b7280; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px; padding-left: 8px; border-left: 4px solid #3b82f6; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
    .info-item { color: #4b5563; }
    .info-item span { color: #111827; font-weight: 500; }
    .score-card { background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; }
    .score-value { font-size: 48px; font-weight: bold; color: ${scoreLevel?.color || '#6b7280'}; }
    .score-label { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .metric-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .metric-table th { text-align: left; padding: 8px 12px; background: #f3f4f6; color: #374151; font-weight: 600; }
    .metric-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; color: #fff; }
    .suggestions { list-style: none; }
    .suggestions li { padding: 8px 0 8px 28px; position: relative; font-size: 13px; color: #374151; line-height: 1.6; }
    .suggestions li::before { content: attr(data-num); position: absolute; left: 0; top: 8px; width: 20px; height: 20px; background: #3b82f6; color: #fff; border-radius: 50%; font-size: 11px; text-align: center; line-height: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header">
    <h1>体态评估报告</h1>
    <div class="studio">${assessment.studio.name}</div>
  </div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info-grid">
      <div class="info-item">学员姓名：<span>${assessment.member.name}</span></div>
      <div class="info-item">评估日期：<span>${dateStr}</span></div>
      <div class="info-item">评估类型：<span>${assessment.type === 'INITIAL' ? '初始评估' : '复评'}</span></div>
      <div class="info-item">评估教练：<span>${assessment.coach.name || '未知'}</span></div>
    </div>
  </div>

  ${metrics ? `
  <div class="section">
    <div class="section-title">总体评分</div>
    <div class="score-card">
      <div class="score-value">${metrics.overallScore.toFixed(1)}</div>
      <div class="score-label">${scoreLevel!.label}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">体态指标详情</div>
    <table class="metric-table">
      <thead>
        <tr><th>指标</th><th>数值</th><th>状态</th></tr>
      </thead>
      <tbody>
        ${metricItems.map(item => `
          <tr>
            <td>${item.name}</td>
            <td>${item.value.toFixed(1)} ${item.unit}</td>
            <td><span class="status-badge" style="background:${item.status.color}">${item.status.label}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : '<div class="section"><div class="section-title">暂无指标数据</div></div>'}

  <div class="section">
    <div class="section-title">改善建议</div>
    <ul class="suggestions">
      ${suggestions.map((s, i) => `<li data-num="${i + 1}">${s}</li>`).join('')}
    </ul>
  </div>

  <div class="footer">
    <p>本报告由 ${assessment.studio.name} 生成</p>
    <p style="margin-top:4px">体态评估仅供参考，具体训练方案请咨询专业教练</p>
  </div>
</body>
</html>`;
}
