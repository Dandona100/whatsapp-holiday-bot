// tests/whatsappService.test.js - בדיקות יחידה לשירות וואטסאפ
const whatsappService = require('../services/whatsappService');

// מוק לספריית Baileys
jest.mock('@adiwajshing/baileys', () => {
  return {
    WAConnection: jest.fn().mockImplementation(() => {
      return {
        loadAuthInfo: jest.fn(),
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(true),
        base64EncodedAuthInfo: jest.fn().mockReturnValue({}),
        close: jest.fn().mockResolvedValue(true),
        sendMessage: jest.fn().mockResolvedValue(true),
        user: {
          jid: '972123456789@s.whatsapp.net',
          name: 'Test User'
        },
        contacts: {
          '972123456789@s.whatsapp.net': {
            name: 'Test Contact',
            notify: 'Test'
          }
        }
      };
    }),
    MessageType: {
      text: 'text',
      image: 'image',
      video: 'video',
      document: 'document'
    },
    Presence: {
      available: 'available'
    },
    Mimetype: {
      jpeg: 'image/jpeg',
      mp4: 'video/mp4',
      pdf: 'application/pdf'
    }
  };
});

// מוק לפונקציות קובץ
jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockReturnValue(true),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue(Buffer.from('test'))
  };
});

// מוק למודל Contact
jest.mock('../models/Contact', () => {
  return {
    findOneAndUpdate: jest.fn().mockResolvedValue({
      name: 'Test Contact',
      phoneNumber: '972123456789',
      lastChatDate: new Date()
    })
  };
});

describe('WhatsApp Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('initialize should connect to WhatsApp', async () => {
    await expect(whatsappService.initialize()).resolves.toBe(true);
    expect(whatsappService.isConnected).toBe(true);
  });
  
  test('disconnect should close the connection', async () => {
    whatsappService.isConnected = true;
    await whatsappService.disconnect();
    expect(whatsappService.isConnected).toBe(false);
  });
  
  test('sendTextMessage should send a message to the recipient', async () => {
    whatsappService.isConnected = true;
    const recipient = '972123456789';
    const text = 'Hello, world!';
    
    await expect(whatsappService.sendTextMessage(recipient, text)).resolves.toBe(true);
  });
  
  test('sendTextMessage should throw an error if not connected', async () => {
    whatsappService.isConnected = false;
    const recipient = '972123456789';
    const text = 'Hello, world!';
    
    await expect(whatsappService.sendTextMessage(recipient, text)).rejects.toThrow('אין חיבור לוואטסאפ');
  });
  
  test('sendBulkMessages should send messages to multiple recipients', async () => {
    whatsappService.isConnected = true;
    const recipients = ['972123456789', '972987654321'];
    const text = 'Bulk message test';
    
    // מוחקים את ההשהיה בין הודעות לבדיקות
    const originalDelay = setTimeout;
    global.setTimeout = jest.fn((callback) => callback());
    
    await expect(whatsappService.sendBulkMessages(recipients, text, 0)).resolves.toBe(true);
    
    // שחזור פונקציית ההשהיה המקורית
    global.setTimeout = originalDelay;
  });
  
  test('getConnectionStatus should return current status', () => {
    whatsappService.isConnected = true;
    
    const status = whatsappService.getConnectionStatus();
    
    expect(status).toEqual({
      isConnected: true,
      phoneNumber: '972123456789',
      name: 'Test User'
    });
  });
  
  test('updateContactList should update contacts in the database', async () => {
    whatsappService.isConnected = true;
    
    await whatsappService.updateContactList();
    
    // בדיקה שהפונקציה לעדכון איש קשר נקראה
    const Contact = require('../models/Contact');
    expect(Contact.findOneAndUpdate).toHaveBeenCalled();
  });
});