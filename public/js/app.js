/**
 * منصة صوت الموظف - مصادقة وتنقل
 */

var AUTH = {
  ADMIN_USER: 'صادق',
  ADMIN_PASS: '1988',
  KEY: 'complaint_platform_admin'
};

function isAdminLoggedIn() {
  try {
    var data = sessionStorage.getItem(AUTH.KEY);
    return data === 'true';
  } catch (e) {
    return false;
  }
}

function login(username, password) {
  var ok = (username && String(username).trim() === AUTH.ADMIN_USER && String(password) === AUTH.ADMIN_PASS);
  if (ok) {
    sessionStorage.setItem(AUTH.KEY, 'true');
    sessionStorage.setItem(AUTH.KEY + '_name', AUTH.ADMIN_USER);
  }
  return ok;
}

function logout() {
  sessionStorage.removeItem(AUTH.KEY);
  sessionStorage.removeItem(AUTH.KEY + '_name');
}

function requireAdmin() {
  if (!isAdminLoggedIn()) {
    window.location.href = 'index.html#loginForm';
    return false;
  }
  return true;
}

function updateNav() {
  var adminLink = document.getElementById('navAdmin');
  var loginLink = document.getElementById('navLogin');
  var logoutLink = document.getElementById('navLogout');
  if (adminLink) adminLink.style.display = isAdminLoggedIn() ? '' : 'none';
  if (loginLink) loginLink.style.display = isAdminLoggedIn() ? 'none' : '';
  if (logoutLink) logoutLink.style.display = isAdminLoggedIn() ? '' : 'none';
}
