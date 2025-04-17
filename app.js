// app.js - הקובץ הראשי של האפליקציה
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const database = require('./database/database');
const whatsappService = require('./services/whatsappService');

// יצירת יומן רישום
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const accessLogStream = fs.createWriteStream(path.join(logDir, 'bot.log'), { flags: 'a' });

// אתחול האפליקציה
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: accessLogStream }));
app.use(express.static(path.join(__dirname, 'public')));

// התחברות למסד נתונים
database.connect()
  .then(() => {
    console.log('התחבר בהצלחה למסד הנתונים');
  })
  .catch(err => {
    console.error('שגיאה בחיבור למסד הנתונים:', err);
  });

// הגדרת נתיבים לממשק API
const indexRoutes = require('./routes/index');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const templateRoutes = require('./routes/templateRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// הוספת כל הנתיבים
app.use('/api', indexRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/categories', categoryRoutes);

// נתיב ברירת מחדל להחזרת הממשק המשתמש
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'שגיאת שרת',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// הגדרת פורט
const PORT = process.env.PORT || 3000;

// הפעלת השרת ללא אתחול אוטומטי של WhatsApp
app.listen(PORT, () => {
  console.log(`השרת פועל בפורט ${PORT}`);
  console.log('הערה: החיבור לWhatsApp לא יתבצע אוטומטית. יש ללחוץ על "התחבר לוואטסאפ" בממשק כדי להתחיל את תהליך החיבור.');
});

// טיפול בסגירת השרת
process.on('SIGINT', async () => {
  console.log('סוגר את החיבור לוואטסאפ...');
  await whatsappService.disconnect();
  console.log('סוגר את החיבור למסד הנתונים...');
  await database.disconnect();
  console.log('היישום נסגר בהצלחה');
  process.exit(0);
});

module.exports = app;