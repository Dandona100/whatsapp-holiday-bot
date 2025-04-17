/**
 * public/js/controllers/contactController.js
 * בקר לניהול אנשי קשר
 */

(() => {
    // ודא שהמחלקה הבסיסית זמינה
    if (typeof ControllerBase === 'undefined') {
      console.error('ControllerBase לא מוגדר - משתמש במחלקה בסיסית פשוטה');
      
      // יצירת מחלקה בסיסית אם לא קיימת
      class TempControllerBase {
        static initialize(container) {
          console.log(`אתחול בקר ${this.name}`);
          this.container = container;
          this.render();
        }
        
        static render() {
          console.log(`הצגת תוכן עבור ${this.name}`);
        }
      }
      
      window.ControllerBase = TempControllerBase;
    }
  
    class ContactController extends ControllerBase {
      static name = 'contacts';
      static title = 'אנשי קשר';
  
      /* ציור ראשוני של העמוד */
      static render() {
        if (!this.container) return;
  
        this.container.innerHTML = `
          <div class="container my-4">
            <h2 class="mb-3"><i class="fas fa-users me-2 text-primary"></i> ${this.title}</h2>
            <div class="d-flex mb-3">
              <input id="searchContact" type="text" class="form-control me-2" placeholder="חיפוש אנשי קשר…">
              <button id="searchBtn" class="btn btn-outline-secondary"><i class="fas fa-search"></i></button>
              <button id="refreshContactsBtn" class="btn btn-outline-primary ms-2"><i class="fas fa-sync-alt"></i></button>
            </div>
            <div id="contacts-table">
              <p class="text-center"><i class="fas fa-spinner fa-spin"></i> טוען אנשי קשר…</p>
            </div>
          </div>`;
          
        this.addEventListeners();
        this.loadContacts();
      }
      
      /* מאזיני אירועים */
      static addEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchContact');
        const refreshBtn = document.getElementById('refreshContactsBtn');
        
        searchBtn?.addEventListener('click', () => this.loadContacts(searchInput.value));
        searchInput?.addEventListener('keyup', e => {
          if (e.key === 'Enter') this.loadContacts(searchInput.value);
        });
        refreshBtn?.addEventListener('click', () => this.loadContacts());
      }
      
      /* טעינת הנתונים מה‑API */
      static async loadContacts(searchTerm = '') {
        const tableContainer = document.getElementById('contacts-table');
        if (!tableContainer) return;
        
        tableContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> טוען…</p>';
        try {
          let url = '/api/contacts';
          if (searchTerm) url += `?search=${encodeURIComponent(searchTerm)}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.status);
          const { contacts } = await res.json();
          
          if (!contacts?.length) {
            tableContainer.innerHTML = '<div class="alert alert-info">לא נמצאו אנשי קשר</div>';
            return;
          }
          
          const rows = contacts.map(c => `
            <tr>
              <td>${c.name || ''}</td>
              <td>${c.phoneNumber}</td>
              <td>${(c.categories || []).map(cat => `<span class="badge bg-info">${cat.name}</span>`).join(' ')}</td>
              <td>${c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('he-IL') : ''}</td>
            </tr>`).join('');
          
          tableContainer.innerHTML = `
            <table class="table table-striped table-hover">
              <thead><tr><th>שם</th><th>טלפון</th><th>קטגוריות</th><th>עודכן</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`;
        } catch (err) {
          tableContainer.innerHTML = `<div class="alert alert-danger">שגיאה: ${err}</div>`;
        }
      }
    }
    
    // רישום הבקר במנהל הבקרים
    if (window.ControllersManager) {
      window.ControllersManager.controllers.contacts = ContactController;
      console.log('נרשם ContactController');
    } else {
      console.error('ControllersManager לא זמין - לא ניתן לרשום את ContactController');
    }
  })();