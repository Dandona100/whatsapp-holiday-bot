// routes/templateRoutes.js - נתיבי API לתבניות הודעה
const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const multer = require('multer');
const path = require('path');

/**
 * הגדרת הגדרות אחסון עבור תבניות עם מדיה
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/templates/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, 'template-' + uniqueSuffix + extension);
  }
});

// הגדרת מגבלות ובדיקות על הקובץ
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך! תמיכה ב-jpeg, jpg, png, gif, pdf בלבד.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB מקסימום
});

/**
 * נתיבי API עבור תבניות הודעה
 */

// קבלת כל התבניות
router.get('/', templateController.getAllTemplates);

// קבלת תבנית לפי מזהה
router.get('/:id', templateController.getTemplateById);

// יצירת תבנית חדשה
router.post('/', upload.single('media'), templateController.createTemplate);

// עדכון תבנית קיימת
router.put('/:id', upload.single('media'), templateController.updateTemplate);

// מחיקת תבנית (סימון כלא פעילה)
router.delete('/:id', templateController.deleteTemplate);

// תצוגה מקדימה של תבנית עם ערכים לדוגמה
router.post('/:id/preview', templateController.previewTemplate);

module.exports = router;