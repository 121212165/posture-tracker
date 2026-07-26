const app = getApp();

Page({
  data: {
    loading: true,
    overview: null,
    coach: null,
  },

  onLoad() {
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ coach: app.globalData.coach });
  },

  onShow() {
    if (app.globalData.token) {
      this.fetchOverview();
    }
  },

  async fetchOverview() {
    try {
      const data = await app.request({ url: '/trends/studio-overview' });
      this.setData({ overview: data, loading: false });
    } catch (err) {
      console.error('Fetch overview failed:', err);
      this.setData({ loading: false });
    }
  },

  goToMembers() {
    wx.switchTab({ url: '/pages/members/members' });
  },

  goToAssessment() {
    wx.navigateTo({ url: '/pages/assessment-create/assessment-create' });
  },

  onPullDownRefresh() {
    this.fetchOverview();
    wx.stopPullDownRefresh();
  },
});
