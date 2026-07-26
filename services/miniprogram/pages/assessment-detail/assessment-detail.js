const app = getApp();

Page({
  data: {
    loading: true,
    assessment: null,
    timer: null,
  },

  onLoad(options) {
    this.assessmentId = options.id;
    this.fetchAssessment();
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  async fetchAssessment() {
    try {
      const data = await app.request({ url: `/assessments/${this.assessmentId}` });
      this.setData({ assessment: data, loading: false });

      // 如果还在处理中，轮询更新
      if (data.status === 'PROCESSING' || data.status === 'PENDING') {
        const timer = setInterval(() => {
          this.fetchAssessment();
        }, 5000);
        this.setData({ timer });
      } else if (this.data.timer) {
        clearInterval(this.data.timer);
        this.setData({ timer: null });
      }
    } catch (err) {
      console.error('Fetch assessment failed:', err);
      this.setData({ loading: false });
    }
  },

  async handleRetry() {
    try {
      await app.request({ url: `/assessments/${this.assessmentId}/retry`, method: 'POST' });
      wx.showToast({ title: '重新处理中', icon: 'success' });
      this.fetchAssessment();
    } catch (err) {
      wx.showToast({ title: err.message || '重试失败', icon: 'none' });
    }
  },

  async handleGenerateReport() {
    try {
      const report = await app.request({
        url: `/reports/assessments/${this.assessmentId}`,
        method: 'POST',
      });
      wx.navigateTo({
        url: `/pages/report/report?assessmentId=${this.assessmentId}`,
      });
    } catch (err) {
      wx.showToast({ title: err.message || '报告生成失败', icon: 'none' });
    }
  },
});
