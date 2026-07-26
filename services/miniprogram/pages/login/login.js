const app = getApp();

Page({
  data: {
    loading: false,
  },

  onLoad() {
    if (app.globalData.token) {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  async handleLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      await app.login();
      wx.switchTab({ url: '/pages/index/index' });
    } catch (err) {
      console.error('Login failed:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
