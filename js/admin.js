// admin.js
const API_BASE_URL = 'https://photoupload-rvcb.onrender.com/api'; // Change to your backend URL

document.addEventListener('DOMContentLoaded', function() {
    // Admin login
    document.getElementById('loginBtn').addEventListener('click', async function() {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                document.getElementById('loginPage').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'block';
                // Fetch and show the latest customer in the admin panel if container exists
                await fetchAndRenderLatestCustomer();
            } else {
                const error = await response.json();
                showNotification(error.error || 'Invalid credentials!', 'error');
            }
        } catch (error) {
            showNotification('Network error: ' + error.message, 'error');
        }
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    });
    
    // Search button
    document.getElementById('searchBtn').addEventListener('click', function() {
        loadCustomerData();
    });
    
    // Press Enter in search fields
    document.querySelectorAll('.filters input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadCustomerData();
            }
        });
    });
    
    // Function to load customer data
    async function loadCustomerData() {
        const resultsGrid = document.getElementById('resultsGrid');
        resultsGrid.innerHTML = '<div class="loading">Loading customer data...</div>';
        
        // Get filter values
        const name = document.getElementById('filterName').value;
        const district = document.getElementById('filterDistrict').value;
        const mobile = document.getElementById('filterMobile').value;
        
        try {
            // Build query string
            const params = new URLSearchParams();
            if (name) params.append('name', name);
            if (district) params.append('district', district);
            if (mobile) params.append('mobile', mobile);
            
        // Fetch customers from backend
        const response = await fetch(`${API_BASE_URL}/customers?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch customer data');
        }
        const customers = await response.json();
        console.log('Customers loaded:', customers);
        if (!Array.isArray(customers) || customers.length === 0) {
            resultsGrid.innerHTML = '<div class="no-results">No customers found</div>';
            return;
        }
        // Display all customers (usually one, but handle multiple)
        resultsGrid.innerHTML = '';
        customers.forEach(customer => {
            const customerCard = createCustomerCard(customer);
            resultsGrid.appendChild(customerCard);
        });
        } catch (error) {
            console.error('Load customer error:', error);
            resultsGrid.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
        }
    }

    // Fetch and render latest customer helper
    async function fetchAndRenderLatestCustomer() {
        const latestContainer = document.getElementById('latestCustomer');
        if (!latestContainer) return;
        latestContainer.innerHTML = '<div class="loading">Loading latest customer...</div>';
        try {
            const resp = await fetch(`${API_BASE_URL}/customers/latest`);
            if (!resp.ok) {
                latestContainer.innerHTML = '<div class="no-results">No latest customer</div>';
                return;
            }
            const customer = await resp.json();
            // Basic validation of returned object
            if (!customer || !customer._id) {
                latestContainer.innerHTML = '<div class="no-results">No latest customer</div>';
                return;
            }
            latestContainer.innerHTML = '';
            const card = createCustomerCard(customer);
            latestContainer.appendChild(card);
        } catch (err) {
            console.warn('Failed to fetch latest customer:', err);
            latestContainer.innerHTML = '<div class="error">Failed to load latest customer</div>';
        }
    }
    
    // Create customer card element
    function createCustomerCard(customer) {
        // Build sections HTML with status and all required sections
        const requiredSections = [
            'panelSerials','module', 'inverter', 'la', 'earthing', 'acdb', 'dcdb', 'wifi', 'tightness'
        ];
        let sectionsHTML = '';
        requiredSections.forEach(section => {
            const sectionObj = customer[section];
            const sectionPhotos = (sectionObj && Array.isArray(sectionObj.photos)) ? sectionObj.photos : [];
            const status = (sectionObj && sectionObj.status) ? sectionObj.status : 'pending';
            sectionsHTML += `<div class="photo-list">
                <p><strong>${section.charAt(0).toUpperCase() + section.slice(1)} Photos</strong>
                <span class="status status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></p>`;
            if (sectionPhotos.length === 0 || sectionPhotos.every(p => !p.imageUrl)) {
                sectionsHTML += `<div class="no-photos">No photos for this section</div>`;
            } else {
                sectionPhotos.forEach(photo => {
                    if (photo.imageUrl) {
                        const downloadFileName = `${customer.name.split(' ')[0] || customer.name}_${section}_${customer.plantType}.jpg`;
                        sectionsHTML += `<div class="photo-item" data-id="${photo.driveId}">
                            <span>${photo.title}</span>
                            <div class="photo-actions">
                                <button class="btn btn-primary btn-sm view-btn" data-url="${photo.imageUrl}">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-success btn-sm download-btn" data-url="${photo.imageUrl}" data-filename="${downloadFileName}">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="btn btn-danger btn-sm delete-btn" data-driveid="${photo.driveId}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>`;
                    }
                });
            }
            sectionsHTML += `</div>`;
        });
        
    const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
            <div class="customer-header">
                <h3>${customer.name}</h3>
        <p>${customer.district} | ${customer.plantType} System</p>
            </div>
            <div class="customer-body">
                <p><i class="fas fa-phone"></i> ${customer.mobile}</p>
        <p><i class="fas fa-user"></i> Technician: ${customer.technician || '-'}</p>
                <p><i class="fas fa-map-marker-alt"></i> ${customer.address || ''}</p>
                <p><i class="fas fa-calendar"></i> Created: ${new Date(customer.createdAt).toLocaleDateString()}</p>
                ${sectionsHTML}
                <button class="delete-all" data-id="${customer._id}">
                    <i class="fas fa-trash-alt"></i> Delete All Photos
                </button>
            </div>
        `;
        
        // Add event listeners
        card.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const url = btn.getAttribute('data-url');
                if (url) {
                    window.open(url, '_blank');
                }
            });
        });

        card.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const url = btn.getAttribute('data-url');
                const downloadFileName = btn.getAttribute('data-filename') || 'photo.jpg';
                if (url) {
                    try {
                        const response = await fetch(url, { mode: 'cors' });
                        if (!response.ok) throw new Error('Failed to fetch image');
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = downloadFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(blobUrl);
                    } catch (err) {
                        showNotification('Download failed: ' + err.message, 'error');
                    }
                }
            });
        });

        card.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const driveId = btn.getAttribute('data-driveid');
                if (confirm('Are you sure you want to delete this photo?')) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/photos/${customer._id}/${driveId}`, {
                            method: 'DELETE'
                        });
                        if (!response.ok) {
                            throw new Error('Failed to delete photo');
                        }
                        btn.closest('.photo-item').remove();
                        showNotification('Photo deleted successfully', 'success');
                    } catch (error) {
                        showNotification('Failed to delete photo: ' + error.message, 'error');
                    }
                }
            });
        });

        card.querySelector('.delete-all').addEventListener('click', async function() {
            if (confirm('Are you sure you want to delete ALL photos for this customer?')) {
                try {
                    const response = await fetch(`${API_BASE_URL}/photos/${customer._id}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) {
                        throw new Error('Failed to delete photos');
                    }
                    card.remove();
                    showNotification('All photos deleted successfully', 'success');
                } catch (error) {
                    showNotification('Failed to delete photos: ' + error.message, 'error');
                }
            }
        });
        
        return card;
    }
    
    // Function to show notification
    function showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button class="close-btn"><i class="fas fa-times"></i></button>
        `;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
        
        // Close button
        notification.querySelector('.close-btn').addEventListener('click', () => {
            notification.remove();
        });
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            background-color: ${type === 'success' ? '#28a745' : 
                              type === 'error' ? '#dc3545' : 
                              type === 'info' ? '#17a2b8' : '#6c757d'};
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            z-index: 1000;
            transition: opacity 0.3s ease;
        `;
    }
});