// config/config.js
const path = require('path');

const config = {
  app: {
    name: 'WhatsApp Bot',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  },

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-bot',
    options: {
      // במנגוס 6+ מספיק שני הפלאגים האלה
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  whatsapp: {
    sessionTimeout: parseInt(process.env.WHATSAPP_SESSION_TIMEOUT, 10) || 60,
    // שמור בתיקייה config/auth_info כדי להתיישר עם whatsappService
    authPath: path.join(__dirname, 'auth_info'),
    bulkSending: {
      batchSize: parseInt(process.env.WHATSAPP_BATCH_SIZE, 10) || 10,
      delayBetweenBatches:
        parseInt(process.env.WHATSAPP_BATCH_DELAY, 10) || 300_000, // 5 min
      delayBetweenMessages:
        parseInt(process.env.WHATSAPP_MESSAGE_DELAY, 10) || 1_000  // 1 s
    }
  },

  files: {
    uploadsDir: path.join(__dirname, '../public/uploads'),
    templatesDir: path.join(__dirname, '../public/templates'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,
    allowedFileTypes: {
      image: ['.jpg', '.jpeg', '.png', '.gif'],
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
      media: ['.mp4', '.mp3']
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: path.join(__dirname, '../logs')
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'whatsapp-bot-secret-key',
    jwtExpiration: parseInt(process.env.JWT_EXPIRATION, 10) || 86_400,
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['*']
  }
};

module.exports = config;
