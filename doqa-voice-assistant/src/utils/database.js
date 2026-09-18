import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/db.json');

function loadDb() {
  if (!existsSync(DB_PATH)) {
    return { contacts: [], calls: [], auditLog: [] };
  }
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { contacts: [], calls: [], auditLog: [] };
  }
}

function saveDb(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// جهات الاتصال
export function getContacts() {
  return loadDb().contacts;
}

export function getContactById(id) {
  return loadDb().contacts.find(c => c.id === id);
}

export function getContactByPhone(phone) {
  const normalized = normalizePhone(phone);
  return loadDb().contacts.find(c => normalizePhone(c.phone) === normalized);
}

export function addContact(contact) {
  const db = loadDb();
  const newContact = {
    id: randomUUID(),
    name: contact.name,
    phone: normalizePhone(contact.phone),
    consentGiven: false,
    consentDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.contacts.push(newContact);
  saveDb(db);
  return newContact;
}

export function updateContact(id, updates) {
  const db = loadDb();
  const index = db.contacts.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  db.contacts[index] = {
    ...db.contacts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
  return db.contacts[index];
}

export function giveConsent(id) {
  return updateContact(id, {
    consentGiven: true,
    consentDate: new Date().toISOString(),
  });
}

export function deleteContact(id) {
  const db = loadDb();
  const index = db.contacts.findIndex(c => c.id === id);
  if (index === -1) return false;
  
  db.contacts.splice(index, 1);
  saveDb(db);
  return true;
}

// المكالمات
export function getCalls() {
  return loadDb().calls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getCallById(id) {
  return loadDb().calls.find(c => c.id === id);
}

export function getCallByTwilioSid(sid) {
  return loadDb().calls.find(c => c.twilioCallSid === sid);
}

export function addCall(call) {
  const db = loadDb();
  const newCall = {
    id: randomUUID(),
    contactId: call.contactId,
    contactName: call.contactName,
    contactPhone: call.contactPhone,
    task: call.task,
    status: 'pending',
    twilioCallSid: null,
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    estimatedCostUsd: call.estimatedCostUsd || 0,
    actualCostUsd: null,
    summary: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.calls.push(newCall);
  saveDb(db);
  return newCall;
}

export function updateCall(id, updates) {
  const db = loadDb();
  const index = db.calls.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  db.calls[index] = {
    ...db.calls[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveDb(db);
  return db.calls[index];
}

// سجل التدقيق
export function getAuditLog(limit = 100) {
  const db = loadDb();
  return db.auditLog
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export function addAuditEntry(entry) {
  const db = loadDb();
  const newEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    user: entry.user || 'system',
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details || {},
    ip: entry.ip || null,
  };
  db.auditLog.push(newEntry);
  
  // احتفظ بآخر 1000 سجل فقط
  if (db.auditLog.length > 1000) {
    db.auditLog = db.auditLog.slice(-1000);
  }
  
  saveDb(db);
  return newEntry;
}

// مساعد تنسيق رقم الهاتف
function normalizePhone(phone) {
  if (!phone) return '';
  // إزالة المسافات والشرطات
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  // تحويل 00 في البداية إلى +
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }
  // إضافة + إذا لم تكن موجودة وكان الرقم يبدأ برمز دولة
  if (!normalized.startsWith('+') && normalized.length > 10) {
    normalized = '+' + normalized;
  }
  return normalized;
}

export { normalizePhone };
