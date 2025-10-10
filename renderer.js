// Renderer uses the window.api methods exposed by preload
const addForm = document.getElementById('addForm');
const tableBody = document.querySelector('#inventoryTable tbody');
const emptyText = document.getElementById('empty');

let inventory = [];
let lastFocusedInputId = null;
// Track the last input field the user interacted with
document.addEventListener('focusin', (e) => {
  if (e.target && e.target.matches('#addForm input, #addForm select, #addForm textarea')) {
    lastFocusedInputId = e.target.id || null;
  }
});

// Load and render inventory
async function loadInventory(){
  inventory = await window.api.readInventory();
  renderInventory();
}

function renderInventory(){
  tableBody.innerHTML = '';
  if(!inventory || inventory.length === 0){
    emptyText.style.display = 'block';
    return;
  }
  emptyText.style.display = 'none';
  inventory.forEach((item, index) =>{
    const tr = document.createElement('tr');
    const name = escapeHtml(item && item.name != null ? String(item.name) : '');
    const category = escapeHtml(item && item.category != null ? String(item.category) : '');
    const price = Number(item && item.price != null ? Number(item.price) : 0);
    const quantity = Number.isFinite(Number(item && item.quantity != null ? item.quantity : 0)) ? parseInt(item.quantity) : 0;
    const unit = escapeHtml(item && item.unit != null ? String(item.unit) : '');
    tr.innerHTML = `
    <td>${name}</td>
    <td>${category}</td>
    <td>${price.toFixed(2)}</td>
    <td>${quantity}</td>
    <td>${unit}</td>
    <td><button class="action-btn" data-i="${index}">Delete</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(unsafe){
  const s = String(unsafe ?? '');
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Add item
addForm.addEventListener('submit', async (e) =>{
  e.preventDefault();
  const item = {
    name: document.getElementById('name').value.trim(),
    category: document.getElementById('category').value.trim(),
    price: parseFloat(document.getElementById('price').value) || 0,
    quantity: parseInt(document.getElementById('quantity').value) || 0,
    unit: document.getElementById('unit').value.trim()
  };
  if(!item.name) return alert('Product name is required');
  inventory.push(item);
  await window.api.writeInventory(inventory);
  addForm.reset();
  renderInventory();
});

// Delete handler with reliable focus restore
tableBody.addEventListener('click', async (e) => {
  if (e.target.matches('button.action-btn')) {
    const idx = Number(e.target.dataset.i);
    if (!Number.isNaN(idx)) {
      if (confirm('Delete this item?')) {
        inventory.splice(idx, 1);
        await window.api.writeInventory(inventory);
        renderInventory();

        // Ask main process to refocus the app window
        try {
          await window.api.focusWindow();
        } catch (err) {
          console.warn('focusWindow IPC failed:', err);
        }

        // Small delay before focusing the last used input field
        setTimeout(() => {
          try {
            // Force focus to document/body first, then target input
            if (!document.hasFocus()) window.focus();
            document.body.focus();
            const targetId = lastFocusedInputId || 'name';
            const target = document.getElementById(targetId);
            if (target) {
              target.blur();
              target.focus();
              if (target.select) target.select();
            }
          } catch (err) {
            console.error('Focus restore failed:', err);
          }
        }, 150);

        // Fallback: another attempt after layout settles further
        setTimeout(() => {
          try {
            if (!document.hasFocus()) window.focus();
            document.body.focus();
            const targetId = lastFocusedInputId || 'name';
            const nameInput = document.getElementById(targetId);
            if (nameInput) {
              let tries = 0;
              const tryFocus = () => {
                try {
                  if (!document.hasFocus()) window.focus();
                  document.body.focus();
                  nameInput.focus();
                  tries++;
                  if (tries < 5 && document.activeElement !== nameInput) {
                    requestAnimationFrame(tryFocus);
                  }
                } catch (_) {}
              };
              requestAnimationFrame(tryFocus);
            }
          } catch (_) {}
        }, 350);
      }
    }
  }
});

// Initialize
loadInventory();
