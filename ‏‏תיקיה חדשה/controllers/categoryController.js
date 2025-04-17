// controllers/categoryController.js - בקר לניהול קטגוריות
const Category = require('../models/Category');
const Contact = require('../models/Contact');
const logger = require('../helpers/logger');

/**
 * בקר לניהול קטגוריות
 */
const categoryController = {
  /**
   * קבלת כל הקטגוריות
   */
  getAllCategories: async (req, res) => {
    try {
      const { withCount, search, page = 1, limit = 50 } = req.query;
      
      // בניית שאילתה לפי הפרמטרים שהתקבלו
      const query = { isActive: true };
      
      // חיפוש לפי טקסט
      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }
      
      // חישוב המיקום לדילוג
      const skip = (page - 1) * limit;
      
      // יצירת שאילתה בסיסית
      let categoriesQuery = Category.find(query)
        .sort({ order: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // אם נדרש, הוספת ספירת אנשי קשר לכל קטגוריה
      if (withCount === 'true') {
        categoriesQuery = categoriesQuery.populate('contactCount');
      }
      
      // ביצוע השאילתה
      const categories = await categoriesQuery;
      
      // ספירת סך הכל רשומות
      const total = await Category.countDocuments(query);
      
      return res.status(200).json({
        success: true,
        data: categories,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('שגיאה בקבלת קטגוריות:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת קטגוריות',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת קטגוריה לפי מזהה
   */
  getCategoryById: async (req, res) => {
    try {
      const { id } = req.params;
      const { withContacts } = req.query;
      
      // מציאת הקטגוריה
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'קטגוריה לא נמצאה'
        });
      }
      
      // התוצאה הבסיסית
      const result = {
        success: true,
        data: category
      };
      
      // אם נדרש, הוספת אנשי קשר השייכים לקטגוריה
      if (withContacts === 'true') {
        const contacts = await Contact.find({
          categories: id,
          isActive: true
        }).select('name phoneNumber nickname title lastChatDate');
        
        result.data.contacts = contacts;
      }
      
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`שגיאה בקבלת קטגוריה ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת קטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * יצירת קטגוריה חדשה
   */
  createCategory: async (req, res) => {
    try {
      const { name, description, color, order, parent } = req.body;
      
      // בדיקה האם קטגוריה עם אותו שם כבר קיימת
      const existingCategory = await Category.findOne({ name, isActive: true });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'קטגוריה עם שם זה כבר קיימת'
        });
      }
      
      // יצירת הקטגוריה החדשה
      const category = new Category({
        name,
        description,
        color,
        order: order || 0,
        parent: parent || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await category.save();
      
      return res.status(201).json({
        success: true,
        message: 'קטגוריה נוצרה בהצלחה',
        data: category
      });
    } catch (error) {
      logger.error('שגיאה ביצירת קטגוריה:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה ביצירת קטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * עדכון קטגוריה קיימת
   */
  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, color, order, parent, isActive } = req.body;
      
      // בדיקה האם הקטגוריה קיימת
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'קטגוריה לא נמצאה'
        });
      }
      
      // בדיקה שאין קטגוריה אחרת עם אותו שם
      if (name && name !== category.name) {
        const existingCategory = await Category.findOne({ name, isActive: true });
        if (existingCategory && existingCategory._id.toString() !== id) {
          return res.status(400).json({
            success: false,
            message: 'קטגוריה אחרת עם שם זה כבר קיימת'
          });
        }
      }
      
      // בדיקה שלא מגדירים את הקטגוריה כקטגוריית אב של עצמה
      if (parent && parent === id) {
        return res.status(400).json({
          success: false,
          message: 'קטגוריה לא יכולה להיות קטגוריית אב של עצמה'
        });
      }
      
      // עדכון השדות
      if (name) category.name = name;
      if (description !== undefined) category.description = description;
      if (color) category.color = color;
      if (order !== undefined) category.order = order;
      if (parent !== undefined) category.parent = parent;
      if (isActive !== undefined) category.isActive = isActive;
      
      category.updatedAt = new Date();
      
      await category.save();
      
      return res.status(200).json({
        success: true,
        message: 'קטגוריה עודכנה בהצלחה',
        data: category
      });
    } catch (error) {
      logger.error(`שגיאה בעדכון קטגוריה ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בעדכון קטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * מחיקת קטגוריה (סימון כלא פעילה)
   */
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      
      // מציאת הקטגוריה
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'קטגוריה לא נמצאה'
        });
      }
      
      // בדיקה האם יש אנשי קשר המשויכים לקטגוריה
      const contactCount = await Contact.countDocuments({ categories: id, isActive: true });
      
      // אם יש אנשי קשר, רק סימון כלא פעילה
      // אחרת ניתן למחוק פיזית (לא מיושם כאן למניעת שגיאות)
      category.isActive = false;
      category.updatedAt = new Date();
      
      await category.save();
      
      return res.status(200).json({
        success: true,
        message: 'קטגוריה נמחקה בהצלחה',
        data: {
          hadContacts: contactCount > 0,
          contactCount
        }
      });
    } catch (error) {
      logger.error(`שגיאה במחיקת קטגוריה ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה במחיקת קטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת כל אנשי הקשר בקטגוריה
   */
  getCategoryContacts: async (req, res) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      // בדיקה שהקטגוריה קיימת
      const category = await Category.findById(id);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'קטגוריה לא נמצאה'
        });
      }
      
      // חישוב המיקום לדילוג
      const skip = (page - 1) * limit;
      
      // מציאת אנשי הקשר בקטגוריה
      const contacts = await Contact.find({
        categories: id,
        isActive: true
      })
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // ספירת סך הכל אנשי קשר בקטגוריה
      const total = await Contact.countDocuments({
        categories: id,
        isActive: true
      });
      
      return res.status(200).json({
        success: true,
        data: contacts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error(`שגיאה בקבלת אנשי קשר בקטגוריה ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת אנשי קשר בקטגוריה',
        error: error.message
      });
    }
  }
};

module.exports = categoryController;