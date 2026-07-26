const app = getApp();

Page({
  data: {
    loading: true,
    report: null,
  },

  onLoad(options) {
    this.assessmentId = options.assessmentId;
    this.fetchReport();
  },

  async fetchReport() {
    try {
      const data = await app.request({
        url: `/reports/assessments/${this.assessmentId}`,
      });
      this.setData({ report: data, loading: false });
    } catch (err) {
      console.error('Fetch report failed:', err);
      this.setData({ loading: false });
    }
  },

  previewQRCode() {
    if (this.data.report?.qrCodeUrl) {
      wx.previewImage({ urls: [this.data.report.qrCodeUrl] });
    }
  },

  copyLink() {
    if (this.data.report?.h5Url) {
      wx.setClipboardData({
        data: this.data.report.h5Url,
        success: () => {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        },
      });
    }
  },

  shareToFriend() {
    wx.showToast({ title: '请点击右上角分享', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '查看体态评估报告',
      path: `/pages/report/report?assessmentId=${this.assessmentId}`,
    };
  },
});
