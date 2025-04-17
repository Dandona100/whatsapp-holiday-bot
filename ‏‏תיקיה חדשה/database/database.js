// database/database.js - חיבור למסד הנתונים
const mongoose = require('mongoose');
const logger = require('../helpers/logger');

/**
 * מודול לניהול החיבור למסד הנתונים MongoDB
 */
const database = {
  /**
   * יצירת חיבור למסד הנתונים
   */
  connect: async () => {
    try {
      const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot';
      
      await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true
      });
      
      logger.info('התחבר בהצלחה למסד הנתונים');
      
      mongoose.connection.on('error', (err) => {
        logger.error('שגיאה בחיבור למסד הנתונים:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.warn('החיבור למסד הנתונים נותק');
      });
      
      return mongoose.connection;
    } catch (error) {
      logger.error('שגיאה בהתחברות למסד הנתונים:', error);
      throw error;
    }
  },
  
  /**
   * ניתוק ממסד הנתונים
   */
  disconnect: async () => {
    try {
      await mongoose.disconnect();
      logger.info('נותק בהצלחה ממסד הנתונים');
      return true;
    } catch (error) {
      logger.error('שגיאה בניתוק ממסד הנתונים:', error);
      throw error;
    }
  },
  
  /**
   * בדיקת סטטוס חיבור
   */
  isConnected: () => {
    return mongoose.connection.readyState === 1;
  }
};

module.exports = database;