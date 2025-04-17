// config/config.js - הגדרות כלליות של האפליקציה
const path = require('path');

/**
 * אובייקט הגדרות מרכזי
 */
const config = {
  /**
   * הגדרות בסיסיות
   */
  app: {
    name: 'WhatsApp Bot',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  },
  
  /**
   * הגדרות מסד נתונים
   */
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      useCreateIndex: true
    }
  },
  
  /**
   * הגדרות WhatsApp
   */
  whatsapp: {
    // זמן ניתוק אוטומטי (דקות)
    sessionTimeout: parseInt(process.env.WHATSAPP_SESSION_TIMEOUT) || 60,
    
    // נתיב לשמירת מידע אימות
    authPath: path.join(__dirname, 'auth_info.json'),
    
    // הגדרות שליחה בקבוצות
    bulkSending: {
      // גודל קבוצה מקסימלי
      batchSize: parseInt(process.env.WHATSAPP_BATCH_SIZE) || 10,
      
      // השהייה בין קבוצות (מילישניות)
      delayBetweenBatches: parseInt(process.env.WHATSAPP_BATCH_DELAY) || 300000, // 5 דקות
      
      // השהייה בין הודעות בודדות באותה קבוצה (מילישניות)
      delayBetweenMessages: parseInt(process.env.WHATSAPP_MESSAGE_DELAY) || 1000 // שנייה
    }
  },
  
  /**
   * הגדרות קבצים ותבניות
   */
  files: {
    // מיקום לשמירת קבצי העלאה
    uploadsDir: path.join(__dirname, '../public/uploads'),
    
    // מיקום לשמירת תבניות
    templatesDir: path.join(__dirname, '../public/templates'),
    
    // גודל קובץ מקסימלי (בבתים)
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    
    // סוגי קבצים מותרים
    allowedFileTypes: {
      image: ['.jpg', '.jpeg', '.png', '.gif'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
      media: ['.mp4', '.mp3']
    }
  },
  
  /**
   * הגדרות יומן רישום
   */
  logging: {
    // רמת הרישום
    level: process.env.LOG_LEVEL || 'info',
    
    // מיקום היומנים
    dir: path.join(__dirname, '../logs')
  },
  
  /**
   * הגדרות אבטחה
   */
  security: {
    // מפתח סודי ליצירת JWT
    jwtSecret: process.env.JWT_SECRET || 'whatsapp-bot-secret-key',
    
    // תוקף הטוקן (בשניות)
    jwtExpiration: parseInt(process.env.JWT_EXPIRATION) || 86400, // 24 שעות
    
    // מקורות מותרים ל-CORS
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  }
};

module.exports = config;