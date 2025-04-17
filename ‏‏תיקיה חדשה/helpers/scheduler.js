// helpers/scheduler.js - פונקציות עזר לתזמון משימות ושליחת הודעות
const logger = require('./logger');

/**
 * מודול לתזמון משימות ושליחת הודעות
 */
const scheduler = {
  /**
   * תזמון שליחת הודעות בקבוצות כדי למנוע חסימות
   * @param {Array} contacts - רשימת אנשי קשר
   * @param {string} messageTemplate - תבנית ההודעה
   * @param {Function} sendCallback - פונקציה לשליחת הודעה
   * @param {number} batchSize - גודל קבוצה
   * @param {number} delayBetweenBatches - השהייה בין קבוצות (במילישניות)
   * @param {number} delayBetweenMessages - השהייה בין הודעות באותה קבוצה (במילישניות)
   * @returns {Promise} - הבטחה שתסתיים כאשר כל ההודעות נשלחו
   */
  scheduleBulkMessages: async (
    contacts,
    messageTemplate,
    sendCallback,
    batchSize = 10,
    delayBetweenBatches = 300000, // 5 דקות
    delayBetweenMessages = 1000 // שנייה
  ) => {
    try {
      if (!Array.isArray(contacts) || contacts.length === 0) {
        logger.warn('רשימת אנשי קשר ריקה או לא תקינה');
        return;
      }
      
      if (!sendCallback || typeof sendCallback !== 'function') {
        logger.error('לא סופקה פונקציית שליחה תקינה');
        return;
      }
      
      // יצירת קבוצות
      const batches = [];
      for (let i = 0; i < contacts.length; i += batchSize) {
        batches.push(contacts.slice(i, i + batchSize));
      }
      
      logger.info(`התחלת משלוח הודעות ל-${contacts.length} אנשי קשר ב-${batches.length} קבוצות`);
      
      let successCount = 0;
      let failureCount = 0;
      
      // שליחה רקורסיבית של כל הקבוצות
      const processBatch = async (batchIndex) => {
        if (batchIndex >= batches.length) {
          logger.info(`סיום משלוח הודעות: ${successCount} הצלחות, ${failureCount} כישלונות`);
          return { success: successCount, failure: failureCount };
        }
        
        const batch = batches[batchIndex];
        logger.info(`מעבד קבוצה ${batchIndex + 1}/${batches.length} (${batch.length} אנשי קשר)`);
        
        // שליחה לכל הנמענים בקבוצה
        for (const contact of batch) {
          try {
            const result = await sendCallback(contact, messageTemplate);
            
            if (result) {
              successCount++;
            } else {
              failureCount++;
            }
            
            // השהייה קצרה בין הודעות באותה קבוצה
            if (delayBetweenMessages > 0) {
              await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
            }
          } catch (error) {
            logger.error(`שגיאה בשליחת הודעה לאיש קשר ${contact.phoneNumber || contact._id}:`, error);
            failureCount++;
          }
        }
        
        // אם זו לא הקבוצה האחרונה, המתן לפני שליחה לקבוצה הבאה
        if (batchIndex < batches.length - 1 && delayBetweenBatches > 0) {
          logger.info(`ממתין ${delayBetweenBatches / 1000} שניות לפני שליחת הקבוצה הבאה...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
        
        // המשך לקבוצה הבאה
        return processBatch(batchIndex + 1);
      };
      
      // התחלת התהליך
      return processBatch(0);
    } catch (error) {
      logger.error('שגיאה בתזמון משלוח הודעות:', error);
      throw error;
    }
  },
  
  /**
   * תזמון שליחת הודעה למועד מסוים בעתיד
   * @param {Function} callback - פונקציה לביצוע במועד המתוזמן
   * @param {Date|number} scheduledTime - זמן מתוזמן (תאריך או מספר מילישניות)
   * @returns {Object} - אובייקט עם מזהה התזמון ופונקציית ביטול
   */
  scheduleMessage: (callback, scheduledTime) => {
    try {
      if (!callback || typeof callback !== 'function') {
        throw new Error('נדרשת פונקציית callback תקינה');
      }
      
      let delay;
      
      // חישוב ההשהיה בהתאם לסוג הקלט
      if (scheduledTime instanceof Date) {
        delay = scheduledTime.getTime() - Date.now();
      } else if (typeof scheduledTime === 'number') {
        delay = scheduledTime;
      } else {
        throw new Error('זמן מתוזמן לא תקין. נדרש Date או מספר מילישניות');
      }
      
      // בדיקה שההשהיה חיובית
      if (delay < 0) {
        logger.warn('זמן מתוזמן כבר עבר, ביצוע מיידי');
        delay = 0;
      }
      
      // יצירת תזמון
      const timeoutId = setTimeout(() => {
        try {
          logger.info('ביצוע משימה מתוזמנת');
          callback();
        } catch (callbackError) {
          logger.error('שגיאה בביצוע משימה מתוזמנת:', callbackError);
        }
      }, delay);
      
      // החזרת אובייקט עם מזהה ופונקציית ביטול
      return {
        id: timeoutId,
        cancel: () => {
          clearTimeout(timeoutId);
          logger.info('תזמון בוטל');
          return true;
        }
      };
    } catch (error) {
      logger.error('שגיאה בתזמון הודעה:', error);
      throw error;
    }
  },
  
  /**
   * תזמון משימה חוזרת במרווחי זמן קבועים
   * @param {Function} callback - פונקציה לביצוע בכל פעם
   * @param {number} interval - מרווח זמן בין ביצועים (במילישניות)
   * @returns {Object} - אובייקט עם מזהה התזמון ופונקציית ביטול
   */
  scheduleRecurring: (callback, interval) => {
    try {
      if (!callback || typeof callback !== 'function') {
        throw new Error('נדרשת פונקציית callback תקינה');
      }
      
      if (!interval || interval < 1000) {
        logger.warn('מרווח זמן קטן מדי, מינימום 1000 מילישניות (שנייה)');
        interval = 1000;
      }
      
      // יצירת תזמון מחזורי
      const intervalId = setInterval(() => {
        try {
          logger.info('ביצוע משימה מחזורית');
          callback();
        } catch (callbackError) {
          logger.error('שגיאה בביצוע משימה מחזורית:', callbackError);
        }
      }, interval);
      
      // החזרת אובייקט עם מזהה ופונקציית ביטול
      return {
        id: intervalId,
        cancel: () => {
          clearInterval(intervalId);
          logger.info('תזמון מחזורי בוטל');
          return true;
        }
      };
    } catch (error) {
      logger.error('שגיאה בתזמון משימה מחזורית:', error);
      throw error;
    }
  }
};

module.exports = scheduler;