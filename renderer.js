// Renderer uses the window.api methods exposed by preload
const addForm = document.getElementById('addForm');
const tableBody = document.querySelector('#inventoryTable tbody');
const emptyText = document.getElementById('empty');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeModal = document.getElementById('closeModal');
const cancelEdit = document.getElementById('cancelEdit');
const customDialog = document.getElementById('customDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogCancel = document.getElementById('dialogCancel');
const dialogConfirm = document.getElementById('dialogConfirm');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');

let inventory = [];
let filteredInventory = [];
let editingIndex = -1;
let lastFocusedInputId = null;
let dialogResolve = null;
// Track the last input field the user interacted with
document.addEventListener('focusin', (e) => {
  if (e.target && e.target.matches('#addForm input, #addForm select, #addForm textarea')) {
    lastFocusedInputId = e.target.id || null;
  }
});

// Load and render inventory
async function loadInventory(){
  inventory = await window.api.readInventory();
  filteredInventory = [...inventory];
  renderInventory();
}

function renderInventory(){
  tableBody.innerHTML = '';
  const itemsToRender = filteredInventory.length > 0 ? filteredInventory : inventory;
  
  if(!itemsToRender || itemsToRender.length === 0){
    emptyText.style.display = 'block';
    if (filteredInventory.length === 0 && inventory.length > 0) {
      emptyText.textContent = 'No items match your search.';
    } else {
      emptyText.textContent = 'No items yet. Add your first product above.';
    }
    return;
  }
  emptyText.style.display = 'none';
  itemsToRender.forEach((item, index) =>{
    // Find the original index in the main inventory array
    const originalIndex = inventory.findIndex(originalItem => 
      originalItem.name === item.name && 
      originalItem.category === item.category && 
      originalItem.price === item.price
    );
    const displayIndex = originalIndex !== -1 ? originalIndex : index;
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
    <td>
      <button class="action-btn edit" data-i="${displayIndex}" data-action="edit">Edit</button>
      <button class="action-btn" data-i="${displayIndex}" data-action="delete">Delete</button>
    </td>
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

// Search and filter functionality
function filterInventory(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') {
    filteredInventory = [...inventory];
  } else {
    const term = searchTerm.toLowerCase().trim();
    filteredInventory = inventory.filter(item => {
      return (
        (item.name && item.name.toLowerCase().includes(term)) ||
        (item.category && item.category.toLowerCase().includes(term)) ||
        (item.unit && item.unit.toLowerCase().includes(term)) ||
        (item.price && item.price.toString().includes(term)) ||
        (item.quantity && item.quantity.toString().includes(term))
      );
    });
  }
  renderInventory();
}

function clearSearchFilter() {
  searchInput.value = '';
  filteredInventory = [...inventory];
  renderInventory();
  clearSearch.style.display = 'none';
  searchInput.focus();
}

// Custom dialog functions to replace alert/confirm
function showDialog(title, message, showCancel = false) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogCancel.style.display = showCancel ? 'inline-block' : 'none';
    customDialog.style.display = 'block';
    
    // Focus the confirm button
    setTimeout(() => {
      dialogConfirm.focus();
    }, 100);
  });
}

function closeDialog(result) {
  customDialog.style.display = 'none';
  if (dialogResolve) {
    dialogResolve(result);
    dialogResolve = null;
  }
}

// Dialog event listeners
dialogConfirm.addEventListener('click', () => closeDialog(true));
dialogCancel.addEventListener('click', () => closeDialog(false));

// Close dialog when clicking outside
customDialog.addEventListener('click', (e) => {
  if (e.target === customDialog) {
    closeDialog(false);
  }
});

// Close dialog with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && customDialog.style.display === 'block') {
    closeDialog(false);
  }
});

// Search functionality
searchInput.addEventListener('input', (e) => {
  const searchTerm = e.target.value;
  filterInventory(searchTerm);
  
  // Show/hide clear button
  if (searchTerm.trim() !== '') {
    clearSearch.style.display = 'inline-block';
  } else {
    clearSearch.style.display = 'none';
  }
});

clearSearch.addEventListener('click', clearSearchFilter);

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
  if(!item.name) {
    await showDialog('Error', 'Product name is required');
    return;
  }
  inventory.push(item);
  await window.api.writeInventory(inventory);
  addForm.reset();
  
  // Update filtered inventory and re-render
  filterInventory(searchInput.value);
});

// Action handler for edit and delete
tableBody.addEventListener('click', async (e) => {
  if (e.target.matches('button.action-btn')) {
    const idx = Number(e.target.dataset.i);
    const action = e.target.dataset.action;
    
    if (!Number.isNaN(idx)) {
      if (action === 'edit') {
        openEditModal(idx);
      } else if (action === 'delete') {
        const confirmed = await showDialog('Confirm Delete', 'Are you sure you want to delete this item?', true);
        if (confirmed) {
          inventory.splice(idx, 1);
          await window.api.writeInventory(inventory);
          
          // Update filtered inventory and re-render
          filterInventory(searchInput.value);
        }
      }
    }
  }
});

// Edit modal functions
function openEditModal(index) {
  editingIndex = index;
  const item = inventory[index];
  
  document.getElementById('editName').value = item.name || '';
  document.getElementById('editCategory').value = item.category || '';
  document.getElementById('editPrice').value = item.price || 0;
  document.getElementById('editQuantity').value = item.quantity || 0;
  document.getElementById('editUnit').value = item.unit || '';
  
  editModal.style.display = 'block';
  document.getElementById('editName').focus();
}

function closeEditModal() {
  editModal.style.display = 'none';
  editingIndex = -1;
  editForm.reset();
}

// Edit form submission
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (editingIndex >= 0) {
    const item = {
      name: document.getElementById('editName').value.trim(),
      category: document.getElementById('editCategory').value.trim(),
      price: parseFloat(document.getElementById('editPrice').value) || 0,
      quantity: parseInt(document.getElementById('editQuantity').value) || 0,
      unit: document.getElementById('editUnit').value.trim()
    };
    
    if (!item.name) {
      await showDialog('Error', 'Product name is required');
      return;
    }
    
    inventory[editingIndex] = item;
    await window.api.writeInventory(inventory);
    
    // Update filtered inventory and re-render
    filterInventory(searchInput.value);
    closeEditModal();
  }
});

// Modal event listeners
closeModal.addEventListener('click', closeEditModal);
cancelEdit.addEventListener('click', closeEditModal);

// Close modal when clicking outside
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});


// Initialize
loadInventory();
