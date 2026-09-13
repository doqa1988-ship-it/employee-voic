/**
 * سكربت إنشاء مسؤول جديد
 * الاستخدام: node scripts/create-admin.js <username> <password> <name>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function createAdmin() {
  console.log('\n🔐 إنشاء مسؤول جديد\n');

  try {
    let username, password, name;

    // إذا تم تمرير المعلومات كـ arguments
    if (process.argv.length >= 5) {
      username = process.argv[2];
      password = process.argv[3];
      name = process.argv.slice(4).join(' ');
    } else {
      // طلب المعلومات تفاعلياً
      username = await prompt('اسم المستخدم: ');
      password = await prompt('كلمة المرور: ');
      name = await prompt('الاسم الكامل: ');
    }

    if (!username || !password || !name) {
      console.error('❌ جميع الحقول مطلوبة');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      process.exit(1);
    }

    // التحقق من عدم وجود المستخدم
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      console.error('❌ اسم المستخدم موجود مسبقاً');
      process.exit(1);
    }

    // إنشاء المستخدم
    const hashedPassword = await bcrypt.hash(password, 12);
    
    db.prepare(`
      INSERT INTO users (username, password, name, role, is_active)
      VALUES (?, ?, ?, 'super_admin', 1)
    `).run(username, hashedPassword, name);

    console.log('\n✅ تم إنشاء المسؤول بنجاح!');
    console.log(`   اسم المستخدم: ${username}`);
    console.log(`   الاسم: ${name}\n`);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();
