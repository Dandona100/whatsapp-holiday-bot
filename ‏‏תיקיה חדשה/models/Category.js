// models/Category.js - מודל קטגוריות
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * סכמה של קטגוריה
 */
const CategorySchema = new Schema({
  // שם הקטגוריה
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  
  // תיאור הקטגוריה
  description: {
    type: String,
    trim: true
  },
  
  // צבע לתצוגה בממשק (קוד צבע)
  color: {
    type: String,
    default: '#3498db', // כחול כברירת מחדל
    trim: true
  },
  
  // סדר מיון (לתצוגה בממשק)
  order: {
    type: Number,
    default: 0
  },
  
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
  
  // קטגוריית אב (למבנה היררכי - אופציונלי)
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  
  // האם הקטגוריה פעילה
  isActive: {
    type: Boolean,
    default: true
  }
});

/**
 * הוספת אינדקסים לביצועים טובים יותר
 */
CategorySchema.index({ name: 1 });
CategorySchema.index({ order: 1 });
CategorySchema.index({ parent: 1 });

/**
 * וירטואל לספירת אנשי קשר בקטגוריה
 * שים לב: דורש פופולציה נפרדת
 */
CategorySchema.virtual('contactCount', {
  ref: 'Contact',
  localField: '_id',
  foreignField: 'categories',
  count: true
});

/**
 * עדכון שדה updatedAt לפני שמירה
 */
CategorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * המרה לJSON עם כללת שדות וירטואליים
 */
CategorySchema.set('toJSON', { virtuals: true });
CategorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Category', CategorySchema);