// controllers/messageController.js - בקר לניהול הודעות
const Contact = require('../models/Contact');
const Template = require('../models/Template');
const Category = require('../models/Category');
const whatsappService = require('../services/whatsappService');
const formatter = require('../helpers/formatter');
const scheduler = require('../helpers/scheduler');
const logger = require('../helpers/logger');

/**
 * בקר לניהול הודעות
 */
const messageController = {
  /**
   * שליחת הודעה לאיש קשר בודד
   */
  sendMessage: async (req, res) => {
    try {
      const { contactId, text, templateId } = req.body;
      
      // בדיקה שאיש הקשר קיים
      const contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      let messageText = text;
      
      // אם יש מזהה תבנית, השתמש בה
      if (templateId) {
        const template = await Template.findById(templateId);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: 'תבנית לא נמצאה'
          });
        }
        
        // יצירת אובייקט ערכים עבור התבנית
        const values = {
          'שם איש קשר': contact.name,
          'כינוי': contact.nickname || contact.name,
          'תאריך': new Date().toLocaleDateString('he-IL'),
          'שעה': new Date().toLocaleTimeString('he-IL'),
          'תואר': contact.title || ''
        };
        
        // החלת ערכים על התבנית
        messageText = template.applyValues(values);
      }
      
      // שליחת ההודעה דרך שירות הוואטסאפ
      await whatsappService.sendTextMessage(contact.phoneNumber, messageText);
      
      // עדכון תאריך שיחה אחרונה בפרטי איש הקשר
      contact.lastChatDate = new Date();
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'ההודעה נשלחה בהצלחה',
        data: {
          contact: contact.name,
          messageText
        }
      });
    } catch (error) {
      logger.error('שגיאה בשליחת הודעה:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשליחת הודעה',
        error: error.message
      });
    }
  },
  
  /**
   * שליחת הודעה למספר אנשי קשר
   */
  sendBulkMessages: async (req, res) => {
    try {
      const { contactIds, categoryId, text, templateId } = req.body;
      let contacts = [];
      
      // בדיקה שיש לפחות קבוצה אחת או רשימת אנשי קשר
      if (!contactIds && !categoryId) {
        return res.status(400).json({
          success: false,
          message: 'יש לספק רשימת אנשי קשר או קטגוריה'
        });
      }
      
      // קבלת אנשי קשר לפי מזהים או קטגוריה
      if (contactIds && contactIds.length > 0) {
        contacts = await Contact.find({
          _id: { $in: contactIds },
          isActive: true
        });
      } else if (categoryId) {
        contacts = await Contact.find({
          categories: categoryId,
          isActive: true
        });
      }
      
      if (contacts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'לא נמצאו אנשי קשר למשלוח'
        });
      }
      
      let messageTemplate = text;
      
      // אם יש מזהה תבנית, טען אותה
      if (templateId) {
        const template = await Template.findById(templateId);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: 'תבנית לא נמצאה'
          });
        }
        messageTemplate = template.content;
      }
      
      // יצירת רשימת מספרי טלפון עבור המשלוח
      const phoneNumbers = contacts.map(contact => contact.phoneNumber);
      
      // התחלת משלוח בקבוצות באמצעות scheduler
      scheduler.scheduleBulkMessages(contacts, messageTemplate, async (contact, message) => {
        try {
          // החלפת ערכים דינמיים בהודעה
          const personalizedMessage = formatter.replaceTemplateValues(message, {
            'שם איש קשר': contact.name,
            'כינוי': contact.nickname || contact.name,
            'תאריך': new Date().toLocaleDateString('he-IL'),
            'תואר': contact.title || ''
          });
          
          // שליחת ההודעה
          await whatsappService.sendTextMessage(contact.phoneNumber, personalizedMessage);
          
          // עדכון תאריך שיחה אחרונה
          contact.lastChatDate = new Date();
          await contact.save();
          
          return true;
        } catch (error) {
          logger.error(`שגיאה בשליחת הודעה לאיש קשר ${contact.phoneNumber}:`, error);
          return false;
        }
      });
      
      return res.status(200).json({
        success: true,
        message: `התחיל משלוח ל-${contacts.length} אנשי קשר בקבוצות של 10`,
        data: {
          totalContacts: contacts.length,
          estimatedTimeMinutes: Math.ceil(contacts.length / 10) * 5
        }
      });
    } catch (error) {
      logger.error('שגיאה בשליחת הודעות מרובות:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשליחת הודעות מרובות',
        error: error.message
      });
    }
  },
  
  /**
   * שליחת הודעה עם מדיה (תמונה/מסמך)
   */
  sendMediaMessage: async (req, res) => {
    try {
      const { contactId, caption, mediaType } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'לא התקבל קובץ מדיה'
        });
      }
      
      // בדיקה שאיש הקשר קיים
      const contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // שליחת קובץ המדיה
      await whatsappService.sendMediaMessage(
        contact.phoneNumber,
        req.file.path,
        caption || '',
        mediaType || 'image'
      );
      
      // עדכון תאריך שיחה אחרונה
      contact.lastChatDate = new Date();
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'הודעת מדיה נשלחה בהצלחה',
        data: {
          contact: contact.name,
          mediaType,
          fileName: req.file.filename
        }
      });
    } catch (error) {
      logger.error('שגיאה בשליחת הודעת מדיה:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשליחת הודעת מדיה',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת הודעות אחרונות
   */
  getRecentMessages: async (req, res) => {
    try {
      // זוהי פונקציה מדגימה בלבד - היא דורשת שמירת היסטוריית הודעות במסד הנתונים
      // רוב ספריות ה-API של וואטסאפ לא שומרות היסטוריית הודעות באופן מובנה
      
      return res.status(200).json({
        success: true,
        message: 'הודעות אחרונות התקבלו',
        data: []  // כאן צריך לשלוף את ההודעות האחרונות ממסד הנתונים
      });
    } catch (error) {
      logger.error('שגיאה בקבלת הודעות אחרונות:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת הודעות אחרונות',
        error: error.message
      });
    }
  },
  
  /**
   * מענה להודעה נכנסת
   */
  replyToMessage: async (req, res) => {
    try {
      const { contactId, text, messageId } = req.body;
      
      if (!contactId || !text) {
        return res.status(400).json({
          success: false,
          message: 'יש לספק מזהה איש קשר והודעה'
        });
      }
      
      // בדיקה שאיש הקשר קיים
      const contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // שליחת התשובה (בספריית Baileys ניתן לציין messageId מקורי לתשובה)
      await whatsappService.sendTextMessage(contact.phoneNumber, text, messageId);
      
      // עדכון תאריך שיחה אחרונה
      contact.lastChatDate = new Date();
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'התשובה נשלחה בהצלחה',
        data: {
          contact: contact.name,
          text
        }
      });
    } catch (error) {
      logger.error('שגיאה בשליחת תשובה:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בשליחת תשובה',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת סטטוס חיבור וואטסאפ
   */
  getWhatsAppStatus: async (req, res) => {
    try {
      const status = whatsappService.getConnectionStatus();
      
      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('שגיאה בקבלת סטטוס וואטסאפ:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת סטטוס וואטסאפ',
        error: error.message
      });
    }
  }
};

module.exports = messageController;