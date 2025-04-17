// public/js/controllers/messageController.js – UI logic for composing & sending messages
(() => {
    class MessageController extends ControllerBase {
      static name  = 'messages';
      static title = 'שליחת הודעות';
  
      static async render() {
        if (!this.container) return;
        this.container.innerHTML = `
          <div class="container my-4">
            <h2 class="mb-3"><i class="fas fa-paper-plane me-2 text-info"></i> ${this.title}</h2>
  
            <form id="sendMsgForm" class="card shadow-sm p-3">
              <div class="mb-3">
                <label class="form-label">קטגוריה</label>
                <select id="categorySelect" class="form-select"></select>
              </div>
              <div class="mb-3">
                <label class="form-label">תבנית</label>
                <select id="templateSelect" class="form-select"></select>
              </div>
              <div class="mb-3">
                <label class="form-label">תצוגה מקדימה</label>
                <textarea id="previewBox" class="form-control" rows="4" readonly></textarea>
              </div>
              <button type="submit" class="btn btn-success"><i class="fas fa-paper-plane"></i> שלח</button>
            </form>
            <div id="sendStatus" class="mt-3"></div>
          </div>`;
  
        await Promise.all([this.populateCategories(), this.populateTemplates()]);
        this.addEventListeners();
      }
  
      /* מילוי רשימת קטגוריות */
      static async populateCategories() {
        const sel = document.getElementById('categorySelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">— בחר קטגוריה —</option>';
        try {
          const res = await fetch('/api/categories?limit=500');
          const { data } = await res.json();
          sel.innerHTML += data.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
        } catch {}
      }
  
      /* מילוי רשימת תבניות */
      static async populateTemplates() {
        const sel = document.getElementById('templateSelect');
        if (!sel) return;
        sel.innerHTML = '<option value="">— ללא תבנית —</option>';
        try {
          const res = await fetch('/api/templates?limit=500');
          const { data } = await res.json();
          sel.innerHTML += data.map(t => `<option value="${t._id}" data-content="${encodeURIComponent(t.content)}">${t.name}</option>`).join('');
        } catch {}
      }
  
      /* מאזיני אירועים */
      static addEventListeners() {
        const form          = document.getElementById('sendMsgForm');
        const templateSel   = document.getElementById('templateSelect');
        const previewBox    = document.getElementById('previewBox');
        const statusBox     = document.getElementById('sendStatus');
  
        templateSel?.addEventListener('change', () => {
          const opt = templateSel.selectedOptions[0];
          previewBox.value = opt ? decodeURIComponent(opt.dataset.content || '') : '';
        });
  
        form?.addEventListener('submit', async e => {
          e.preventDefault();
          statusBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח…';
          try {
            const body = {
              categoryId: document.getElementById('categorySelect').value || null,
              templateId: templateSel.value || null
            };
            const res = await fetch('/api/messages/bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || res.status);
            statusBox.innerHTML = `<div class="alert alert-success">${json.message}</div>`;
          } catch (err) {
            statusBox.innerHTML = `<div class="alert alert-danger">שגיאה: ${err}</div>`;
          }
        });
      }
    }
  
    window.ControllersManager && (window.ControllersManager.controllers.messages = MessageController);
  })();
  