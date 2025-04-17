// routes/messageRoutes.js - נתיבי API להודעות
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const multer = require('multer');
const path = require('path');

/**
 * הגדרת הגדרות אחסון עבור קבצי מדיה
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// הגדרת סוגי קבצים מותרים
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('סוג קובץ לא נתמך! תמיכה ב-jpeg, jpg, png, gif, pdf, doc, docx בלבד.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB מקסימום
});

/**
 * נתיבי API עבור הודעות
 */

// שליחת הודעה לאיש קשר בודד
router.post('/send', messageController.sendMessage);

// שליחת הודעה למספר אנשי קשר
router.post('/send-bulk', messageController.sendBulkMessages);

// שליחת הודעה עם מדיה (תמונה/מסמך)
router.post('/send-media', upload.single('media'), messageController.sendMediaMessage);

// קבלת הודעות אחרונות
router.get('/recent', messageController.getRecentMessages);

// מענה להודעה נכנסת
router.post('/reply', messageController.replyToMessage);

// קבלת סטטוס חיבור וואטסאפ
router.get('/status', messageController.getWhatsAppStatus);

module.exports = router;