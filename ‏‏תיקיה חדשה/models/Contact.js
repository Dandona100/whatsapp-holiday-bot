// models/Contact.js - מודל אנשי קשר
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * סכמה של איש קשר
 */
const ContactSchema = new Schema({
  // שם איש הקשר
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // מספר טלפון (ייחודי)
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // כינוי מותאם אישית (אופציונלי)
  nickname: {
    type: String,
    trim: true
  },
  
  // תואר מיוחד (למשל "לקוח VIP", "ספק")
  title: {
    type: String,
    trim: true
  },
  
  // תאריך ושעת ההתכתבות האחרונה
  lastChatDate: {
    type: Date,
    default: null
  },
  
  // רשימת קטגוריות שאליהן משויך איש הקשר (מערך מזהים)
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],
  
  // תאריך יצירה
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // תאריך עדכון אחרון
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // פעיל או לא פעיל
  isActive: {
    type: Boolean,
    default: true
  },
  
  // הערות נוספות
  notes: {
    type: String,
    trim: true
  }
});

/**
 * הוספת אינדקסים לביצועים טובים יותר
 */
ContactSchema.index({ phoneNumber: 1 });
ContactSchema.index({ lastChatDate: -1 });
ContactSchema.index({ categories: 1 });

/**
 * ווירטואל פילד לחישוב הזמן שעבר מההתכתבות האחרונה
 */
ContactSchema.virtual('timeSinceLastChat').get(function() {
  if (!this.lastChatDate) return null;
  
  const now = new Date();
  const lastChat = new Date(this.lastChatDate);
  const diffMs = now - lastChat;
  
  // החזרת ההפרש בימים
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
});

/**
 * עדכון שדה updatedAt לפני שמירה
 */
ContactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * המרה לJSON עם כללת שדות וירטואליים
 */
ContactSchema.set('toJSON', { virtuals: true });
ContactSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Contact', ContactSchema);