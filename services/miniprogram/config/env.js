/**
 * 小程序环境配置
 * - 本地开发：使用 localhost
 * - 生产部署：修改 API_BASE_URL 为线上后端域名（HTTPS）
 * - 微信小程序后台需将此域名加入 request 合法域名白名单
 *
 * 切换环境时只需修改此文件，无需改动 app.js
 */
const config = {
  // 开发环境
  development: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
  },
  // 生产环境
  production: {
    apiBaseUrl: 'https://api.your-domain.com/api/v1',
  },
};

// 通过 NODE_ENV 或当前 host 判断环境
// 小程序无 process.env，使用默认 development；构建时通过CI替换
const env = typeof __wxConfig !== 'undefined' && __wxConfig.envVersion === 'release'
  ? 'production'
  : 'development';

module.exports = config[env];
