/**
 * معالج الأخطاء المركزي
 */

const errorHandler = (err, req, res, next) => {
  console.error('خطأ:', err);

  // أخطاء التحقق من البيانات
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'خطأ في البيانات المدخلة',
      details: err.errors
    });
  }

  // أخطاء قاعدة البيانات
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({
      error: 'البيانات موجودة مسبقاً أو تنتهك قيود قاعدة البيانات'
    });
  }

  // أخطاء رفع الملفات
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'حجم الملف يتجاوز الحد المسموح (5 ميجابايت)'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'نوع الملف غير مسموح به'
    });
  }

  // خطأ عام
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'حدث خطأ في الخادم' 
    : err.message;

  res.status(statusCode).json({ error: message });
};

module.exports = { errorHandler };
