// controllers/contactController.js - בקר לניהול אנשי קשר וקטגוריות
const Contact = require('../models/Contact');
const Category = require('../models/Category');
const logger = require('../helpers/logger');

/**
 * בקר לניהול אנשי קשר
 */
const contactController = {
  /**
   * קבלת כל אנשי הקשר עם אפשרות סינון
   */
  getAllContacts: async (req, res) => {
    try {
      const {
        category,
        lastChat,
        search,
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1,
        limit = 50
      } = req.query;
      
      // בניית שאילתה לפי הפרמטרים שהתקבלו
      const query = {};
      
      // סינון לפי קטגוריה
      if (category) {
        query.categories = category;
      }
      
      // סינון לפי תאריך שיחה אחרונה
      if (lastChat) {
        const days = parseInt(lastChat);
        if (!isNaN(days)) {
          const date = new Date();
          date.setDate(date.getDate() - days);
          query.lastChatDate = { $gte: date };
        }
      }
      
      // חיפוש לפי טקסט (בשם או מספר טלפון)
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { nickname: { $regex: search, $options: 'i' } }
        ];
      }
      
      // אנשי קשר פעילים בלבד
      query.isActive = true;
      
      // חישוב המיקום לדילוג
      const skip = (page - 1) * limit;
      
      // יצירת אובייקט המיון
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // ביצוע השאילתה עם פופולציה של קטגוריות
      const contacts = await Contact.find(query)
        .populate('categories', 'name color')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));
      
      // ספירת סך הכל רשומות (לצורך עימוד)
      const total = await Contact.countDocuments(query);
      
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
      logger.error('שגיאה בקבלת אנשי קשר:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת אנשי קשר',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת איש קשר לפי מזהה
   */
  getContactById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const contact = await Contact.findById(id)
        .populate('categories', 'name color');
      
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: contact
      });
    } catch (error) {
      logger.error(`שגיאה בקבלת איש קשר ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת איש קשר',
        error: error.message
      });
    }
  },
  
  /**
   * יצירת איש קשר חדש
   */
  createContact: async (req, res) => {
    try {
      const { name, phoneNumber, nickname, title, categories } = req.body;
      
      // בדיקה האם איש הקשר כבר קיים
      const existingContact = await Contact.findOne({ phoneNumber });
      if (existingContact) {
        return res.status(400).json({
          success: false,
          message: 'איש קשר עם מספר טלפון זה כבר קיים'
        });
      }
      
      // יצירת איש קשר חדש
      const contact = new Contact({
        name,
        phoneNumber,
        nickname,
        title,
        categories: categories || [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await contact.save();
      
      return res.status(201).json({
        success: true,
        message: 'איש קשר נוצר בהצלחה',
        data: contact
      });
    } catch (error) {
      logger.error('שגיאה ביצירת איש קשר:', error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה ביצירת איש קשר',
        error: error.message
      });
    }
  },
  
  /**
   * עדכון איש קשר
   */
  updateContact: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phoneNumber, nickname, title, categories, notes, isActive } = req.body;
      
      // בדיקה האם איש הקשר קיים
      const contact = await Contact.findById(id);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // בדיקה שמספר טלפון לא מתנגש עם איש קשר אחר
      if (phoneNumber && phoneNumber !== contact.phoneNumber) {
        const existingContact = await Contact.findOne({ phoneNumber });
        if (existingContact && existingContact._id.toString() !== id) {
          return res.status(400).json({
            success: false,
            message: 'מספר טלפון זה כבר קיים אצל איש קשר אחר'
          });
        }
      }
      
      // עדכון השדות
      if (name) contact.name = name;
      if (phoneNumber) contact.phoneNumber = phoneNumber;
      if (nickname !== undefined) contact.nickname = nickname;
      if (title !== undefined) contact.title = title;
      if (categories) contact.categories = categories;
      if (notes !== undefined) contact.notes = notes;
      if (isActive !== undefined) contact.isActive = isActive;
      
      contact.updatedAt = new Date();
      
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'איש קשר עודכן בהצלחה',
        data: contact
      });
    } catch (error) {
      logger.error(`שגיאה בעדכון איש קשר ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בעדכון איש קשר',
        error: error.message
      });
    }
  },
  
  /**
   * מחיקת איש קשר (סימון כלא פעיל)
   */
  deleteContact: async (req, res) => {
    try {
      const { id } = req.params;
      
      // מציאת איש הקשר
      const contact = await Contact.findById(id);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // סימון כלא פעיל במקום מחיקה פיזית
      contact.isActive = false;
      contact.updatedAt = new Date();
      
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'איש קשר נמחק בהצלחה'
      });
    } catch (error) {
      logger.error(`שגיאה במחיקת איש קשר ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה במחיקת איש קשר',
        error: error.message
      });
    }
  },
  
  /**
   * הוספת איש קשר לקטגוריה
   */
  addContactToCategory: async (req, res) => {
    try {
      const { contactId, categoryId } = req.params;
      
      // בדיקה שאיש הקשר קיים
      const contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // בדיקה שהקטגוריה קיימת
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'קטגוריה לא נמצאה'
        });
      }
      
      // בדיקה אם איש הקשר כבר בקטגוריה
      if (contact.categories.includes(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'איש הקשר כבר נמצא בקטגוריה זו'
        });
      }
      
      // הוספת הקטגוריה
      contact.categories.push(categoryId);
      contact.updatedAt = new Date();
      
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'איש הקשר נוסף לקטגוריה בהצלחה',
        data: contact
      });
    } catch (error) {
      logger.error(`שגיאה בהוספת איש קשר לקטגוריה:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בהוספת איש קשר לקטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * הסרת איש קשר מקטגוריה
   */
  removeContactFromCategory: async (req, res) => {
    try {
      const { contactId, categoryId } = req.params;
      
      // בדיקה שאיש הקשר קיים
      const contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // בדיקה אם איש הקשר נמצא בקטגוריה
      if (!contact.categories.includes(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'איש הקשר לא נמצא בקטגוריה זו'
        });
      }
      
      // הסרת הקטגוריה
      contact.categories = contact.categories.filter(
        cat => cat.toString() !== categoryId
      );
      contact.updatedAt = new Date();
      
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'איש הקשר הוסר מהקטגוריה בהצלחה',
        data: contact
      });
    } catch (error) {
      logger.error(`שגיאה בהסרת איש קשר מקטגוריה:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בהסרת איש קשר מקטגוריה',
        error: error.message
      });
    }
  },
  
  /**
   * קבלת אנשי קשר לפי פילטר תאריך שיחה אחרונה
   */
  getContactsByLastChat: async (req, res) => {
    try {
      const { days } = req.params;
      const daysInt = parseInt(days);
      
      if (isNaN(daysInt)) {
        return res.status(400).json({
          success: false,
          message: 'מספר ימים לא תקין'
        });
      }
      
      // חישוב התאריך לסינון
      const date = new Date();
      date.setDate(date.getDate() - daysInt);
      
      // מציאת אנשי קשר עם שיחה אחרונה לאחר התאריך הנבחר
      const contacts = await Contact.find({
        lastChatDate: { $gte: date },
        isActive: true
      }).populate('categories', 'name color');
      
      return res.status(200).json({
        success: true,
        count: contacts.length,
        data: contacts
      });
    } catch (error) {
      logger.error(`שגיאה בקבלת אנשי קשר לפי תאריך שיחה:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בקבלת אנשי קשר לפי תאריך שיחה',
        error: error.message
      });
    }
  },
  
  /**
   * עדכון כינוי או תואר לאיש קשר
   */
  updateContactNicknameOrTitle: async (req, res) => {
    try {
      const { id } = req.params;
      const { nickname, title } = req.body;
      
      if (nickname === undefined && title === undefined) {
        return res.status(400).json({
          success: false,
          message: 'יש לספק כינוי או תואר לעדכון'
        });
      }
      
      // מציאת איש הקשר
      const contact = await Contact.findById(id);
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'איש קשר לא נמצא'
        });
      }
      
      // עדכון השדות הרלוונטיים
      if (nickname !== undefined) contact.nickname = nickname;
      if (title !== undefined) contact.title = title;
      contact.updatedAt = new Date();
      
      await contact.save();
      
      return res.status(200).json({
        success: true,
        message: 'כינוי או תואר עודכן בהצלחה',
        data: contact
      });
    } catch (error) {
      logger.error(`שגיאה בעדכון כינוי או תואר:`, error);
      return res.status(500).json({
        success: false,
        message: 'שגיאה בעדכון כינוי או תואר',
        error: error.message
      });
    }
  }
};

module.exports = contactController;