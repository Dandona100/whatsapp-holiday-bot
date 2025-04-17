// public/js/controllers/categoryController.js – UI logic for the “Categories” page
(() => {
    class CategoryController extends ControllerBase {
      static name  = 'categories';
      static title = 'קטגוריות';
  
      static async render() {
        if (!this.container) return;
        this.container.innerHTML = `
          <div class="container my-4">
            <h2 class="mb-3"><i class="fas fa-tags me-2 text-success"></i> ${this.title}</h2>
            <p><i class="fas fa-spinner fa-spin"></i> טוען קטגוריות…</p>
          </div>`;
  
        try {
          const res = await fetch('/api/categories?withCount=true&limit=200');
          if (!res.ok) throw new Error(res.status);
          const { data } = await res.json();
  
          if (!data?.length) {
            this.container.innerHTML = '<div class="alert alert-info">לא נמצאו קטגוריות.</div>';
            return;
          }
  
          const rows = data.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.description || ''}</td>
              <td><span class="badge bg-secondary">${c.contactCount ?? 0}</span></td>
            </tr>`).join('');
  
          this.container.innerHTML = `
            <div class="container my-4">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="mb-0"><i class="fas fa-tags me-2 text-success"></i> ${this.title}</h2>
                <button class="btn btn-primary btn-sm" id="newCategoryBtn">
                  <i class="fas fa-plus"></i> קטגוריה חדשה
                </button>
              </div>
              <table class="table table-striped">
                <thead><tr><th>שם</th><th>תיאור</th><th>אנשי קשר</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`;
  
          document.getElementById('newCategoryBtn')?.addEventListener('click', () =>
            alert('טופס קטגוריה חדשה – טרם מומש'));
        } catch (err) {
          this.container.innerHTML = `<div class="alert alert-danger">שגיאה בטעינת קטגוריות: ${err}</div>`;
        }
      }
    }
  
    window.ControllersManager && (window.ControllersManager.controllers.categories = CategoryController);
  })();
  