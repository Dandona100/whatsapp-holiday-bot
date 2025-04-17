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

// מחלקה לניהול ממשק המשתמש
class AppUI {
  constructor() {
    this.initialize();
  }
  
  /**
   * אתחול פונקציונליות ממשק המשתמש
   */
  initialize() {
    // אלמנטים
    this.connectionStatus = document.getElementById('connection-status');
    this.connectBtn = document.getElementById('connect-btn');
    this.qrContainer = document.getElementById('qr-container');
    this.qrCode = document.getElementById('qr-code');
    
    // הוספת מאזיני אירועים
    this.addEventListeners();
    
    // בדיקת סטטוס חיבור ראשוני
    this.updateConnectionStatus();
    
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
      this.connectBtn.removeEventListener('click', () => this.handleConnect());
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
      this.connectBtn.removeEventListener('click', () => this.handleDisconnect());
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
        }, 60000);
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
    // יישום בסיסי של ראוטר דף יחיד
    const hash = window.location.hash || '#/';
    const route = hash.slice(1);
    
    // סימון התפריט הפעיל
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('href') === hash) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    
    // בעתיד יהיה כאן קוד לטעינת התוכן לפי הנתיב
    console.log('ניווט לנתיב:', route);
  }
}

// אתחול האפליקציה כאשר הדף נטען
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppUI();
});