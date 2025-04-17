/**
 * public/js/app.js - קוד JavaScript בסיסי לממשק המשתמש
 * 
 * קובץ זה מכיל את הקוד הבסיסי לניהול ממשק המשתמש, כולל:
 * - סטטוס חיבור לוואטסאפ
 * - יצירת קוד QR והצגתו
 * - טעינת תוכן דינמי בהתאם לנתיב
 */

// מחלקה לניהול API
class ApiService {
  /**
   * קבלת סטטוס חיבור וואטסאפ
   */
  static async getConnectionStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('שגיאה בקבלת סטטוס חיבור:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * קבלת קוד QR לחיבור
   */
  static async getQRCode() {
    try {
      const response = await fetch('/api/qrcode');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('שגיאה בקבלת קוד QR:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * ביצוע חיבור מחדש
   */
  static async reconnect() {
    try {
      const response = await fetch('/api/reconnect', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('שגיאה בחיבור מחדש:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * ניתוק מוואטסאפ
   */
  static async logout() {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('שגיאה בניתוק:', error);
      return { success: false, error: error.message };
    }
  }
}

// הגדרת בקרים (Controllers) - מימוש בסיסי כחלק מה-app.js
class ControllerBase {
  /**
   * אתחול בסיסי לבקר
   * @param {HTMLElement} container - מיכל תוכן
   */
  static initialize(container) {
    console.log(`אתחול בקר ${this.name}`);
    this.container = container;
    this.render();
  }
  
  /**
   * הצגת תוכן בסיסי (לדריסה בבקרים ספציפיים)
   */
  static render() {
    console.log(`הצגת תוכן עבור ${this.name}`);
  }
}

// בקר אנשי קשר (מוגדר כגיבוי למקרה שהקובץ החיצוני לא נטען)
class ContactController extends ControllerBase {
  static name = 'contacts';
  static title = 'אנשי קשר';
}

// בקר קטגוריות (מוגדר כגיבוי למקרה שהקובץ החיצוני לא נטען)
class CategoryController extends ControllerBase {
  static name = 'categories';
  static title = 'קטגוריות';
}

// בקר תבניות (מוגדר כגיבוי למקרה שהקובץ החיצוני לא נטען)
class TemplateController extends ControllerBase {
  static name = 'templates';
  static title = 'תבניות הודעה';
}

// בקר הודעות (מוגדר כגיבוי למקרה שהקובץ החיצוני לא נטען)
class MessageController extends ControllerBase {
  static name = 'messages';
  static title = 'שליחת הודעות';
}

// מנהל הבקרים
class ControllersManager {
  static controllers = {
    contacts: null,
    categories: null,
    templates: null,
    messages: null
  };
  
  static getController(name) {
    return this.controllers[name] || null;
  }
  
  static async loadControllers() {
    // יצירת אובייקט גלובלי שהקבצים החיצוניים יוכלו להשתמש בו
    window.ControllersManager = this;
    
    try {
      console.log('מאתר בקרים שנטענו על ידי HTML...');
      
      // המתנה קצרה לוודא שכל הבקרים שנטענו ב-HTML יהיו זמינים
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // איתור בקרים גלובליים שנטענו כבר מקבצים חיצוניים
      if (window.ContactController) {
        this.controllers.contacts = window.ContactController;
        console.log('נמצא בקר contacts חיצוני');
      } else {
        console.warn('משתמש בבקר contacts מקומי');
        this.controllers.contacts = ContactController;
      }
      
      if (window.CategoryController) {
        this.controllers.categories = window.CategoryController;
        console.log('נמצא בקר categories חיצוני');
      } else {
        console.warn('משתמש בבקר categories מקומי');
        this.controllers.categories = CategoryController;
      }
      
      if (window.TemplateController) {
        this.controllers.templates = window.TemplateController;
        console.log('נמצא בקר templates חיצוני');
      } else {
        console.warn('משתמש בבקר templates מקומי');
        this.controllers.templates = TemplateController;
      }
      
      if (window.MessageController) {
        this.controllers.messages = window.MessageController;
        console.log('נמצא בקר messages חיצוני');
      } else {
        console.warn('משתמש בבקר messages מקומי');
        this.controllers.messages = MessageController;
      }
      
      console.log('בקרים נטענו בהצלחה:', Object.keys(this.controllers));
      return Promise.resolve();
    } catch (error) {
      console.error('שגיאה בטעינת הבקרים:', error);
      
      // במקרה של שגיאה, השתמש בבקרים המשובצים כגיבוי
      this.controllers = {
        contacts: ContactController,
        categories: CategoryController, 
        templates: TemplateController,
        messages: MessageController
      };
      
      return Promise.resolve();
    }
  }
}

// מחלקה לניהול ממשק המשתמש
class AppUI {
  constructor() {
    this.initialize();
  }
  
  /**
   * אתחול פונקציונליות ממשק המשתמש
   */
  async initialize() {
    // אלמנטים
    this.connectionStatus = document.getElementById('connection-status');
    this.connectBtn = document.getElementById('connect-btn');
    this.qrContainer = document.getElementById('qr-container');
    this.qrCode = document.getElementById('qr-code');
    
    // טעינת בקרים
    await ControllersManager.loadControllers();
    
    // הוספת מאזיני אירועים
    this.addEventListeners();
    
    // בדיקת סטטוס חיבור ראשוני
    await this.updateConnectionStatus();
    
    // הפעלת הניווט הראשוני - וודא טעינה גם בפעם הראשונה
    this.handleNavigation();
    
    // בדיקת סטטוס כל 30 שניות
    setInterval(() => this.updateConnectionStatus(), 30000);
  }
  
  /**
   * הוספת מאזיני אירועים
   */
  addEventListeners() {
    if (this.connectBtn) {
      this.connectBtn.addEventListener('click', () => this.handleConnect());
    }
    
    // מאזיני ניווט ראוטר
    window.addEventListener('hashchange', () => this.handleNavigation());
    window.addEventListener('DOMContentLoaded', () => this.handleNavigation());
  }
  
  /**
   * עדכון סטטוס חיבור
   */
  async updateConnectionStatus() {
    try {
      const response = await ApiService.getConnectionStatus();
      
      if (response.isConnected) {
        this.setConnected(response);
      } else {
        this.setDisconnected();
      }
    } catch (error) {
      console.error('שגיאה בעדכון סטטוס חיבור:', error);
      this.setDisconnected();
    }
  }
  
  /**
   * עדכון ממשק למצב מחובר
   */
  setConnected(data) {
    if (this.connectionStatus) {
      this.connectionStatus.innerHTML = `<i class="fas fa-check-circle me-1"></i> מחובר (${data.phoneNumber})`;
      this.connectionStatus.classList.remove('bg-secondary', 'bg-danger');
      this.connectionStatus.classList.add('bg-success');
    }
    
    if (this.connectBtn) {
      this.connectBtn.innerHTML = '<i class="fas fa-sign-out-alt me-2"></i> התנתק';
      this.connectBtn.classList.remove('btn-success');
      this.connectBtn.classList.add('btn-outline-danger');
      
      // שינוי פעולת הכפתור לניתוק
      this.connectBtn.removeEventListener('click', this.handleConnect);
      this.connectBtn.addEventListener('click', () => this.handleDisconnect());
    }
    
    if (this.qrContainer) {
      this.qrContainer.classList.add('d-none');
    }
    
    // הצגת הודעת הצלחה
    const connectionSection = document.getElementById('connection-section');
    if (connectionSection) {
      const alertElement = connectionSection.querySelector('.alert');
      if (alertElement) {
        alertElement.classList.remove('alert-info');
        alertElement.classList.add('alert-success');
        alertElement.innerHTML = `<p><strong>מחובר בהצלחה!</strong> המערכת מחוברת למספר ${data.phoneNumber}</p>`;
      }
    }
  }
  
  /**
   * עדכון ממשק למצב מנותק
   */
  setDisconnected() {
    if (this.connectionStatus) {
      this.connectionStatus.innerHTML = '<i class="fas fa-times-circle me-1"></i> לא מחובר';
      this.connectionStatus.classList.remove('bg-success');
      this.connectionStatus.classList.add('bg-secondary');
    }
    
    if (this.connectBtn) {
      this.connectBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i> התחבר לוואטסאפ';
      this.connectBtn.classList.remove('btn-outline-danger');
      this.connectBtn.classList.add('btn-success');
      
      // שינוי פעולת הכפתור לחיבור
      this.connectBtn.removeEventListener('click', this.handleDisconnect);
      this.connectBtn.addEventListener('click', () => this.handleConnect());
    }
    
    // עדכון הודעת חיבור
    const connectionSection = document.getElementById('connection-section');
    if (connectionSection) {
      const alertElement = connectionSection.querySelector('.alert');
      if (alertElement) {
        alertElement.classList.remove('alert-success');
        alertElement.classList.add('alert-info');
        alertElement.innerHTML = '<p>יש להתחבר לוואטסאפ כדי להתחיל להשתמש במערכת.</p>';
      }
    }
  }
  
  /**
   * טיפול בלחיצה על כפתור החיבור
   */
  async handleConnect() {
    try {
      // שינוי כיתוב כפתור
      if (this.connectBtn) {
        this.connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> מתחבר...';
        this.connectBtn.disabled = true;
      }
      
      // בקשה לקוד QR
      const response = await ApiService.getQRCode();
      
      if (response && response.success && response.qrCode) {
        // תיקון לטיפול בקוד QR - בדוק אם הוא כבר מכיל את ה-prefix
        if (this.qrContainer && this.qrCode) {
          this.qrCode.src = response.qrCode.startsWith('data:') ? 
            response.qrCode : `data:image/png;base64,${response.qrCode}`;
          this.qrContainer.classList.remove('d-none');
        }
        
        // התחלת בדיקת סטטוס חיבור כל 5 שניות
        const checkInterval = setInterval(async () => {
          const statusResponse = await ApiService.getConnectionStatus();
          if (statusResponse && statusResponse.isConnected) {
            clearInterval(checkInterval);
            this.setConnected(statusResponse);
          }
        }, 5000);
        
        // הפסקת בדיקה אחרי דקה (תוקף ה-QR)
        setTimeout(() => {
          clearInterval(checkInterval);
          
          // אם עדיין לא מחובר, אפס את המצב
          if (this.connectBtn && this.connectBtn.disabled) {
            this.connectBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i> התחבר לוואטסאפ';
            this.connectBtn.disabled = false;
            
            if (this.qrContainer) {
              this.qrContainer.classList.add('d-none');
            }
          }
        }, 60000); // דקה אחת (בהתאם לטקסט בממשק)
      } else {
        alert('שגיאה בקבלת קוד QR: ' + (response && response.message ? response.message : 'נא לנסות שוב'));
        
        if (this.connectBtn) {
          this.connectBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i> התחבר לוואטסאפ';
          this.connectBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error('שגיאה בחיבור:', error);
      alert('שגיאה בתהליך החיבור: ' + error.message);
      
      if (this.connectBtn) {
        this.connectBtn.innerHTML = '<i class="fab fa-whatsapp me-2"></i> התחבר לוואטסאפ';
        this.connectBtn.disabled = false;
      }
    }
  }
  
  /**
   * טיפול בלחיצה על כפתור הניתוק
   */
  async handleDisconnect() {
    try {
      if (!confirm('האם אתה בטוח שברצונך להתנתק מוואטסאפ?')) {
        return;
      }
      
      // שינוי כיתוב כפתור
      if (this.connectBtn) {
        this.connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> מתנתק...';
        this.connectBtn.disabled = true;
      }
      
      // בקשת ניתוק
      const response = await ApiService.logout();
      
      if (response && response.success) {
        this.setDisconnected();
        
        if (this.connectBtn) {
          this.connectBtn.disabled = false;
        }
      } else {
        alert('שגיאה בניתוק: ' + (response && response.message ? response.message : 'נא לנסות שוב'));
        
        if (this.connectBtn) {
          this.connectBtn.innerHTML = '<i class="fas fa-sign-out-alt me-2"></i> התנתק';
          this.connectBtn.disabled = false;
        }
      }
    } catch (error) {
      console.error('שגיאה בניתוק:', error);
      alert('שגיאה בתהליך הניתוק: ' + error.message);
      
      if (this.connectBtn) {
        this.connectBtn.innerHTML = '<i class="fas fa-sign-out-alt me-2"></i> התנתק';
        this.connectBtn.disabled = false;
      }
    }
  }
  
  /**
   * טיפול בניווט בין עמודים
   */
  handleNavigation() {
    // 1 – קביעת הנתיב: hash קודם, אחרת pathname
    let route = '/';
    if (window.location.hash) {
      route = window.location.hash.slice(1);     // "#/contacts" → "/contacts"
    } else if (window.location.pathname && window.location.pathname !== '/') {
      route = window.location.pathname;          // "/contacts"
    }
  
    console.log('ניווט נוכחי:', route);
  
    // 2 – סימון פריט תפריט פעיל ווידוא שכל הקישורים פעילים
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const isActive = href.endsWith(route) || 
                      (route === '/' && href === '#') ||
                      (href.endsWith('/contacts') && route === '/contacts');
      
      // סימון הקישור הפעיל
      link.classList.toggle('active', isActive);
      
      // וידוא שכל הקישורים פעילים
      link.classList.remove('disabled');
      link.setAttribute('aria-disabled', 'false');
      
      // בדיקה אם החיבור פעיל (עבור קישורים שדורשים חיבור)
      if (href.includes('/contacts') || href.includes('/messages')) {
        // אפשר לבדוק כאן אם החיבור פעיל ולהוסיף סטייל מתאים
        // למשל אם החיבור לא פעיל, להוסיף אייקון או טיפ
        if (this.isConnected) {
          link.classList.add('connection-active');
        } else {
          link.classList.remove('connection-active');
        }
      }
    });
  
    // 3 - בדיקת אלמנטים אפשריים להחלפת תוכן
    console.log('בודק אלמנטים להחלפת תוכן');
    
    // נסה למצוא את האלמנט הראשי
    const mainContent = document.querySelector('main');
    
    if (!mainContent) {
      console.error('לא נמצא אלמנט main להחלפת תוכן');
      return;
    }
    
    console.log('נמצא אלמנט להחלפת תוכן:', mainContent);
    console.log('ניווט לנתיב:', route);
  
    // 4 - טעינת תוכן לפי נתיב באמצעות הבקרים המתאימים
    switch (route) {
      case '/contacts':
        this.loadPageWithController('contacts', mainContent);
        break;
      case '/categories':
        this.loadPageWithController('categories', mainContent);
        break;
      case '/templates':
        this.loadPageWithController('templates', mainContent);
        break;
      case '/messages':
        this.loadPageWithController('messages', mainContent);
        break;
      default:
        // אם לא זוהה נתיב ספציפי, טען את דף הבית
        this.loadHomePage(mainContent);
        break;
    }
    
    // 5 - שמירת הנתיב הנוכחי למקרה שנצטרך לחזור אליו
    this.currentRoute = route;
  }

  /**
   * טעינת עמוד באמצעות בקר
   */
  loadPageWithController(controllerName, container) {
    const controller = ControllersManager.getController(controllerName);
    
    if (!controller) {
      console.error(`בקר לא נמצא: ${controllerName}`);
      container.innerHTML = `<div class="alert alert-danger">שגיאה: הבקר ${controllerName} לא נמצא</div>`;
      return;
    }
    
    try {
      // בדיקה האם יש גישה לבקר
      console.log(`טוען עמוד באמצעות בקר ${controllerName}`);
      
      // עמוד ראשוני עם טעינה
      container.innerHTML = `
        <div class="container my-4">
          <div class="row">
            <div class="col-12">
              <div id="${controllerName}-content">
                <p class="text-center"><i class="fas fa-spinner fa-spin"></i> טוען תוכן...</p>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // הפעלת הבקר
      controller.initialize(container);
    } catch (error) {
      console.error(`שגיאה בטעינת עמוד ${controllerName}:`, error);
      container.innerHTML = `<div class="alert alert-danger">שגיאה בטעינת עמוד ${controllerName}: ${error.message}</div>`;
    }
  }

  /**
   * טעינת דף הבית
   */
  loadHomePage(container) {
    // אין צורך לשנות את התוכן כי הוא כבר קיים בדף ה-HTML
    // רק צריך לוודא שכל הכפתורים והממשק אקטיביים
    
    // התקנת מאזיני אירועים לכפתור החיבור
    this.connectBtn = document.getElementById('connect-btn');
    this.qrContainer = document.getElementById('qr-container');
    this.qrCode = document.getElementById('qr-code');
    
    if (this.connectBtn) {
      this.connectBtn.addEventListener('click', () => this.handleConnect());
    }
    
    // עדכון סטטוס החיבור
    this.updateConnectionStatus();
  }
}

// אתחול האפליקציה כאשר הדף נטען
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppUI();
});