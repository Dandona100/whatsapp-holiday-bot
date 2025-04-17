// controllers/templateController.js - בקר לניהול תבניות הודעה
const Template = require('../models/Template');
const logger = require('../helpers/logger');
const fs = require('fs');
const path = require('path');

/**
 * בקר לניהול תבניות הודעה
 */
const templateController = {
  /**
   * קבלת כל התבניות
   */
  getAllTemplates: async (req, res) => {
    try {
      const { type, search, page = 1, limit = 20 } = req.query;
      
      // בניית שאילתה לפי הפרמטרים שהתקבלו
      const query = { isActive: true };
      
      // סינון לפי סוג תבנית
      if (type) {
        query.type = type;
      }
      
      // חיפוש לפי טקסט
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } }
        ];
      }
      
      // חישוב המיקום לדילוג
      const skip = (page - 1) * limit;
      
      // ביצוע השאילתה
      const templates = await Template.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // ספירת סך הכל רשומות
      const total = await Template.countDocuments(query);
      
      return res.status(200).json({
        success: true,
        data: templates,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('שגיאה בקבלת תבניות:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת תבניות',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת תבנית לפי מזהה
   */
  getTemplateById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const template = await Template.findById(id);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'תבנית לא נמצאה'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error(`שגיאה בקבלת תבנית ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת תבנית',
        error: error.message
      });
    }
  },
  
  /**
   * יצירת תבנית חדשה
   */
  createTemplate: async (req, res) => {
    try {
      const { name, content, type = 'text', tags } = req.body;
      
      // בדיקה האם תבנית עם אותו שם כבר קיימת
      const existingTemplate = await Template.findOne({ name, isActive: true });
      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'תבנית עם שם זה כבר קיימת'
        });
      }
      
      let mediaUrl = null;
      
      // טיפול בהעלאת קובץ עבור תבניות מסוג media או canva
      if (type !== 'text' && req.file) {
        mediaUrl = `/templates/${req.file.filename}`;
      }
      
      // יצירת התבנית החדשה
      const template = new Template({
        name,
        content,
        type,
        mediaUrl,
        tags: tags || [],
        createdBy: req.user ? req.user.id : 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await template.save();
      
      return res.status(201).json({
        success: true,
        message: 'תבנית נוצרה בהצלחה',
        data: template
      });
    } catch (error) {
      logger.error('שגיאה ביצירת תבנית:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה ביצירת תבנית',
        error: error.message
      });
    }
  },
  
  /**
   * עדכון תבנית קיימת
   */
  updateTemplate: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, content, type, tags, isActive } = req.body;
      
      // בדיקה האם התבנית קיימת
      const template = await Template.findById(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'תבנית לא נמצאה'
        });
      }
      
      // בדיקה שאין תבנית אחרת עם אותו שם
      if (name && name !== template.name) {
        const existingTemplate = await Template.findOne({ name, isActive: true });
        if (existingTemplate && existingTemplate._id.toString() !== id) {
          return res.status(400).json({
            success: false,
            message: 'תבנית אחרת עם שם זה כבר קיימת'
          });
        }
      }
      
      // עדכון השדות
      if (name) template.name = name;
      if (content) template.content = content;
      if (type) template.type = type;
      if (tags) template.tags = tags;
      if (isActive !== undefined) template.isActive = isActive;
      
      // טיפול בהעלאת קובץ חדש
      if (req.file) {
        // מחיקת הקובץ הקודם אם קיים
        if (template.mediaUrl) {
          const oldFilePath = path.join(__dirname, '../public', template.mediaUrl);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        
        template.mediaUrl = `/templates/${req.file.filename}`;
      }
      
      template.updatedAt = new Date();
      
      await template.save();
      
      return res.status(200).json({
        success: true,
        message: 'תבנית עודכנה בהצלחה',
        data: template
      });
    } catch (error) {
      logger.error(`שגיאה בעדכון תבנית ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בעדכון תבנית',
        error: error.message
      });
    }
  },
  
  /**
   * מחיקת תבנית (סימון כלא פעילה)
   */
  deleteTemplate: async (req, res) => {
    try {
      const { id } = req.params;
      
      // מציאת התבנית
      const template = await Template.findById(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'תבנית לא נמצאה'
        });
      }
      
      // סימון כלא פעילה במקום מחיקה פיזית
      template.isActive = false;
      template.updatedAt = new Date();
      
      await template.save();
      
      return res.status(200).json({
        success: true,
        message: 'תבנית נמחקה בהצלחה'
      });
    } catch (error) {
      logger.error(`שגיאה במחיקת תבנית ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה במחיקת תבנית',
        error: error.message
      });
    }
  },
  
  /**
   * תצוגה מקדימה של תבנית עם ערכים לדוגמה
   */
  previewTemplate: async (req, res) => {
    try {
      const { id } = req.params;
      const { previewData } = req.body;
      
      // מציאת התבנית
      const template = await Template.findById(id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'תבנית לא נמצאה'
        });
      }
      
      // יצירת ערכים לדוגמה אם לא סופקו
      const sampleValues = previewData || {
        'שם איש קשר': 'ישראל ישראלי',
        'כינוי': 'ישראל',
        'תאריך': new Date().toLocaleDateString('he-IL'),
        'שעה': new Date().toLocaleTimeString('he-IL'),
        'תואר': 'לקוח VIP',
        'קטגוריה': 'לקוחות'
      };
      
      // שימוש במתודה של התבנית להחלפת הערכים
      const previewContent = template.applyValues(sampleValues);
      
      return res.status(200).json({
        success: true,
        data: {
          template: template.name,
          originalContent: template.content,
          previewContent
        }
      });
    } catch (error) {
      logger.error(`שגיאה בתצוגה מקדימה של תבנית ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בתצוגה מקדימה של תבנית',
        error: error.message
      });
    }
  }
};

module.exports = templateController;