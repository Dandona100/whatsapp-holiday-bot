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
    // Connection updates
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
        // לא ניגשים כאן לסנכרון־Contacts אלא מחכים ל־messaging-history.set
        return;
      }
  
      if (connection === 'close') {
        this.isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode || 0;
        const errorMessage = lastDisconnect?.error?.message || 'לא ידוע';
        logger.warn(`⚠️ החיבור נסגר – קוד ${statusCode} (${errorMessage})`);
  
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          this.deleteAuthFiles();
          this.qrCode = null;
          logger.info('נדרש סריקת QR חדשה');
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
  
    // אחרי סנכרון ההיסטוריה של ההודעות – עכשיו אפשר לסנכרן אנשי קשר
    this.sock.ev.on('messaging-history.set', async ({ isLatest }) => {
      if (isLatest) {
        logger.info('📚 היסטוריית הודעות סונכרנה – מתחילים לסנכרן אנשי קשר');
        try {
          await this.syncContacts();
        } catch (e) {
          logger.error('שגיאה בסנכרון אנשי קשר:', e);
        }
      }
    });
  
    // מאזינים ל־contacts.upsert ו־contacts.update כדי לעדכן DB
    const upsertHandler = (cts) => this.updateContacts(cts);
    this.sock.ev.on('contacts.upsert',  upsertHandler);
    this.sock.ev.on('contacts.update',  upsertHandler);
  
    // Credentials update
    this.sock.ev.on('creds.update', async (creds) => {
      await saveCreds();
    });
  
    // הודעות נכנסות
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;
      for (const msg of m.messages) {
        await this.handleIncomingMessage(msg);
      }
    });
  
    // Handle message history sync (respond only to real-time messages)
    this.sock.ev.on('messaging-history.set', () => {
      logger.info('📚 היסטוריית הודעות סונכרנה');
    });

    // Contacts
    this.sock.ev.on('contacts.update', async (contacts) => {
      await this.updateContacts(contacts);
    });

    // Connectivity monitoring - send periodic pings
    setInterval(async () => {
      if (this.isConnected) {
        try {
          // Send ping to keep connection alive
          await this.sock.sendPresenceUpdate('available');
        } catch (e) {
          logger.warn('שגיאה בשליחת פינג:', e.message);
          if (this.isConnected) { // Verify we're still marked as connected
            // Connection might be dead but we don't know yet
            logger.warn('החיבור עשוי להיות לא פעיל - בודק...');
            try {
              await this.sock.fetchStatus('0000000000@s.whatsapp.net').catch(() => {});
            } catch (e) {
              // Request failed, try to reconnect
              logger.error('החיבור מת - מתחבר מחדש');
              this.isConnected = false;
              await this.reconnect();
            }
          }
        }
      }
    }, 30_000);
  }

  async syncContacts() {
    logger.info('🔄 מסנכרן אנשי קשר...');
    
    try {
      // לוגים לאבחון מה זמין
      logger.info('בודק זמינות חיבור:', !!this.sock);
      logger.info('בודק זמינות this.store:', !!this.store);
      logger.info('בודק זמינות this.sock.store:', !!(this.sock && this.sock.store));
      
      // בדיקה שהחיבור קיים 
      if (!this.sock) {
        logger.warn('אין חיבור, דילוג על סנכרון אנשי קשר');
        return false;
      }
      
      // ננסה להשתמש ב-store מה-sock או מה-instance
      const store = this.sock.store || this.store;
      
      if (!store) {
        logger.warn('אין גישה ל-store, דילוג על סנכרון אנשי קשר');
        return false;
      }
      
      // בדיקה שיש contacts
      if (store.contacts) {
        const contacts = Object.values(store.contacts).filter(c => c.id && !c.id.includes('@g.us'));
        logger.info(`נמצאו ${contacts.length} אנשי קשר לסנכרון`);
        await this.updateContacts(contacts);
        return true;
      } else {
        logger.warn('store.contacts לא זמין');
        
        // ננסה גישות אחרות אפשריות
        if (this.sock.getContacts) {
          const contacts = await this.sock.getContacts();
          logger.info(`נמצאו ${contacts.length} אנשי קשר דרך getContacts`);
          await this.updateContacts(contacts);
          return true;
        }
        
        return false;
      }
    } catch (err) {
      logger.error('שגיאה בסנכרון אנשי קשר:', err);
      return false;
    }
  }


// הפונקציה המעודכנת
  async updateContacts(contacts) {
    if (!contacts?.length) return;

    for (const c of contacts) {
      if (c.id && !c.id.includes('@g.us')) {
        const phone = c.id.split('@')[0];
        const name = c.notify || c.name || phone;
        await Contact.findOneAndUpdate(
          { phoneNumber: phone },
          {
            name,
            phoneNumber: phone,
            isActive: true,        // ← מסמן כאקטיבי
            lastChatDate: new Date()
          },
          { upsert: true, new: true }
        );
      }
    }
    logger.info(`👥 עודכנו ${contacts.length} אנשי קשר`);
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
        { lastChatDate: new Date() },
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

module.exports = new WhatsAppService();