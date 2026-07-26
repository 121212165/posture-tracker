const envConfig = require('./config/env');

App({
  globalData: {
    baseUrl: envConfig.apiBaseUrl,
    token: '',
    coach: null,
    studio: null,
  },

  onLaunch() {
    // 从本地存储恢复登录状态
    const token = wx.getStorageSync('token');
    const coach = wx.getStorageSync('coach');
    const studio = wx.getStorageSync('studio');

    if (token) {
      this.globalData.token = token;
      this.globalData.coach = coach;
      this.globalData.studio = studio;
    }
  },

  // 微信登录
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            wx.request({
              url: `${this.globalData.baseUrl}/auth/wx-login`,
              method: 'POST',
              data: { code: res.code },
              success: (response) => {
                const body = response.data;
                const data = body && body.success === true ? body.data : body;
                if (response.statusCode === 200 && data && data.token) {
                  const { token, coach, studio } = data;
                  this.globalData.token = token;
                  this.globalData.coach = coach;
                  this.globalData.studio = studio;

                  wx.setStorageSync('token', token);
                  wx.setStorageSync('coach', coach);
                  wx.setStorageSync('studio', studio);

                  resolve({ token, coach, studio });
                } else {
                  reject(new Error(body?.message || '登录失败'));
                }
              },
              fail: (err) => reject(err),
            });
          } else {
            reject(new Error('获取微信登录凭证失败'));
          }
        },
        fail: (err) => reject(err),
      });
    });
  },

  // 带认证的请求封装
  request(options) {
    const token = this.globalData.token;
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        url: `${this.globalData.baseUrl}${options.url}`,
        header: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
          ...options.header,
        },
        success: (response) => {
          if (response.statusCode === 401) {
            // token过期，清除并跳转登录
            this.logout();
            wx.redirectTo({ url: '/pages/login/login' });
            reject(new Error('未登录或登录已过期'));
          } else if (response.statusCode >= 400) {
            reject(new Error(response.data?.message || '请求失败'));
          } else {
            // 解包响应数据（后端返回 { success: true, data: ... } 格式）
            const body = response.data;
            if (body && body.success === true && body.data !== undefined) {
              resolve(body.data);
            } else {
              resolve(body);
            }
          }
        },
        fail: (err) => reject(err),
      });
    });
  },

  logout() {
    this.globalData.token = '';
    this.globalData.coach = null;
    this.globalData.studio = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('coach');
    wx.removeStorageSync('studio');
  },
});
