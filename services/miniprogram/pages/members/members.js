const app = getApp();

Page({
  data: {
    loading: true,
    members: [],
    keyword: '',
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this.fetchMembers();
  },

  onShow() {
    this.setData({ page: 1, members: [], hasMore: true });
    this.fetchMembers();
  },

  async fetchMembers() {
    if (this.data.loading && this.data.page > 1) return;

    try {
      const data = await app.request({
        url: `/members?page=${this.data.page}&pageSize=20${this.data.keyword ? '&keyword=' + this.data.keyword : ''}`,
      });

      this.setData({
        members: this.data.page === 1 ? data.items : [...this.data.members, ...data.items],
        hasMore: this.data.page < data.totalPages,
        loading: false,
      });
    } catch (err) {
      console.error('Fetch members failed:', err);
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    this.setData({
      keyword: e.detail.value,
      page: 1,
      members: [],
      hasMore: true,
      loading: true,
    });
    this.fetchMembers();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.fetchMembers();
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/member-detail/member-detail?id=${id}` });
  },

  goToCreate() {
    wx.navigateTo({ url: '/pages/assessment-create/assessment-create' });
  },
});
