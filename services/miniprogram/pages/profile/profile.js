const app = getApp();

Page({
  data: {
    coach: null,
    studio: null,
  },

  onShow() {
    this.setData({
      coach: app.globalData.coach,
      studio: app.globalData.studio,
    });
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          wx.redirectTo({ url: '/pages/login/login' });
        }
      },
    });
  },
});
