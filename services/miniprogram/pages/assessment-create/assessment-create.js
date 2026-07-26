const app = getApp();

Page({
  data: {
    members: [],
    selectedMemberId: '',
    assessmentType: 'INITIAL',
    photoFront: '',
    photoSide: '',
    photoFrontKey: '',
    photoSideKey: '',
    submitting: false,
  },

  onLoad() {
    this.fetchMembers();
  },

  async fetchMembers() {
    try {
      const data = await app.request({ url: '/members?page=1&pageSize=100' });
      this.setData({ members: data.items });
    } catch (err) {
      console.error('Fetch members failed:', err);
    }
  },

  onMemberChange(e) {
    this.setData({ selectedMemberId: this.data.members[e.detail.value].id });
  },

  onTypeChange(e) {
    this.setData({ assessmentType: e.detail.value === '0' ? 'INITIAL' : 'FOLLOW_UP' });
  },

  choosePhoto(e) {
    const type = e.currentTarget.dataset.type;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadPhoto(tempFilePath, type);
      },
    });
  },

  async uploadPhoto(filePath, type) {
    wx.showLoading({ title: '上传中...' });

    try {
      const token = app.globalData.token;
      const res = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/files/upload`,
          filePath: filePath,
          name: 'file',
          header: {
            Authorization: token ? `Bearer ${token}` : '',
          },
          success: resolve,
          fail: reject,
        });
      });

      const parsed = JSON.parse(res.data);
      const data = parsed.success === true ? parsed.data : parsed;
      if (type === 'front') {
        this.setData({
          photoFront: filePath,
          photoFrontKey: data.objectKey,
        });
      } else {
        this.setData({
          photoSide: filePath,
          photoSideKey: data.objectKey,
        });
      }

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
      console.error('Upload failed:', err);
    }
  },

  removePhoto(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'front') {
      this.setData({ photoFront: '', photoFrontKey: '' });
    } else {
      this.setData({ photoSide: '', photoSideKey: '' });
    }
  },

  async handleSubmit() {
    const { selectedMemberId, assessmentType, photoFrontKey, photoSideKey } = this.data;

    if (!selectedMemberId) {
      wx.showToast({ title: '请选择学员', icon: 'none' });
      return;
    }

    if (!photoFrontKey || !photoSideKey) {
      wx.showToast({ title: '请上传正面和侧面照片', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const result = await app.request({
        url: '/assessments',
        method: 'POST',
        data: {
          memberId: selectedMemberId,
          type: assessmentType,
          photoFrontKey: photoFrontKey,
          photoSideKey: photoSideKey,
        },
      });

      wx.showToast({ title: '评估创建成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/assessment-detail/assessment-detail?id=${result.id}`,
        });
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
