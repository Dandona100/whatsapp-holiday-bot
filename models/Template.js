// models/Template.js - מודל תבניות הודעה
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * סכמה של תבנית הודעה
 */
const TemplateSchema = new Schema({
  // שם התבנית
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  
  // תוכן התבנית
  content: {
    type: String,
    required: true
  },
  
  // סוג התבנית (טקסט, תמונה, וכו')
  type: {
    type: String,
    enum: ['text', 'canva', 'media'],
    default: 'text'
  },
  
  // קישור למדיה (אם יש)
  mediaUrl: {
    type: String,
    trim: true
  },
  
  // JSON של מידע נוסף (עבור תבניות מורכבות כמו Canva)
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // תגיות בשימוש בתבנית - לצורך תיעוד וחיפוש
  tags: [{
    type: String,
    trim: true
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
  
  // האם התבנית פעילה
  isActive: {
    type: Boolean,
    default: true
  },
  
  // מי יצר את התבנית (אם רלוונטי)
  createdBy: {
    type: String,
    trim: true
  }
});

/**
 * הוספת אינדקסים לביצועים טובים יותר
 */
TemplateSchema.index({ name: 1 });
TemplateSchema.index({ type: 1 });
TemplateSchema.index({ tags: 1 });

/**
 * עדכון שדה updatedAt לפני שמירה
 */
TemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // זיהוי אוטומטי של תגיות בתוכן (מילים המתחילות ב-<)
  if (this.content) {
    const tagRegex = /<([^>]+)>/g;
    const foundTags = [];
    let match;
    
    while ((match = tagRegex.exec(this.content)) !== null) {
      foundTags.push(match[1]);
    }
    
    // הסרת כפילויות ועדכון רשימת התגיות
    if (foundTags.length > 0) {
      this.tags = [...new Set(foundTags)];
    }
  }
  
  next();
});

/**
 * מתודה לשילוב תגיות עם ערכים במשתמש
 * @param {Object} values - אובייקט עם ערכים להחלפה בתבנית
 * @returns {String} - התוכן עם הערכים המוחלפים
 */
TemplateSchema.methods.applyValues = function(values = {}) {
  let filledContent = this.content;
  
  // החלפת כל תג בערך המתאים
  for (const [key, value] of Object.entries(values)) {
    const tagRegex = new RegExp(`<${key}>`, 'g');
    filledContent = filledContent.replace(tagRegex, value || `<${key}>`);
  }
  
  return filledContent;
};

/**
 * המרה לJSON עם כללת שדות נוספים
 */
TemplateSchema.set('toJSON', { getters: true });
TemplateSchema.set('toObject', { getters: true });

module.exports = mongoose.model('Template', TemplateSchema);