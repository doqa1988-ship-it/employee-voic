// ===== مساعد دقة الصوتي - JavaScript الواجهة =====

// حالة التطبيق
const state = {
  contacts: [],
  calls: [],
  auditLog: [],
  activeCall: null,
  appInfo: null,
  pollInterval: null,
};

// ===== التهيئة =====

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // التحقق من المصادقة
  const authStatus = await checkAuth();
  if (!authStatus.authenticated) {
    window.location.href = '/login';
    return;
  }

  // عرض معلومات المستخدم
  document.getElementById('userInfo').textContent = `👤 ${authStatus.user.username}`;

  // جلب معلومات التطبيق
  await fetchAppInfo();

  // تهيئة التنقل
  initTabs();

  // تهيئة النماذج
  initForms();

  // جلب البيانات
  await Promise.all([
    fetchContacts(),
    fetchCalls(),
  ]);

  // تسجيل الخروج
  document.getElementById('logoutBtn').addEventListener('click', logout);
}

// ===== المصادقة =====

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  window.location.href = '/login';
}

// ===== معلومات التطبيق =====

async function fetchAppInfo() {
  try {
    const res = await fetch('/api/info');
    state.appInfo = await res.json();
    
    const modeBadge = document.getElementById('appMode');
    modeBadge.textContent = state.appInfo.mode === 'demo' ? 'تجريبي' : 'حي';
    modeBadge.className = `mode-badge ${state.appInfo.mode}`;
  } catch (error) {
    console.error('فشل جلب معلومات التطبيق:', error);
  }
}

// ===== التنقل =====

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${targetId}Section`).classList.add('active');
      
      // جلب البيانات عند التنقل
      if (targetId === 'contacts') fetchContacts();
      if (targetId === 'history') fetchCalls();
      if (targetId === 'audit') fetchAuditLog();
    });
  });
}

// ===== جهات الاتصال =====

async function fetchContacts() {
  try {
    const res = await fetch('/api/contacts');
    if (!res.ok) throw new Error('فشل جلب جهات الاتصال');
    
    state.contacts = await res.json();
    renderContacts();
    updateContactSelect();
  } catch (error) {
    console.error(error);
    document.getElementById('contactsList').innerHTML = 
      '<p class="error-message">فشل تحميل جهات الاتصال</p>';
  }
}

function renderContacts() {
  const container = document.getElementById('contactsList');
  
  if (state.contacts.length === 0) {
    container.innerHTML = '<p class="empty-message">لا توجد جهات اتصال. أضف جهة اتصال جديدة للبدء.</p>';
    return;
  }
  
  container.innerHTML = state.contacts.map(contact => `
    <div class="contact-item">
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(contact.name)}</div>
        <div class="contact-phone">${contact.phone}</div>
        <div class="contact-status ${contact.consentGiven ? 'consent' : 'no-consent'}">
          ${contact.consentGiven 
            ? '✓ تم تسجيل الموافقة' 
            : '⚠️ لم يتم تسجيل الموافقة'}
        </div>
      </div>
      <div class="contact-actions">
        ${!contact.consentGiven ? `
          <button class="btn btn-small btn-success" onclick="giveConsent('${contact.id}')">
            تسجيل موافقة
          </button>
        ` : ''}
        <button class="btn btn-small btn-outline" onclick="editContact('${contact.id}')">
          تعديل
        </button>
        <button class="btn btn-small btn-outline" onclick="deleteContact('${contact.id}')">
          حذف
        </button>
      </div>
    </div>
  `).join('');
}

function updateContactSelect() {
  const select = document.getElementById('contactSelect');
  const currentValue = select.value;
  
  select.innerHTML = '<option value="">-- اختر جهة اتصال --</option>' +
    state.contacts.map(c => `
      <option value="${c.id}" data-consent="${c.consentGiven}">
        ${escapeHtml(c.name)} (${c.phone})
      </option>
    `).join('');
  
  // استعادة القيمة المختارة
  if (currentValue) select.value = currentValue;
  
  updateContactStatus();
}

function updateContactStatus() {
  const select = document.getElementById('contactSelect');
  const statusEl = document.getElementById('contactStatus');
  const selected = select.selectedOptions[0];
  
  if (!selected || !selected.value) {
    statusEl.textContent = '';
    return;
  }
  
  const hasConsent = selected.dataset.consent === 'true';
  if (hasConsent) {
    statusEl.innerHTML = '<span style="color: var(--success)">✓ الموافقة مسجلة</span>';
  } else {
    statusEl.innerHTML = '<span style="color: var(--warning)">⚠️ يجب تسجيل الموافقة أولاً (في الوضع الحي)</span>';
  }
}

document.getElementById('contactSelect')?.addEventListener('change', updateContactStatus);

// إضافة/تعديل جهة اتصال
document.getElementById('addContactBtn').addEventListener('click', () => {
  document.getElementById('contactModalTitle').textContent = 'إضافة جهة اتصال';
  document.getElementById('contactId').value = '';
  document.getElementById('contactName').value = '';
  document.getElementById('contactPhone').value = '';
  document.getElementById('contactFormError').classList.add('hidden');
  document.getElementById('contactModal').classList.remove('hidden');
});

function closeContactModal() {
  document.getElementById('contactModal').classList.add('hidden');
}

window.closeContactModal = closeContactModal;

function editContact(id) {
  const contact = state.contacts.find(c => c.id === id);
  if (!contact) return;
  
  document.getElementById('contactModalTitle').textContent = 'تعديل جهة الاتصال';
  document.getElementById('contactId').value = contact.id;
  document.getElementById('contactName').value = contact.name;
  document.getElementById('contactPhone').value = contact.phone;
  document.getElementById('contactFormError').classList.add('hidden');
  document.getElementById('contactModal').classList.remove('hidden');
}

window.editContact = editContact;

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('contactId').value;
  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const errorEl = document.getElementById('contactFormError');
  
  errorEl.classList.add('hidden');
  
  try {
    const url = id ? `/api/contacts/${id}` : '/api/contacts';
    const method = id ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      errorEl.textContent = data.error || 'حدث خطأ';
      errorEl.classList.remove('hidden');
      return;
    }
    
    closeContactModal();
    fetchContacts();
  } catch (error) {
    errorEl.textContent = 'فشل الاتصال بالخادم';
    errorEl.classList.remove('hidden');
  }
});

async function giveConsent(id) {
  if (!confirm('هل تؤكد أن جهة الاتصال قد وافقت على استقبال مكالمات من المساعد الآلي؟')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/contacts/${id}/consent`, { method: 'POST' });
    if (!res.ok) throw new Error('فشل تسجيل الموافقة');
    fetchContacts();
  } catch (error) {
    alert('فشل تسجيل الموافقة: ' + error.message);
  }
}

window.giveConsent = giveConsent;

async function deleteContact(id) {
  const contact = state.contacts.find(c => c.id === id);
  if (!confirm(`هل أنت متأكد من حذف ${contact?.name}؟`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('فشل الحذف');
    fetchContacts();
  } catch (error) {
    alert('فشل الحذف: ' + error.message);
  }
}

window.deleteContact = deleteContact;

// ===== المكالمات =====

async function fetchCalls() {
  try {
    const res = await fetch('/api/calls');
    if (!res.ok) throw new Error('فشل جلب المكالمات');
    
    state.calls = await res.json();
    renderCalls();
    
    // التحقق من المكالمة الجارية
    const activeCall = state.calls.find(c => 
      ['initiated', 'ringing', 'in-progress', 'demo_initiated', 'demo_ringing', 'demo_in_progress'].includes(c.status)
    );
    
    if (activeCall) {
      showActiveCall(activeCall);
    } else {
      hideActiveCall();
    }
  } catch (error) {
    console.error(error);
    document.getElementById('callsList').innerHTML = 
      '<p class="error-message">فشل تحميل المكالمات</p>';
  }
}

function renderCalls() {
  const container = document.getElementById('callsList');
  
  if (state.calls.length === 0) {
    container.innerHTML = '<p class="empty-message">لا توجد مكالمات سابقة.</p>';
    return;
  }
  
  container.innerHTML = state.calls.map(call => `
    <div class="call-item ${call.status}">
      <div class="call-header">
        <span class="call-contact">${escapeHtml(call.contactName)} (${call.contactPhone})</span>
        <span class="call-time">${formatDate(call.createdAt)}</span>
      </div>
      <div class="call-task">📝 ${escapeHtml(call.task)}</div>
      <div class="call-meta">
        <span class="status-badge ${call.status}">${translateStatus(call.status)}</span>
        ${call.durationSeconds ? `<span>⏱️ ${formatDuration(call.durationSeconds)}</span>` : ''}
        ${call.actualCostUsd ? `<span>💰 $${call.actualCostUsd}</span>` : ''}
        ${call.errorMessage ? `<span style="color: var(--danger)">❌ ${escapeHtml(call.errorMessage)}</span>` : ''}
      </div>
      ${call.summary ? `<div class="call-summary"><strong>الملخص:</strong> ${escapeHtml(call.summary)}</div>` : ''}
    </div>
  `).join('');
}

function translateStatus(status) {
  const map = {
    'pending': 'قيد الانتظار',
    'initiated': 'جارٍ الاتصال',
    'ringing': 'يرن',
    'in-progress': 'جارية',
    'completed': 'مكتملة',
    'busy': 'مشغول',
    'no-answer': 'لا رد',
    'failed': 'فشلت',
    'canceled': 'ملغاة',
    'demo_initiated': 'تجريبي - جارٍ',
    'demo_ringing': 'تجريبي - يرن',
    'demo_in_progress': 'تجريبي - جارية',
    'demo_completed': 'تجريبي - مكتملة',
  };
  return map[status] || status;
}

// ===== نموذج المكالمة =====

function initForms() {
  const callForm = document.getElementById('callForm');
  const estimateBtn = document.getElementById('estimateBtn');
  const endCallBtn = document.getElementById('endCallBtn');
  
  estimateBtn.addEventListener('click', showCostEstimate);
  callForm.addEventListener('submit', initiateCall);
  endCallBtn.addEventListener('click', endCurrentCall);
}

async function showCostEstimate() {
  const contactId = document.getElementById('contactSelect').value;
  const costDiv = document.getElementById('costEstimate');
  
  if (!contactId) {
    alert('اختر جهة اتصال أولاً');
    return;
  }
  
  try {
    const res = await fetch(`/api/calls/estimate/${contactId}`);
    const data = await res.json();
    
    if (!res.ok) {
      alert(data.error || 'فشل حساب التكلفة');
      return;
    }
    
    costDiv.querySelector('.cost-details').innerHTML = `
      <div class="cost-row">
        <span>تكلفة Twilio (${data.maxDuration} دقائق)</span>
        <span>$${data.twilioCallCost}</span>
      </div>
      <div class="cost-row">
        <span>تكلفة Media Streams</span>
        <span>$${data.mediaStreamsCost}</span>
      </div>
      <div class="cost-row">
        <span>تكلفة OpenAI</span>
        <span>$${data.openaiCost}</span>
      </div>
      <div class="cost-row total">
        <span>الإجمالي التقديري</span>
        <span>$${data.totalEstimate}</span>
      </div>
      <p class="cost-note">${data.note}</p>
    `;
    
    costDiv.classList.remove('hidden');
  } catch (error) {
    alert('فشل الاتصال بالخادم');
  }
}

async function initiateCall(e) {
  e.preventDefault();
  
  const contactId = document.getElementById('contactSelect').value;
  const task = document.getElementById('taskInput').value.trim();
  const errorDiv = document.getElementById('callError');
  const callBtn = document.getElementById('callBtn');
  
  errorDiv.classList.add('hidden');
  
  if (!contactId) {
    showCallError('اختر جهة اتصال');
    return;
  }
  
  if (task.length < 10) {
    showCallError('المهمة قصيرة جداً (10 حروف على الأقل)');
    return;
  }
  
  // تأكيد المكالمة
  const contact = state.contacts.find(c => c.id === contactId);
  const isLive = state.appInfo?.mode === 'live';
  
  if (isLive) {
    if (!confirm(`هل أنت متأكد من الاتصال بـ ${contact?.name}؟\n\nسيتم إجراء مكالمة حقيقية.`)) {
      return;
    }
  }
  
  setCallLoading(true);
  
  try {
    const res = await fetch('/api/calls/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contactId, 
        task,
        confirmed: true,
      }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showCallError(data.error || 'فشل بدء المكالمة');
      return;
    }
    
    // عرض المكالمة الجارية
    showActiveCall(data.call);
    
    // بدء متابعة الحالة
    startPolling(data.call.id);
    
    // مسح النموذج
    document.getElementById('taskInput').value = '';
    document.getElementById('costEstimate').classList.add('hidden');
    
  } catch (error) {
    showCallError('فشل الاتصال بالخادم');
  } finally {
    setCallLoading(false);
  }
}

function showCallError(message) {
  const errorDiv = document.getElementById('callError');
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}

function setCallLoading(loading) {
  const btn = document.getElementById('callBtn');
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loading').classList.toggle('hidden', !loading);
}

// ===== المكالمة الجارية =====

function showActiveCall(call) {
  state.activeCall = call;
  
  const container = document.getElementById('activeCall');
  document.getElementById('activeCallContact').textContent = `${call.contactName} (${call.contactPhone})`;
  document.getElementById('activeCallTask').textContent = call.task;
  document.getElementById('activeCallStatus').textContent = translateStatus(call.status);
  
  container.classList.remove('hidden');
  
  // تحديث المدة
  updateCallDuration();
}

function hideActiveCall() {
  state.activeCall = null;
  document.getElementById('activeCall').classList.add('hidden');
  stopPolling();
}

function updateCallDuration() {
  if (!state.activeCall?.startedAt) return;
  
  const start = new Date(state.activeCall.startedAt);
  const now = new Date();
  const seconds = Math.floor((now - start) / 1000);
  
  document.getElementById('activeCallDuration').textContent = formatDuration(seconds);
}

async function endCurrentCall() {
  if (!state.activeCall) return;
  
  if (!confirm('هل أنت متأكد من إنهاء المكالمة؟')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/calls/${state.activeCall.id}/end`, {
      method: 'POST',
    });
    
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'فشل إنهاء المكالمة');
      return;
    }
    
    hideActiveCall();
    fetchCalls();
  } catch (error) {
    alert('فشل الاتصال بالخادم');
  }
}

// ===== متابعة حالة المكالمة =====

function startPolling(callId) {
  stopPolling();
  
  // تحديث المدة كل ثانية
  const durationInterval = setInterval(updateCallDuration, 1000);
  
  // فحص الحالة كل 2 ثانية
  const statusInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/calls/${callId}/status`);
      const data = await res.json();
      
      if (!res.ok) {
        stopPolling();
        return;
      }
      
      // تحديث الحالة
      if (state.activeCall) {
        state.activeCall.status = data.status;
        document.getElementById('activeCallStatus').textContent = translateStatus(data.status);
      }
      
      // التحقق من انتهاء المكالمة
      const endedStatuses = ['completed', 'failed', 'busy', 'no-answer', 'canceled', 'demo_completed'];
      if (endedStatuses.includes(data.status)) {
        stopPolling();
        hideActiveCall();
        fetchCalls();
      }
    } catch (error) {
      console.error('فشل فحص حالة المكالمة:', error);
    }
  }, 2000);
  
  state.pollInterval = { durationInterval, statusInterval };
}

function stopPolling() {
  if (state.pollInterval) {
    clearInterval(state.pollInterval.durationInterval);
    clearInterval(state.pollInterval.statusInterval);
    state.pollInterval = null;
  }
}

// ===== سجل التدقيق =====

async function fetchAuditLog() {
  try {
    const res = await fetch('/api/audit?limit=100');
    if (!res.ok) throw new Error('فشل جلب السجل');
    
    state.auditLog = await res.json();
    renderAuditLog();
  } catch (error) {
    console.error(error);
    document.getElementById('auditList').innerHTML = 
      '<p class="error-message">فشل تحميل السجل</p>';
  }
}

function renderAuditLog() {
  const container = document.getElementById('auditList');
  
  if (state.auditLog.length === 0) {
    container.innerHTML = '<p class="empty-message">لا توجد سجلات.</p>';
    return;
  }
  
  container.innerHTML = state.auditLog.map(entry => `
    <div class="audit-item">
      <span class="audit-time">${formatDate(entry.timestamp)}</span>
      <span class="audit-user">${escapeHtml(entry.user)}</span>
      <span class="audit-action">${translateAction(entry.action)}</span>
    </div>
  `).join('');
}

function translateAction(action) {
  const map = {
    'login_success': '✓ تسجيل دخول',
    'login_failed': '✗ فشل تسجيل دخول',
    'logout': '↩ تسجيل خروج',
    'contact_created': '+ جهة اتصال جديدة',
    'contact_updated': '✎ تعديل جهة اتصال',
    'contact_deleted': '- حذف جهة اتصال',
    'contact_consent_given': '✓ تسجيل موافقة',
    'call_initiated': '📞 بدء مكالمة',
    'call_answered': '✓ تم الرد',
    'call_ended_manual': '⏹ إنهاء يدوي',
    'call_failed': '✗ فشل مكالمة',
    'demo_call_initiated': '📞 مكالمة تجريبية',
    'demo_call_completed': '✓ انتهت التجريبية',
  };
  return map[action] || action;
}

// ===== الأدوات المساعدة =====

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
