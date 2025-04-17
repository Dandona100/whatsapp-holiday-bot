// public/js/controllers/templateController.js – UI logic for the “Templates” page
(() => {
    class TemplateController extends ControllerBase {
      static name  = 'templates';
      static title = 'תבניות הודעה';
  
      static async render() {
        if (!this.container) return;
        this.container.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> טוען תבניות…</p>';
        try {
          const res = await fetch('/api/templates?limit=200');
          if (!res.ok) throw new Error(res.status);
          const { data } = await res.json();
  
          if (!data?.length) {
            this.container.innerHTML = '<div class="alert alert-info">אין תבניות שמורות.</div>';
            return;
          }
  
          const cards = data.map(t => `
            <div class="col-md-4 mb-3">
              <div class="card h-100 shadow-sm">
                <div class="card-body">
                  <h5 class="card-title">${t.name}</h5>
                  <p class="card-text small text-muted">${(t.content || '').slice(0,120)}…</p>
                  <button class="btn btn-outline-primary btn-sm previewTemplate" data-id="${t._id}">תצוגה מקדימה</button>
                </div>
              </div>
            </div>`).join('');
  
          this.container.innerHTML = `<div class="container my-4"><div class="row">${cards}</div></div>`;
  
          this.container.querySelectorAll('.previewTemplate').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id  = btn.dataset.id;
              const res = await fetch(`/api/templates/${id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
              });
              const { data } = await res.json();
              alert(data.previewContent);
            });
          });
        } catch (err) {
          this.container.innerHTML = `<div class="alert alert-danger">שגיאה בטעינת תבניות: ${err}</div>`;
        }
      }
    }
  
    window.ControllersManager && (window.ControllersManager.controllers.templates = TemplateController);
  })();
  