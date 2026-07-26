const app = getApp();

Page({
  data: {
    loading: true,
    memberId: '',
    member: null,
    trend: [],
    summary: null,
    // 5 项指标配置，用于切换展示
    metricConfigs: [
      { key: 'overallScore', name: '综合评分', unit: '分', color: '#ec4899' },
      { key: 'shoulderRoundness', name: '圆肩角', unit: '°', color: '#3b82f6' },
      { key: 'headForward', name: '头前伸', unit: 'cm', color: '#10b981' },
      { key: 'pelvicTilt', name: '骨盆倾斜', unit: '°', color: '#f59e0b' },
      { key: 'shoulderDiff', name: '高低肩', unit: 'cm', color: '#8b5cf6' },
      { key: 'kneeHyperextension', name: '膝超伸', unit: '°', color: '#ef4444' },
    ],
    activeMetric: 'overallScore',
    chartData: [],
    chartRange: { min: 0, max: 100 },
  },

  onLoad(options) {
    this.setData({ memberId: options.id });
    this.fetchTrend();
  },

  async fetchTrend() {
    try {
      const data = await app.request({
        url: `/trends/members/${this.data.memberId}`,
      });
      this.setData(
        {
          member: data.member,
          trend: data.trend,
          summary: data.summary,
          loading: false,
        },
        () => this.updateChart(),
      );
    } catch (err) {
      console.error('Fetch trend failed:', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onMetricChange(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeMetric: key }, () => this.updateChart());
  },

  updateChart() {
    const { trend, activeMetric, metricConfigs } = this.data;
    if (!trend || trend.length === 0) {
      this.setData({ chartData: [] });
      return;
    }

    const points = trend
      .filter((t) => t.metrics)
      .map((t) => ({
        date: this.formatDate(t.date),
        value: t.metrics[activeMetric],
      }));

    if (points.length === 0) {
      this.setData({ chartData: [] });
      return;
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // 留 10% 边距
    const padding = (max - min) * 0.1 || 1;

    this.setData({
      chartData: points,
      chartRange: {
        min: Math.floor(min - padding),
        max: Math.ceil(max + padding),
      },
    });
  },

  formatDate(isoStr) {
    const d = new Date(isoStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  goBack() {
    wx.navigateBack();
  },
});
