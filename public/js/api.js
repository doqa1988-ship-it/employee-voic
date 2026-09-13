/**
 * منصة صوت الموظف - واجهة API
 * التعامل مع الخادم الخلفي
 */

const API = {
  baseURL: '/api',
  
  /**
   * الحصول على التوكن المحفوظ
   */
  getToken() {
    return localStorage.getItem('auth_token');
  },

  /**
   * حفظ التوكن
   */
  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  /**
   * حذف التوكن
   */
  removeToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  /**
   * حفظ بيانات المستخدم
   */
  setUser(user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
  },

  /**
   * الحصول على بيانات المستخدم
   */
  getUser() {
    const user = localStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * التحقق من تسجيل الدخول
   */
  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * طلب HTTP عام
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    };

    // إزالة Content-Type للـ FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // تسجيل خروج تلقائي عند انتهاء الجلسة
        if (response.status === 401) {
          this.removeToken();
          if (window.location.pathname.includes('dashboard') || 
              window.location.pathname.includes('complaint')) {
            window.location.href = '/index.html#loginForm';
          }
        }
        throw new Error(data.error || 'حدث خطأ في الاتصال');
      }

      return data;
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        throw new Error('فشل الاتصال بالخادم - تأكد من تشغيل الخادم');
      }
      throw error;
    }
  },

  // ==================== المصادقة ====================

  /**
   * تسجيل الدخول
   */
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  /**
   * تسجيل الخروج
   */
  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // تجاهل الأخطاء
    }
    this.removeToken();
  },

  /**
   * الحصول على بيانات المستخدم الحالي
   */
  async getCurrentUser() {
    return this.request('/auth/me');
  },

  /**
   * تغيير كلمة المرور
   */
  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  // ==================== الشكاوى ====================

  /**
   * تقديم شكوى جديدة
   */
  async submitComplaint(formData) {
    return this.request('/complaints', {
      method: 'POST',
      body: formData,
      headers: {} // دع المتصفح يضيف Content-Type للـ FormData
    });
  },

  /**
   * متابعة شكوى برقم التتبع
   */
  async trackComplaint(trackingId) {
    return this.request(`/complaints/track/${encodeURIComponent(trackingId)}`);
  },

  /**
   * جلب قائمة الشكاوى (للمسؤولين)
   */
  async getComplaints(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const query = params.toString();
    return this.request(`/complaints${query ? '?' + query : ''}`);
  },

  /**
   * جلب تفاصيل شكوى (للمسؤولين)
   */
  async getComplaint(id) {
    return this.request(`/complaints/${id}`);
  },

  /**
   * تحديث شكوى (للمسؤولين)
   */
  async updateComplaint(id, data) {
    return this.request(`/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  /**
   * جلب إحصائيات الشكاوى
   */
  async getStats() {
    return this.request('/complaints/stats/summary');
  },

  // ==================== الإدارة ====================

  /**
   * جلب قائمة المستخدمين
   */
  async getUsers() {
    return this.request('/admin/users');
  },

  /**
   * إضافة مستخدم
   */
  async addUser(userData) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  /**
   * تحديث مستخدم
   */
  async updateUser(id, data) {
    return this.request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  /**
   * حذف مستخدم
   */
  async deleteUser(id) {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE'
    });
  },

  /**
   * جلب سجل النشاط
   */
  async getActivity(limit = 50) {
    return this.request(`/admin/activity?limit=${limit}`);
  }
};

// تحديث شريط التنقل بناءً على حالة تسجيل الدخول
function updateNav() {
  const adminLink = document.getElementById('navAdmin');
  const loginLink = document.getElementById('navLogin');
  const logoutLink = document.getElementById('navLogout');
  const isLoggedIn = API.isLoggedIn();

  if (adminLink) adminLink.style.display = isLoggedIn ? '' : 'none';
  if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : '';
  if (logoutLink) logoutLink.style.display = isLoggedIn ? '' : 'none';
}

// التحقق من صلاحية الوصول للصفحات المحمية
function requireAdmin() {
  if (!API.isLoggedIn()) {
    window.location.href = '/index.html#loginForm';
    return false;
  }
  return true;
}

// تسجيل الخروج
async function logout() {
  await API.logout();
  window.location.href = '/index.html';
}
