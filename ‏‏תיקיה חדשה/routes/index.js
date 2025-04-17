// routes/index.js - ניתוב ראשי למערכת
const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

// נתיב לקבלת סטטוס חיבור
router.get('/status', async (req, res) => {
  try {
    const status = whatsappService.getConnectionStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// נתיב לקבלת קוד QR
router.get('/qrcode', async (req, res) => {
  try {
    const qrCode = await whatsappService.getQRCode();
    
    if (!qrCode) {
      return res.status(404).json({ success: false, message: "קוד QR אינו זמין כרגע. יתכן שהמכשיר כבר מחובר או שיש לנסות שוב מאוחר יותר." });
    }
    
    res.json({ success: true, qrCode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// נתיב להתחברות מחדש
router.post('/reconnect', async (req, res) => {
  try {
    await whatsappService.disconnect();
    await whatsappService.initialize();
    
    res.json({ success: true, message: "החיבור מחדש החל. יש לבדוק סטטוס לקבלת מידע עדכני." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// נתיב לניתוק
router.post('/logout', async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({ success: true, message: "נותק בהצלחה מוואטסאפ" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;