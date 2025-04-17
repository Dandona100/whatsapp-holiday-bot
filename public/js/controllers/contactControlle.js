// services/whatsappService.js – חיבור וניהול התקשורת עם WhatsApp
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const Contact = require('../models/Contact');
const logger = require('../helpers/logger');
const qrcode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.store = null;
    this.isConnected = false;
    this.isInitializing = false;
    this.authFolderPath = path.join(__dirname, '../config/auth_info');
    this.storePath = path.join(__dirname, '../config/store.json');
    this.qrCode = null; // data‑URL
    this.reconnectAttempts = 0;
    this.connectTimeout = null;
    this.maxReconnectAttempts = 5;
    this.autoReconnect = true;
  }

  /**
   * אתחול וחיבור ל‑WhatsApp
   */
  async initialize() {
    if (this.isInitializing) {
      logger.info('אתחול כבר רץ – ממתין לסיום');
      while (this.isInitializing) await new Promise(r => setTimeout(r, 500));
      return this.isConnected;
    }

    this.isInitializing = true;
    this.clearConnectTimeout();

    try {
      if (!fs.existsSync(this.authFolderPath)) {
        fs.mkdirSync(this.authFolderPath, { recursive: true });
      }

      // Initialize store for session data
      this.store = makeInMemoryStore({});
      if (fs.existsSync(this.storePath)) {
        this.store.readFromFile(this.storePath);
      }
      // Save store every 10 seconds
      setInterval(() => {
        this.store.writeToFile(this.storePath);
      }, 10_000);

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolderPath);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn' }),
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000, // Increased keep-alive interval
        defaultQueryTimeoutMs: 60_000,
        emitOwnEvents: true,
        markOnlineOnConnect: true,
        browser: ['Chrome (Windows)', 'Chrome', '110.0.5481.192'], // More realistic browser fingerprint
        syncFullHistory: true, // Only sync recent messages to reduce load
        patchMessageBeforeSending: (message) => {
          // Add web client signature
          const requiresPatch = !!(
            message.buttonsMessage ||
            message.templateMessage ||
            message.listMessage
          );
          if (requiresPatch) {
            message = { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} }, ...message } } };
          }
          return message;
        }
      });

      // Connect the store to the socket
      this.store.bind(this.sock.ev);
      
      this.registerEvents(saveCreds);
      logger.info('📡 מאזין ל‑WhatsApp...');
      
      // Set connect timeout
      this.connectTimeout = setTimeout(() => {
        if (!this.isConnected) {
          logger.warn('⌛ זמן החיבור הסתיים – מנסה שוב');
          this.reconnect();
        }
      }, 60_000);
      
      this.isInitializing = false;
      return true;
    } catch (err) {
      logger.error('❌ שגיאה באתחול WhatsApp:', err);
      this.isConnected = false;
      this.isInitializing = false;
      
      if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect();
      }
      
      throw err;
    }
  }

  clearConnectTimeout() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  async reconnect() {
    this.clearConnectTimeout();
    this.reconnectAttempts += 1;
    
    logger.info(`🔄 ניסיון התחברות מחדש (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Wait before attempting reconnection
    await delay(Math.min(this.reconnectAttempts * 5000, 30000));
    
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {
        // Ignore logout errors
      }
      this.sock = null;
    }
    
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      return this.initialize();
    } else {
      logger.error('⛔ עברנו את מגבלת הניסיונות. יש להתחבר ידנית.');
      return false;
    }
  }

  /**
   * רישום מאזיני‑אירועים
   */
  registerEvents(saveCreds) {
    // 1) Connection updates
    this.sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.qrCode = await qrcode.toDataURL(qr);
        logger.info('📎 קוד QR חדש נוצר – סרוק עם האפליקציה');
      }
  
      if (connection === 'open') {
        this.isConnected = true;
        this.qrCode = null;
        this.reconnectAttempts = 0;
        this.clearConnectTimeout();
        logger.info('✅ חיבור ל‑WhatsApp הצליח');
        return;  // לא מפעילים כאן סנכרון אנשי קשר
      }
  
      if (connection === 'close') {
        this.isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode || 0;
        const errorMessage = lastDisconnect?.error?.message || 'לא ידוע';
        logger.warn(`⚠️ החיבור נסגר – קוד ${statusCode} (${errorMessage})`);
  
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          this.deleteAuthFiles();
          this.qrCode = null;
          logger.info('🗑️ מחיקת auth נדרשת – יש לסרוק QR מחדש');
          await this.initialize();
        } else if (
          statusCode === DisconnectReason.restartRequired ||
          statusCode === DisconnectReason.connectionClosed ||
          statusCode === DisconnectReason.connectionReplaced ||
          statusCode === 408
        ) {
          if (this.autoReconnect) {
            await this.reconnect();
          }
        }
      }
    });
  
    // 2) Credentials update
    this.sock.ev.on('creds.update', async creds => {
      await saveCreds();
    });
  
    // 3) Incoming messages
    this.sock.ev.on('messages.upsert', async m => {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        await this.handleIncomingMessage(msg);
      }
    });
  
    // 4) ראשוני: סנכרון אנשי קשר דרך היסטוריית ההודעות
    this.sock.ev.on('messaging-history.set', async ({ isLatest, contacts }) => {
      if (!isLatest) return;
      logger.info(`📚 היסטוריית הודעות סונכרנה – סנכרון ${contacts.length} אנשי קשר`);
      await this.updateContacts(contacts);
    });
  
    // 5) עדכונים שוטפים באנשי קשר
    const contactHandler = cts => this.updateContacts(cts);
    this.sock.ev.on('contacts.set',    ({ contacts: newContacts }) => contactHandler(newContacts));
    this.sock.ev.on('contacts.upsert', contactHandler);
    this.sock.ev.on('contacts.update', contactHandler);
  
    // 6) Connectivity monitoring - send periodic pings
    setInterval(async () => {
      if (!this.isConnected) return;
      try {
        await this.sock.sendPresenceUpdate('available');
      } catch (e) {
        logger.warn('שגיאה בשליחת פינג:', e.message);
        // נסיון חיבור מחדש במידת הצורך
        if (this.isConnected) {
          try {
            await this.sock.fetchStatus('status@broadcast');
          } catch {
            this.isConnected = false;
            await this.reconnect();
          }
        }
      }
    }, 30_000);
  }  

  async syncContacts() {
    logger.info('🔄 מסנכרן אנשי קשר...');
    
    try {
      // הוספת לוגים מורחבים לבדיקת מבנה הנתונים
      logger.info('בודק מצב חיבור לפני סנכרון אנשי קשר');
      
      // בדיקה שהחיבור קיים 
      if (!this.sock) {
        logger.warn('אין חיבור, דילוג על סנכרון אנשי קשר');
        return false;
      }
      
      // ננסה לקבל אנשי קשר בכמה דרכים אפשריות
      let contacts = [];
      
      // 1. ננסה להשתמש ב-store.contacts
      if (this.store && this.store.contacts) {
        const storeContacts = Object.values(this.store.contacts).filter(c => c.id && !c.id.includes('@g.us'));
        if (storeContacts.length > 0) {
          logger.info(`נמצאו ${storeContacts.length} אנשי קשר מה-store`);
          contacts = storeContacts;
        }
      }
      
      // 2. אם אין אנשי קשר ב-store, ננסה לקבל ישירות מה-socket
      if (contacts.length === 0 && this.sock.store) {
        const sockContacts = Object.values(this.sock.store.contacts || {}).filter(c => c.id && !c.id.includes('@g.us'));
        if (sockContacts.length > 0) {
          logger.info(`נמצאו ${sockContacts.length} אנשי קשר מה-sock.store`);
          contacts = sockContacts;
        }
      }
      
      // 3. בדיקה אם יש מתודות אחרות לקבלת אנשי קשר
      if (contacts.length === 0 && this.sock.getContacts) {
        try {
          const getContactsResult = await this.sock.getContacts();
          if (Array.isArray(getContactsResult) && getContactsResult.length > 0) {
            logger.info(`נמצאו ${getContactsResult.length} אנשי קשר דרך getContacts`);
            contacts = getContactsResult.filter(c => c.id && !c.id.includes('@g.us'));
          }
        } catch (error) {
          logger.warn('שגיאה בקריאה ל-getContacts:', error.message);
        }
      }
      
      // 4. בדיקה אם יש מתודה של fetchContacts
      if (contacts.length === 0 && this.sock.fetchContacts) {
        try {
          const fetchContactsResult = await this.sock.fetchContacts();
          if (fetchContactsResult && typeof fetchContactsResult === 'object') {
            const fetchedContacts = Object.values(fetchContactsResult).filter(c => 
              c && c.id && !c.id.includes('@g.us')
            );
            
            if (fetchedContacts.length > 0) {
              logger.info(`נמצאו ${fetchedContacts.length} אנשי קשר דרך fetchContacts`);
              contacts = fetchedContacts;
            }
          }
        } catch (error) {
          logger.warn('שגיאה בקריאה ל-fetchContacts:', error.message);
        }
      }
      
      // אם לא מצאנו אנשי קשר בשום דרך
      if (contacts.length === 0) {
        logger.warn('לא נמצאו אנשי קשר בשום שיטה');
        
        // לחקור את מבנה האובייקטים כדי למצוא אנשי קשר
        if (this.store) {
          logger.info('מבנה ה-store:', Object.keys(this.store));
          
          // חיפוש אנשי קשר במקומות אחרים ב-store
          for (const key of Object.keys(this.store)) {
            if (typeof this.store[key] === 'object' && this.store[key] !== null) {
              logger.info(`בודק ב-store.${key}:`, 
                Array.isArray(this.store[key]) 
                  ? `מערך באורך ${this.store[key].length}` 
                  : `אובייקט עם ${Object.keys(this.store[key]).length} מפתחות`
              );
            }
          }
        }
        
        if (this.sock) {
          // בדיקת מבנה ה-sock לחיפוש אנשי קשר
          logger.info('מבנה ה-sock:', Object.keys(this.sock).filter(k => !k.startsWith('_')));
        }
        
        return false;
      }
      
      // אם מצאנו אנשי קשר, נעדכן אותם במסד הנתונים
      const savedContacts = await this.updateContacts(contacts);
      return savedContacts > 0;
      
    } catch (err) {
      logger.error('שגיאה בסנכרון אנשי קשר:', err);
      return false;
    }
  }

  async updateContacts(contacts) {
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      logger.warn('אין אנשי קשר לעדכון');
      return 0;
    }
    
    let updatedCount = 0;
    const errors = [];
    
    for (const c of contacts) {
      try {
        // בדיקה שיש לנו ID תקין
        if (!c.id && c.jid) c.id = c.jid; // טיפול במקרים שונים
        
        if (!c.id || (typeof c.id === 'string' && c.id.includes('@g.us'))) {
          continue; // דילוג על קבוצות או אנשי קשר ללא ID
        }
        
        // חילוץ מספר הטלפון מה-ID
        const phone = c.id.split('@')[0];
        if (!phone || phone.length < 5) { // בדיקה בסיסית שזה נראה כמו מספר טלפון
          continue;
        }
        
        // קביעת שם איש הקשר
        const name = c.notify || c.name || c.verifiedName || c.pushName || phone;
        
        // שמירה/עדכון במסד הנתונים
        const result = await Contact.findOneAndUpdate(
          { phoneNumber: phone }, 
          { 
            name, 
            phoneNumber: phone, 
            updatedAt: new Date(),
            whatsappId: c.id,
            // אם יש מידע נוסף שרוצים לשמור
            verified: !!c.verifiedName,
            status: c.status || null,
            pictureId: c.imgUrl || null
          }, 
          { upsert: true, new: true }
        );
        
        if (result) updatedCount++;
      } catch (e) {
        logger.error(`שגיאה בעדכון איש קשר:`, e);
        errors.push(e.message);
      }
    }
    
    if (updatedCount > 0) {
      logger.info(`👥 עודכנו ${updatedCount} אנשי קשר`);
    }
    
    if (errors.length > 0) {
      logger.warn(`היו ${errors.length} שגיאות בעדכון אנשי קשר`);
    }
    
    return updatedCount;
  }

  deleteAuthFiles() {
    try {
      if (fs.existsSync(this.authFolderPath)) {
        fs.readdirSync(this.authFolderPath).forEach(f => fs.unlinkSync(path.join(this.authFolderPath, f)));
        logger.info('🗑️ קבצי האימות נמחקו');
      }
      // Also delete store
      if (fs.existsSync(this.storePath)) {
        fs.unlinkSync(this.storePath);
        logger.info('🗑️ קובץ מאגר נמחק');
      }
    } catch (e) {
      logger.error('שגיאה במחיקת קבצי auth:', e);
    }
  }

  /**
   * החזרת QR – ללא אפס‑אוטומטי של auth
   */
  async getQRCode() {
    if (this.isConnected) return null;

    if (!this.qrCode && !this.isInitializing && !this.sock) {
      await this.initialize();
    }

    let waited = 0;
    while (!this.qrCode && !this.isConnected && waited < 300) {
      await new Promise(r => setTimeout(r, 1_000));
      waited += 1;
      if (waited % 30 === 0) logger.info(`⌛ ממתין ל‑QR... (${waited}s)`);
    }
    
    if (this.isConnected) return null;
    return this.qrCode || null;
  }

  async handleIncomingMessage(message) {
    try {
      // Filter only messages from individual contacts (not groups)
      const sender = message.key.remoteJid;
      if (!sender || sender.includes('@g.us')) return;
      
      // Extract phone number
      const phone = sender.split('@')[0];
      
      // Get message text content from various possible formats
      const text = this.extractMessageText(message);
      if (!text) return;
      
      // Update contact's last interaction date
      await Contact.findOneAndUpdate(
        { phoneNumber: phone },
        { 
          lastChatDate: new Date(),
          // נעדכן גם את שם איש הקשר אם יש לנו מידע נוסף
          $setOnInsert: { name: phone } 
        },
        { upsert: true }
      );
      
      logger.info(`✉️ ${phone}: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Here you can add additional logic to process incoming messages
      // For example, automated responses, command processing, etc.
    } catch (e) {
      logger.error('שגיאה בטיפול בהודעה נכנסת:', e);
    }
  }

  extractMessageText(message) {
    if (!message.message) return '';
    
    // Extract text from various types of messages
    const { message: msg } = message;
    
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId;
    if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
    
    return '';
  }

  async sendTextMessage(recipient, text) {
    if (!this.isConnected) throw new Error('אין חיבור ל‑WhatsApp');
    
    // Ensure recipient is in the correct format
    const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
    
    try {
      // Send typing indicator
      await this.sock.presenceSubscribe(jid);
      await delay(300);
      await this.sock.sendPresenceUpdate('composing', jid);
      await delay(1000);
      await this.sock.sendPresenceUpdate('paused', jid);
      
      // Send the message
      await this.sock.sendMessage(jid, { text });
      logger.info(`📤 נשלחה הודעה אל ${recipient}`);
      return true;
    } catch (error) {
      logger.error(`שגיאה בשליחת הודעה אל ${recipient}:`, error);
      throw error;
    }
  }

  async sendBulkMessages(recipients, text, delay = 300_000) {
    if (!this.isConnected) throw new Error('אין חיבור ל‑WhatsApp');
    
    // Randomize delay slightly to make it more natural
    const randomizeDelay = (baseDelay) => {
      return baseDelay + Math.floor(Math.random() * 30000); // +/- 30 seconds
    };
    
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      logger.info(`שולח הודעות לקבוצה ${Math.floor(i/batchSize) + 1}/${Math.ceil(recipients.length/batchSize)}`);
      
      for (const recipient of batch) {
        try {
          // Send with typing indicators for more natural behavior
          await this.sendTextMessage(recipient, text);
          successCount++;
          
          // Add random delay between messages (500ms - 3000ms)
          await new Promise(res => setTimeout(res, 500 + Math.random() * 2500));
        } catch (e) {
          logger.error(`שגיאה בשליחת הודעה אל ${recipient}:`, e.message);
          failureCount++;
        }
      }
      
      // Add delay between batches
      if (i + batchSize < recipients.length) {
        const batchDelay = randomizeDelay(delay);
        logger.info(`המתנה ${batchDelay / 1_000}s לקבוצה הבאה`);
        await new Promise(res => setTimeout(res, batchDelay));
      }
    }
    
    logger.info(`סיכום: ${successCount} הודעות נשלחו בהצלחה, ${failureCount} נכשלו`);
    return { successCount, failureCount };
  }

  async sendMediaMessage(recipient, mediaPath, caption = '', type = 'image') {
    if (!this.isConnected) throw new Error('אין חיבור ל‑WhatsApp');
    
    const jid = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
    
    try {
      if (!fs.existsSync(mediaPath)) {
        throw new Error(`הקובץ לא נמצא: ${mediaPath}`);
      }
      
      const media = fs.readFileSync(mediaPath);
      const fileName = path.basename(mediaPath);
      const mimetype = this.getMimeType(mediaPath, type);
      
      // Send typing indicator first
      await this.sock.presenceSubscribe(jid);
      await this.sock.sendPresenceUpdate('composing', jid);
      await delay(1000);
      
      let messageData;
      const lower = type.toLowerCase();
      
      switch (lower) {
        case 'image':
          messageData = { 
            image: media, 
            caption,
            mimetype: mimetype || 'image/jpeg'
          };
          break;
        case 'video':
          messageData = { 
            video: media, 
            caption,
            mimetype: mimetype || 'video/mp4'
          };
          break;
        case 'audio':
          messageData = { 
            audio: media,
            mimetype: mimetype || 'audio/mp3',
            ptt: false // Set to true for voice note
          };
          break;
        case 'document':
          messageData = { 
            document: media,
            mimetype: mimetype || 'application/pdf',
            fileName: fileName,
            caption
          };
          break;
        default:
          throw new Error(`סוג מדיה לא נתמך: ${type}`);
      }
      
      await this.sock.sendMessage(jid, messageData);
      logger.info(`📤 מדיה ${type} נשלחה אל ${recipient}`);
      return true;
      
    } catch (error) {
      logger.error(`שגיאה בשליחת מדיה אל ${recipient}:`, error);
      throw error;
    }
  }

  getMimeType(filepath, defaultType) {
    const ext = path.extname(filepath).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mkv': 'video/x-matroska',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/m4a'
    };
    
    return mimeTypes[ext] || null;
  }

  async disconnect() {
    this.clearConnectTimeout();
    if (!this.sock) return true;
    
    logger.info('סוגר את החיבור לוואטסאפ...');
    
    try {
      await this.sock.logout();
    } catch (e) {
      logger.warn('שגיאה בהתנתקות:', e.message);
    }
    
    this.isConnected = false;
    this.qrCode = null;
    this.sock = null;
    logger.info('🔌 התנתק מ‑WhatsApp');
    return true;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      phoneNumber: this.isConnected && this.sock?.user ? this.sock.user.id.split('@')[0] : null,
      name: this.isConnected && this.sock?.user ? this.sock.user.name : null,
      qrAvailable: Boolean(this.qrCode),
      initializing: this.isInitializing,
      reconnectAttempt: this.reconnectAttempts
    };
  }
}