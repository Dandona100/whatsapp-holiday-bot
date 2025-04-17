// routes/categoryRoutes.js - נתיבי API לקטגוריות
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

/**
 * נתיבי API עבור קטגוריות
 */

// קבלת כל הקטגוריות
router.get('/', categoryController.getAllCategories);

// קבלת קטגוריה לפי מזהה
router.get('/:id', categoryController.getCategoryById);

// יצירת קטגוריה חדשה
router.post('/', categoryController.createCategory);

// עדכון קטגוריה קיימת
router.put('/:id', categoryController.updateCategory);

// מחיקת קטגוריה (סימון כלא פעילה)
router.delete('/:id', categoryController.deleteCategory);

// קבלת כל אנשי הקשר בקטגוריה
router.get('/:id/contacts', categoryController.getCategoryContacts);

module.exports = router;