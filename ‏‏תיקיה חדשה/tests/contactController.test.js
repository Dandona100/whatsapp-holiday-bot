// tests/contactController.test.js - בדיקות יחידה לבקר אנשי קשר
const contactController = require('../controllers/contactController');
const Contact = require('../models/Contact');
const Category = require('../models/Category');

// מוק למודל Contact
jest.mock('../models/Contact', () => {
  return {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    prototype: {
      save: jest.fn()
    }
  };
});

// מוק למודל Category
jest.mock('../models/Category', () => {
  return {
    findById: jest.fn()
  };
});

// מוק ללוגר
jest.mock('../helpers/logger', () => {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  };
});

describe('Contact Controller', () => {
  let req, res;
  
  beforeEach(() => {
    // איפוס הבקשה והתשובה עבור כל בדיקה
    req = {
      params: {},
      query: {},
      body: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    jest.clearAllMocks();
  });
  
  describe('getAllContacts', () => {
    test('should return all contacts with pagination', async () => {
      // הגדרת הבקשה
      req.query = {
        page: 1,
        limit: 10
      };
      
      // הגדרת תגובות מוקים
      const mockContacts = [
        { name: 'Contact 1', phoneNumber: '1234567890' },
        { name: 'Contact 2', phoneNumber: '0987654321' }
      ];
      
      Contact.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockContacts)
      });
      
      Contact.countDocuments.mockResolvedValue(2);
      
      // קריאה לפונקציה
      await contactController.getAllContacts(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockContacts,
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    });
    
    test('should handle errors properly', async () => {
      // גרימת שגיאה מכוונת
      Contact.find.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // קריאה לפונקציה
      await contactController.getAllContacts(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'שגיאה בקבלת אנשי קשר',
        error: 'Database error'
      });
    });
  });
  
  describe('getContactById', () => {
    test('should return a contact by id', async () => {
      // הגדרת הבקשה
      req.params = { id: '123' };
      
      // הגדרת תגובות מוקים
      const mockContact = {
        _id: '123',
        name: 'Test Contact',
        phoneNumber: '1234567890'
      };
      
      Contact.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockContact)
      });
      
      // קריאה לפונקציה
      await contactController.getContactById(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockContact
      });
    });
    
    test('should return 404 if contact not found', async () => {
      // הגדרת הבקשה
      req.params = { id: 'nonexistent' };
      
      // הגדרת תגובות מוקים
      Contact.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });
      
      // קריאה לפונקציה
      await contactController.getContactById(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'איש קשר לא נמצא'
      });
    });
  });
  
  describe('createContact', () => {
    test('should create a new contact', async () => {
      // הגדרת הבקשה
      req.body = {
        name: 'New Contact',
        phoneNumber: '1234567890',
        nickname: 'Nick',
        title: 'VIP'
      };
      
      // הגדרת תגובות מוקים
      Contact.findOne.mockResolvedValue(null);
      
      const mockContact = {
        ...req.body,
        _id: '123',
        save: jest.fn().mockResolvedValue(true)
      };
      
      // מוק לקונסטרקטור של Contact
      Contact.mockImplementation(() => mockContact);
      
      // קריאה לפונקציה
      await contactController.createContact(req, res);
      
      // בדיקות
      expect(Contact.findOne).toHaveBeenCalledWith({ phoneNumber: '1234567890' });
      expect(mockContact.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'איש קשר נוצר בהצלחה',
        data: mockContact
      });
    });
    
    test('should return 400 if contact already exists', async () => {
      // הגדרת הבקשה
      req.body = {
        name: 'Existing Contact',
        phoneNumber: '1234567890'
      };
      
      // הגדרת תגובות מוקים
      Contact.findOne.mockResolvedValue({ 
        _id: '123', 
        name: 'Existing Contact',
        phoneNumber: '1234567890'
      });
      
      // קריאה לפונקציה
      await contactController.createContact(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'איש קשר עם מספר טלפון זה כבר קיים'
      });
    });
  });
  
  describe('updateContact', () => {
    test('should update an existing contact', async () => {
      // הגדרת הבקשה
      req.params = { id: '123' };
      req.body = {
        name: 'Updated Name',
        nickname: 'New Nick'
      };
      
      // הגדרת תגובות מוקים
      const mockContact = {
        _id: '123',
        name: 'Old Name',
        phoneNumber: '1234567890',
        nickname: 'Old Nick',
        save: jest.fn().mockResolvedValue(true)
      };
      
      Contact.findById.mockResolvedValue(mockContact);
      
      // קריאה לפונקציה
      await contactController.updateContact(req, res);
      
      // בדיקות
      expect(Contact.findById).toHaveBeenCalledWith('123');
      expect(mockContact.name).toBe('Updated Name');
      expect(mockContact.nickname).toBe('New Nick');
      expect(mockContact.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'איש קשר עודכן בהצלחה',
        data: mockContact
      });
    });
    
    test('should return 404 if contact not found', async () => {
      // הגדרת הבקשה
      req.params = { id: 'nonexistent' };
      req.body = { name: 'Updated Name' };
      
      // הגדרת תגובות מוקים
      Contact.findById.mockResolvedValue(null);
      
      // קריאה לפונקציה
      await contactController.updateContact(req, res);
      
      // בדיקות
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'איש קשר לא נמצא'
      });
    });
  });
  
  describe('deleteContact', () => {
    test('should mark a contact as inactive', async () => {
      // הגדרת הבקשה
      req.params = { id: '123' };
      
      // הגדרת תגובות מוקים
      const mockContact = {
        _id: '123',
        name: 'Contact to Delete',
        isActive: true,
        save: jest.fn().mockResolvedValue(true)
      };
      
      Contact.findById.mockResolvedValue(mockContact);
      
      // קריאה לפונקציה
      await contactController.deleteContact(req, res);
      
      // בדיקות
      expect(Contact.findById).toHaveBeenCalledWith('123');
      expect(mockContact.isActive).toBe(false);
      expect(mockContact.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'איש קשר נמחק בהצלחה'
      });
    });
  });
});