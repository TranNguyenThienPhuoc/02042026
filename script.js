// Global variables
// Data from data.js (merged into this file) - will be loaded in loadData()
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
let itemsPerPage = 10;
let sortColumn = null;
let sortOrder = 'asc';
let currentEditId = null;
let apiBaseUrl = 'https://api.escuelajs.co/api/v1/products'; // API endpoint
let categories = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    // Wait a bit for data.js to load if it's a script file
    setTimeout(() => {
        loadData();
    }, 200);
});

async function loadCategories() {
    try {
        const res = await fetch('https://api.escuelajs.co/api/v1/categories');
        if (!res.ok) throw new Error('Failed to load categories');
        categories = await res.json();
        populateCategorySelect('createCategory');
        // editCategory select is created dynamically inside modal; populate there when opening modal
    } catch (e) {
        console.error('loadCategories error:', e);
        categories = [];
    }
}

function populateCategorySelect(selectId, selectedValue = '') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const val = selectedValue ? String(selectedValue) : '';
    el.innerHTML = '<option value="" disabled>Chọn category...</option>';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = `${c.id} - ${c.name}`;
        if (String(c.id) === val) opt.selected = true;
        el.appendChild(opt);
    });
    if (!val) {
        // keep placeholder selected
        el.insertAdjacentHTML('afterbegin', '<option value="" selected disabled>Chọn category...</option>');
    }
}

// Load data from merged data or API
async function loadData() {
    await loadCategories();
    // First, try to load from API
    try {
        const response = await fetch(apiBaseUrl);
        if (response.ok) {
            allProducts = await response.json();
            filteredProducts = [...allProducts];
            renderTable();
            renderPagination();
            return;
        } else {
            throw new Error('API not available');
        }
    } catch (error) {
        console.log('API not available, loading from embedded data...', error);
        
        // Try to fetch and parse the script file to extract embedded data
        try {
            const scriptResponse = await fetch('script.js');
            const scriptText = await scriptResponse.text();
            
            // Extract the array from the beginning of the file
            // The data array should be at the very start, before any comments or code
            const arrayMatch = scriptText.match(/^(\[[\s\S]*?\])\s*\/\/\s*Global/);
            if (arrayMatch) {
                allProducts = JSON.parse(arrayMatch[1]);
            } else {
                // Try alternative pattern: array followed by newline and comment
                const altMatch = scriptText.match(/^(\[[\s\S]*?\])\s*\n\s*\/\/\s*Global/);
                if (altMatch) {
                    allProducts = JSON.parse(altMatch[1]);
                } else {
                    // Try to find any JSON array at the start
                    const simpleMatch = scriptText.match(/^(\[[\s\S]*?\])\s+/);
                    if (simpleMatch) {
                        allProducts = JSON.parse(simpleMatch[1]);
                    } else {
                        throw new Error('Could not find data array in script.js');
                    }
                }
            }
        } catch (parseError) {
            console.error('Could not parse embedded data from script.js:', parseError);
            // Fallback: try to use data from global scope
            if (typeof products !== 'undefined' && Array.isArray(products)) {
                allProducts = products;
            } else if (typeof window.products !== 'undefined' && Array.isArray(window.products)) {
                allProducts = window.products;
            } else {
                console.error('No data source available');
                allProducts = [];
            }
        }
    }
    
    if (!Array.isArray(allProducts)) {
        console.error('Products data is not an array');
        allProducts = [];
    }
    
    filteredProducts = [...allProducts];
    renderTable();
    renderPagination();
}

// Setup event listeners
function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Items per page
    document.getElementById('itemsPerPage').addEventListener('change', function(e) {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderTable();
        renderPagination();
    });
    
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(icon => {
        icon.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent row click event
            const column = this.getAttribute('data-sort');
            const currentOrder = this.getAttribute('data-order');
            
            // Reset all sort buttons to default state
            document.querySelectorAll('.sort-btn').forEach(i => {
                i.textContent = '⇅';
                i.setAttribute('data-order', 'asc');
            });
            
            // Set new sort order
            sortOrder = currentOrder === 'asc' ? 'desc' : 'asc';
            this.setAttribute('data-order', sortOrder);
            sortColumn = column;
            
            // Update button to show current sort direction
            this.textContent = sortOrder === 'asc' ? '↑' : '↓';
            
            sortData();
            renderTable();
        });
    });
    
    // Export CSV
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Edit button in detail modal
    document.getElementById('editBtn').addEventListener('click', enableEditMode);
    
    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveProduct);
    
    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    
    // Create submit button
    document.getElementById('createSubmitBtn').addEventListener('click', createProduct);
    
    // Reset create modal when closed
    const createModal = document.getElementById('createModal');
    createModal.addEventListener('hidden.bs.modal', function() {
        document.getElementById('createForm').reset();
    });
}

// Handle search
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (searchTerm === '') {
        filteredProducts = [...allProducts];
    } else {
        filteredProducts = allProducts.filter(product => 
            product.title.toLowerCase().includes(searchTerm)
        );
    }
    currentPage = 1;
    sortData();
    renderTable();
    renderPagination();
}

// Sort data
function sortData() {
    if (!sortColumn) return;
    
    filteredProducts.sort((a, b) => {
        let aVal, bVal;
        
        if (sortColumn === 'title') {
            aVal = a.title || '';
            bVal = b.title || '';
        } else if (sortColumn === 'price') {
            aVal = parseFloat(a.price) || 0;
            bVal = parseFloat(b.price) || 0;
        }
        
        if (sortColumn === 'title') {
            // Sort theo bảng chữ cái (tiếng Việt), không phân biệt hoa/thường, có hỗ trợ số trong chuỗi
            const cmp = aVal.toString().localeCompare(
                bVal.toString(),
                'vi',
                { sensitivity: 'base', numeric: true }
            );
            return sortOrder === 'asc' ? cmp : -cmp;
        } else {
            return sortOrder === 'asc' 
                ? aVal - bVal
                : bVal - aVal;
        }
    });
}

// Update sort icons
function updateSortIcons() {
    // Keep function name for minimal changes; it now updates sort buttons
    document.querySelectorAll('.sort-btn').forEach(icon => {
        const column = icon.getAttribute('data-sort');
        if (column === sortColumn) {
            icon.textContent = sortOrder === 'asc' ? '↑' : '↓';
            icon.setAttribute('data-order', sortOrder);
        } else {
            icon.textContent = '⇅';
            icon.setAttribute('data-order', 'asc');
        }
    });
}

// Render table
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    // Update sort icons to reflect current state
    updateSortIcons();
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    
    if (pageProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Không có dữ liệu</td></tr>';
        return;
    }
    
    pageProducts.forEach(product => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', product.id);
        row.setAttribute('data-description', product.description || '');
        
        // Handle hover for description
        row.addEventListener('mouseenter', function(e) {
            showDescriptionTooltip(e, product.description || '');
        });
        row.addEventListener('mouseleave', function() {
            hideDescriptionTooltip();
        });
        row.addEventListener('mousemove', function(e) {
            updateTooltipPosition(e);
        });
        
        // Click to view detail
        row.addEventListener('click', function() {
            viewProductDetail(product.id);
        });
        
        const categoryName = product.category?.name || product.category || 'N/A';
        const categoryId = product.category?.id || '';
        const images = product.images || [];
        const firstImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/60';
        
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.title || 'N/A'}</td>
            <td>$${product.price || 0}</td>
            <td><span class="badge bg-primary category-badge">${categoryName}</span></td>
            <td>
                <img src="${firstImage}" alt="${product.title}" class="product-image" 
                     onerror="this.src='https://via.placeholder.com/60'">
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Show description tooltip
function showDescriptionTooltip(event, description) {
    if (!description) return;
    
    const tooltip = document.getElementById('descriptionTooltip');
    tooltip.textContent = description;
    tooltip.style.display = 'block';
    updateTooltipPosition(event);
}

// Update tooltip position
function updateTooltipPosition(event) {
    const tooltip = document.getElementById('descriptionTooltip');
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
}

// Hide description tooltip
function hideDescriptionTooltip() {
    const tooltip = document.getElementById('descriptionTooltip');
    tooltip.style.display = 'none';
}

// Render pagination
function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>`;
    prevLi.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    });
    pagination.appendChild(prevLi);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        li.addEventListener('click', function(e) {
            e.preventDefault();
            currentPage = i;
            renderTable();
            renderPagination();
        });
        pagination.appendChild(li);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>`;
    nextLi.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    });
    pagination.appendChild(nextLi);
}

// View product detail
async function viewProductDetail(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;
    
    currentEditId = id;
    const modalBody = document.getElementById('detailModalBody');
    
    modalBody.innerHTML = `
        <div id="detailView">
            <div class="mb-3">
                <strong>ID:</strong> ${product.id}
            </div>
            <div class="mb-3">
                <strong>Title:</strong> <span id="detailTitle">${product.title || 'N/A'}</span>
            </div>
            <div class="mb-3">
                <strong>Price:</strong> <span id="detailPrice">$${product.price || 0}</span>
            </div>
            <div class="mb-3">
                <strong>Description:</strong> <span id="detailDescription">${product.description || 'N/A'}</span>
            </div>
            <div class="mb-3">
                <strong>Category:</strong> <span id="detailCategory">${product.category?.name || product.category || 'N/A'}</span>
            </div>
            <div class="mb-3">
                <strong>Images:</strong>
                <div id="detailImages" class="mt-2">
                    ${(product.images || []).map(img => 
                        `<img src="${img}" alt="${product.title}" class="img-thumbnail me-2 mb-2" style="max-width: 150px;" onerror="this.src='https://via.placeholder.com/150'">`
                    ).join('')}
                </div>
            </div>
        </div>
        <div id="editView" style="display: none;">
            <form id="editForm">
                <div class="mb-3">
                    <label class="form-label">ID:</label>
                    <input type="text" class="form-control" id="editId" value="${product.id}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">Title *</label>
                    <input type="text" class="form-control" id="editTitle" value="${product.title || ''}" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Price *</label>
                    <input type="number" class="form-control" id="editPrice" value="${product.price || 0}" step="0.01" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" id="editDescription" rows="3">${product.description || ''}</textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Category *</label>
                    <select class="form-select" id="editCategory" required>
                        <option value="" selected disabled>Chọn category...</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Images (URL, cách nhau bởi dấu phẩy)</label>
                    <input type="text" class="form-control" id="editImages" value="${(product.images || []).join(', ')}">
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('editBtn').style.display = 'inline-block';
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();

    // populate edit category select after modal content is in DOM
    const currentCategoryId = product.category?.id ?? product.categoryId ?? '';
    populateCategorySelect('editCategory', currentCategoryId);
}

// Enable edit mode
function enableEditMode() {
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('editView').style.display = 'block';
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';
}

// Cancel edit
function cancelEdit() {
    if (currentEditId) {
        viewProductDetail(currentEditId);
    }
}

// Save product
async function saveProduct() {
    const form = document.getElementById('editForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const productData = {
        title: document.getElementById('editTitle').value,
        price: parseFloat(document.getElementById('editPrice').value),
        description: document.getElementById('editDescription').value,
        categoryId: parseInt(document.getElementById('editCategory').value),
        images: document.getElementById('editImages').value
            .split(',')
            .map(url => url.trim())
            .filter(url => url !== '')
    };
    
    try {
        const response = await fetch(`${apiBaseUrl}/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            const updatedProduct = await response.json();
            // Update local data
            const index = allProducts.findIndex(p => p.id === currentEditId);
            if (index !== -1) {
                allProducts[index] = updatedProduct;
            }
            
            // Update filtered products
            const filteredIndex = filteredProducts.findIndex(p => p.id === currentEditId);
            if (filteredIndex !== -1) {
                filteredProducts[filteredIndex] = updatedProduct;
            }
            
            alert('Cập nhật thành công!');
            renderTable();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
            modal.hide();
        } else {
            alert('Có lỗi xảy ra khi cập nhật!');
        }
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Có lỗi xảy ra khi cập nhật!');
    }
}

// Create product
async function createProduct() {
    const form = document.getElementById('createForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const productData = {
        title: document.getElementById('createTitle').value,
        price: parseFloat(document.getElementById('createPrice').value),
        description: document.getElementById('createDescription').value,
        categoryId: parseInt(document.getElementById('createCategory').value),
        images: document.getElementById('createImages').value
            .split(',')
            .map(url => url.trim())
            .filter(url => url !== '')
    };
    
    try {
        const response = await fetch(apiBaseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (response.ok) {
            const newProduct = await response.json();
            allProducts.push(newProduct);
            filteredProducts = [...allProducts];
            
            alert('Tạo mới thành công!');
            renderTable();
            renderPagination();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
            modal.hide();
        } else {
            alert('Có lỗi xảy ra khi tạo mới!');
        }
    } catch (error) {
        console.error('Error creating product:', error);
        alert('Có lỗi xảy ra khi tạo mới!');
    }
}

// Export to CSV
function exportToCSV() {
    if (filteredProducts.length === 0) {
        alert('Không có dữ liệu để export!');
        return;
    }
    
    const headers = ['ID', 'Title', 'Price', 'Category', 'Description', 'Images'];
    const rows = filteredProducts.map(product => {
        const categoryName = product.category?.name || product.category || 'N/A';
        const images = (product.images || []).join('; ');
        return [
            product.id || '',
            `"${(product.title || '').replace(/"/g, '""')}"`,
            product.price || 0,
            `"${categoryName}"`,
            `"${(product.description || '').replace(/"/g, '""')}"`,
            `"${images}"`
        ];
    });
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Add BOM for UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
