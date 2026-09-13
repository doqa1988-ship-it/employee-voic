/**
 * سكربت تهيئة قاعدة البيانات وإنشاء المسؤول الافتراضي
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../models/database');

async function initializeDatabase() {
  console.log('🚀 بدء تهيئة قاعدة البيانات...\n');

  try {
    // التحقق من وجود مسؤول
    const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").get();

    if (existingAdmin) {
      console.log('✅ يوجد مسؤول بالفعل في قاعدة البيانات');
      console.log('   لإضافة مسؤول جديد، استخدم: npm run create-admin\n');
      return;
    }

    // إنشاء المسؤول الافتراضي
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@2024!';
    const name = process.env.DEFAULT_ADMIN_NAME || 'مدير النظام';

    const hashedPassword = await bcrypt.hash(password, 12);

    db.prepare(`
      INSERT INTO users (username, password, name, role, is_active)
      VALUES (?, ?, ?, 'super_admin', 1)
    `).run(username, hashedPassword, name);

    console.log('✅ تم إنشاء المسؤول الافتراضي بنجاح!\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║            بيانات تسجيل الدخول الأولي                 ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  اسم المستخدم: ${username.padEnd(38)}║`);
    console.log(`║  كلمة المرور: ${password.padEnd(39)}║`);
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  ⚠️  مهم: غيّر كلمة المرور بعد أول تسجيل دخول!       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
