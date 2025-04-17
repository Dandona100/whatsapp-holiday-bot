// routes/contactRoutes.js - נתיבי API לאנשי קשר
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

/**
 * נתיבי API עבור אנשי קשר
 */

// קבלת כל אנשי הקשר עם אפשרות סינון
router.get('/', contactController.getAllContacts);

// קבלת איש קשר לפי מזהה
router.get('/:id', contactController.getContactById);

// יצירת איש קשר חדש
router.post('/', contactController.createContact);

// עדכון איש קשר
router.put('/:id', contactController.updateContact);

// מחיקת איש קשר (סימון כלא פעיל)
router.delete('/:id', contactController.deleteContact);

// הוספת איש קשר לקטגוריה
router.post('/:contactId/categories/:categoryId', contactController.addContactToCategory);

// הסרת איש קשר מקטגוריה
router.delete('/:contactId/categories/:categoryId', contactController.removeContactFromCategory);

// קבלת אנשי קשר לפי פילטר תאריך שיחה אחרונה
router.get('/filter/last-chat/:days', contactController.getContactsByLastChat);

// עדכון כינוי או תואר לאיש קשר
router.patch('/:id/nickname-or-title', contactController.updateContactNicknameOrTitle);

module.exports = router;