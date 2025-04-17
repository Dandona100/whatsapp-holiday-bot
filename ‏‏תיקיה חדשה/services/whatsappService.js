// services/whatsappService.js - חיבור וניהול התקשורת עם וואטסאפ
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@adiwajshing/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const Contact = require('../models/Contact');
const logger = require('../helpers/logger');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.isInitializing = false; // דגל חדש למניעת אתחולים מרובים
    this.authFolderPath = path.join(__dirname, '../config/auth_info');
    this.qrCode = null;
    this.reconnectAttempts = 0;
  }

  /**
   * אתחול וחיבור לוואטסאפ
   */
  async initialize() {
    // מניעת אתחולים מרובים במקביל
    if (this.isInitializing) {
      logger.info('אתחול כבר מתבצע, ממתין...');
      // המתן עד שהאתחול הנוכחי יסתיים
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return true;
    }

    this.isInitializing = true;

    try {
      // וודא שתיקיית האימות קיימת
      if (!fs.existsSync(this.authFolderPath)) {
        fs.mkdirSync(this.authFolderPath, { recursive: true });
      }
  
      // טעינת מידע אימות 
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolderPath);
      
      // יצירת חיבור חדש עם הגדרות מותאמות
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp Bot', 'Chrome', '103.0.5060.114'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        defaultQueryTimeoutMs: 60000,
        emitOwnEvents: true,
        markOnlineOnConnect: true
      });
      
      // הרשמה לאירועים
      this.registerEvents(saveCreds);
      
      logger.info('מאזין ל-WhatsApp...');
      this.isInitializing = false;
      return true;
    } catch (error) {
      logger.error('שגיאה בהתחברות לוואטסאפ:', error);
      this.isConnected = false;
      this.isInitializing = false;
      throw error;
    }
  }

  /**
   * רישום למאזינים לאירועים בוואטסאפ
   */
  registerEvents(saveCreds) {
    // עדכון מצב התחברות
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // שמירת קוד QR אם זמין
      if (qr) {
        this.qrCode = qr;
        logger.info('התקבל קוד QR חדש! יש לסרוק את קוד ה-QR עם אפליקציית WhatsApp בטלפון');
      }
      
      if (connection === 'close') {
        this.isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        logger.warn(`החיבור לוואטסאפ נסגר. קוד: ${statusCode}, סיבה: ${lastDisconnect?.error?.message || 'לא ידוע'}`);
        
        // שינוי: לא ננסה להתחבר מחדש באופן אוטומטי
        // המשתמש יצטרך ללחוץ על "התחברות מחדש" בממשק
        if (statusCode === DisconnectReason.loggedOut) {
          // אם המשתמש התנתק במכוון, נמחק את קובצי האימות
          try {
            const files = fs.readdirSync(this.authFolderPath);
            for (const file of files) {
              fs.unlinkSync(path.join(this.authFolderPath, file));
            }
            logger.info('קבצי האימות נמחקו בהצלחה');
          } catch (err) {
            logger.error('שגיאה במחיקת קבצי האימות:', err);
          }
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.qrCode = null; // ניקוי קוד QR כאשר מחובר
        this.reconnectAttempts = 0; // איפוס מונה הניסיונות כשהחיבור הצליח
        logger.info('חובר בהצלחה לוואטסאפ');
      }
    });
  
    // שמירת מידע אימות
    this.sock.ev.on('creds.update', saveCreds);
  
    // קבלת הודעות חדשות
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;
      
      for (const message of m.messages) {
        await this.handleIncomingMessage(message);
      }
    });
    
    // עדכון רשימת אנשי קשר
    this.sock.ev.on('contacts.update', async (contacts) => {
      for (const contact of contacts) {
        if (contact.id && !contact.id.includes('@g.us')) {
          // עדכון איש קשר במסד הנתונים
          const phoneNumber = contact.id.split('@')[0];
          const name = contact.notify || contact.name || phoneNumber;
          
          await Contact.findOneAndUpdate(
            { phoneNumber },
            { 
              name,
              phoneNumber,
              updatedAt: new Date()
            },
            { upsert: true, new: true }
          );
        }
      }
      logger.info(`עודכנו ${contacts.length} אנשי קשר`);
    });
  }

  /**
   * קבלת קוד QR נוכחי
   */
  async getQRCode() {
    try {
      // אם כבר מחובר, אין צורך בקוד QR
      if (this.isConnected) {
        logger.info('אין צורך בקוד QR, המכשיר כבר מחובר');
        return null;
      }

      // אם אין קוד QR זמין וגם לא בתהליך אתחול, נתחיל אתחול חדש
      if (!this.qrCode && !this.isInitializing) {
        logger.info('אין קוד QR זמין, מאתחל חיבור חדש...');
        
        // נאפס קבצי אימות ישנים
        try {
          if (fs.existsSync(this.authFolderPath)) {
            const files = fs.readdirSync(this.authFolderPath);
            for (const file of files) {
              fs.unlinkSync(path.join(this.authFolderPath, file));
            }
          }
        } catch (err) {
          logger.error('שגיאה במחיקת קבצי אימות:', err);
        }
        
        // אתחול חדש
        await this.initialize();
        
        // המתן לקבלת QR (מקסימום 15 שניות)
        let attempts = 0;
        while (!this.qrCode && attempts < 15) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
          if (attempts % 5 === 0) {
            logger.info(`ממתין לקוד QR... (${attempts} שניות)`);
          }
        }
      } else if (this.isInitializing) {
        // אם כרגע באתחול, נמתין לקוד QR
        logger.info('מאתחל חיבור, ממתין לקוד QR...');
        
        let attempts = 0;
        while (!this.qrCode && attempts < 15) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
          if (attempts % 5 === 0) {
            logger.info(`ממתין לקוד QR... (${attempts} שניות)`);
          }
        }
      }
      
      // אם יש קוד QR זמין, נמיר אותו ל-base64 ונחזיר
      if (this.qrCode) {
        const qrDataURL = await qrcode.toDataURL(this.qrCode);
        logger.info('קוד QR נוצר בהצלחה והוחזר');
        return qrDataURL;
      } else {
        logger.error('לא ניתן לקבל קוד QR תקף');
        return null;
      }
    } catch (error) {
      logger.error('שגיאה ביצירת קוד QR:', error);
      return null;
    }
  }

  /**
   * טיפול בהודעות נכנסות
   */
  async handleIncomingMessage(message) {
    try {
      const sender = message.key.remoteJid;
      // בדיקה שזו הודעה פרטית ולא מקבוצה
      if (sender && sender.includes('@s.whatsapp.net')) {
        let messageContent = '';
        
        // קבלת הטקסט מההודעה (התאמה לגרסה החדשה)
        if (message.message) {
          if (message.message.conversation) {
            messageContent = message.message.conversation;
          } else if (message.message.extendedTextMessage) {
            messageContent = message.message.extendedTextMessage.text;
          }
        }
        
        if (messageContent) {
          // עדכון תאריך שיחה אחרונה עבור איש הקשר
          const phoneNumber = sender.split('@')[0];
          await Contact.findOneAndUpdate(
            { phoneNumber },
            { lastChatDate: new Date() },
            { new: true }
          );
          
          logger.info(`התקבלה הודעה חדשה מ-${phoneNumber}: ${messageContent.substring(0, 50)}...`);
          
          // כאן ניתן להוסיף לוגיקה לטיפול בהודעות נכנסות
        }
      }
    } catch (error) {
      logger.error('שגיאה בטיפול בהודעה נכנסת:', error);
    }
  }

  /**
   * שליחת הודעת טקסט
   */
  async sendTextMessage(recipient, text) {
    if (!this.isConnected) {
      throw new Error('אין חיבור לוואטסאפ');
    }
    
    try {
      const jid = recipient.includes('@s.whatsapp.net') ? 
        recipient : `${recipient}@s.whatsapp.net`;
      
      await this.sock.sendMessage(jid, { text });
      logger.info(`נשלחה הודעה אל ${recipient}`);
      return true;
    } catch (error) {
      logger.error(`שגיאה בשליחת הודעה אל ${recipient}:`, error);
      throw error;
    }
  }

  /**
   * שליחת הודעות למספר אנשי קשר בקבוצות
   */
  async sendBulkMessages(recipients, text, delay = 300000) {
    const batchSize = 10; // גודל הקבוצה
    const batches = [];
    
    // חלוקה לקבוצות
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    
    // שליחה לכל קבוצה בנפרד עם השהייה בין הקבוצות
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // שליחה לכל הנמענים בקבוצה
      for (const recipient of batch) {
        try {
          await this.sendTextMessage(recipient, text);
          // השהייה קצרה בין הודעות באותה קבוצה
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`שגיאה בשליחת הודעה לקבוצה: ${error.message}`);
        }
      }
      
      // אם זו לא הקבוצה האחרונה, המתן לפני שליחה לקבוצה הבאה
      if (i < batches.length - 1) {
        logger.info(`ממתין ${delay / 1000} שניות לפני שליחת הקבוצה הבאה...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return true;
  }

  /**
   * שליחת הודעה עם מדיה (תמונה, וידאו, מסמך)
   */
  async sendMediaMessage(recipient, mediaPath, caption, type) {
    if (!this.isConnected) {
      throw new Error('אין חיבור לוואטסאפ');
    }
    
    try {
      const jid = recipient.includes('@s.whatsapp.net') ? 
        recipient : `${recipient}@s.whatsapp.net`;
      
      const media = fs.readFileSync(mediaPath);
      let messageData;
      
      switch (type.toLowerCase()) {
        case 'image':
          messageData = {
            image: media,
            caption: caption
          };
          break;
        case 'video':
          messageData = {
            video: media,
            caption: caption
          };
          break;
        case 'document':
          messageData = {
            document: media,
            mimetype: 'application/pdf', // ניתן לשנות בהתאם לסוג המסמך
            caption: caption
          };
          break;
        default:
          throw new Error(`סוג מדיה לא נתמך: ${type}`);
      }
      
      await this.sock.sendMessage(jid, messageData);
      
      logger.info(`נשלחה הודעת מדיה מסוג ${type} אל ${recipient}`);
      return true;
    } catch (error) {
      logger.error(`שגיאה בשליחת הודעת מדיה אל ${recipient}:`, error);
      throw error;
    }
  }

  /**
   * ניתוק מוואטסאפ
   */
  async disconnect() {
    if (this.sock) {
      try {
        await this.sock.logout();
        this.isConnected = false;
        this.qrCode = null;
        logger.info('נותק בהצלחה מוואטסאפ');
        return true;
      } catch (error) {
        logger.error('שגיאה בניתוק מוואטסאפ:', error);
        return false;
      }
    }
    return true;
  }

  /**
   * בדיקת סטטוס חיבור
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      phoneNumber: this.isConnected && this.sock.user ? this.sock.user.id.split('@')[0] : null,
      name: this.isConnected && this.sock.user ? this.sock.user.name : null,
      qrAvailable: !!this.qrCode,  // מוסיף אינדיקציה אם יש קוד QR זמין
      initializing: this.isInitializing  // מוסיף אינדיקציה אם מתבצע אתחול
    };
  }
}

module.exports = new WhatsAppService();ש