const app = getApp();

Page({
  data: {
    loading: true,
    member: null,
    assessments: [],
  },

  onLoad(options) {
    this.memberId = options.id;
    this.fetchMember();
  },

  async fetchMember() {
    try {
      const [member, assessments] = await Promise.all([
        app.request({ url: `/members/${this.memberId}` }),
        app.request({ url: `/members/${this.memberId}/assessments` }),
      ]);
      this.setData({ member, assessments, loading: false });
    } catch (err) {
      console.error('Fetch member failed:', err);
      this.setData({ loading: false });
    }
  },

  goToAssessment(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/assessment-detail/assessment-detail?id=${id}` });
  },

  goToTrend() {
    wx.navigateTo({ url: `/pages/trend/trend?id=${this.memberId}` });
  },

  createAssessment() {
    wx.navigateTo({ url: `/pages/assessment-create/assessment-create` });
  },
});
