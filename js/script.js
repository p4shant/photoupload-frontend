const API_BASE_URL = "http://localhost:5000/api"; // Update with your backend URL
let currentCustomerId = null;
const LOCAL_STORAGE_KEY = "kamnSolarFormData";

// Geolocation utility functions
async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        
        // Get address from coordinates
        try {
          const address = await getAddressFromCoordinates(
            locationData.latitude, 
            locationData.longitude
          );
          locationData.address = address;
        } catch (error) {
          console.warn('Failed to get address:', error);
          locationData.address = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
        }
        
        resolve(locationData);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        // Return null instead of rejecting to allow photo capture without location
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,  // Increased timeout for address lookup
        maximumAge: 300000 // 5 minutes
      }
    );
  });
}

async function getAddressFromCoordinates(lat, lng) {
  try {
    // Using OpenStreetMap Nominatim API for reverse geocoding (free and reliable)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      {
        headers: {
          'User-Agent': 'SolarPlantApp/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      // Extract relevant address components similar to reference image
      const addr = data.address;
      const addressParts = [];
      
      // Build address components
      if (addr.house_number && addr.road) {
        addressParts.push(`${addr.house_number}, ${addr.road}`);
      } else if (addr.road) {
        addressParts.push(addr.road);
      }
      
      if (addr.neighbourhood || addr.suburb) {
        addressParts.push(addr.neighbourhood || addr.suburb);
      }
      
      if (addr.city || addr.town || addr.village) {
        addressParts.push(addr.city || addr.town || addr.village);
      }
      
      if (addr.state) {
        addressParts.push(addr.state);
      }
      
      if (addr.country) {
        addressParts.push(addr.country);
      }
      
      if (addr.postcode) {
        addressParts.push(addr.postcode);
      }
      
      return addressParts.length > 0 ? addressParts.join(', ') : data.display_name;
    }
    
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.warn('Address lookup failed:', error.message);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

// Geolocation status indicator functions
function showGeolocationStatus(photoUploadDiv, status, details = '') {
  let statusDiv = photoUploadDiv.querySelector('.geolocation-status');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.className = 'geolocation-status';
    photoUploadDiv.appendChild(statusDiv);
  }
  
  // Clear previous status classes
  statusDiv.classList.remove('capturing', 'success', 'error');
  statusDiv.classList.add(status);
  
  let content = '';
  switch (status) {
    case 'capturing':
      content = '<i class="fas fa-location-arrow geolocation-icon"></i> Getting location...';
      break;
    case 'success':
      const shortAddress = details ? (details.length > 50 ? details.substring(0, 47) + '...' : details) : 'Location captured';
      content = `<i class="fas fa-map-marker-alt geolocation-icon"></i> ${shortAddress}`;
      break;
    case 'error':
      content = '<i class="fas fa-exclamation-triangle geolocation-icon"></i> Location unavailable';
      break;
  }
  statusDiv.innerHTML = content;
}

function hideGeolocationStatus(photoUploadDiv) {
  const statusDiv = photoUploadDiv.querySelector('.geolocation-status');
  if (statusDiv) {
    statusDiv.style.display = 'none';
  }
}

// Data structure to hold form data and photo URLs
let formData = {
  customer: {
    name: "",
    district: "",
    plantType: "",
    mobile: "",
    address: ""
  },
  photos: {}, // { sectionId: { photoType: { dataURL, geolocation },... },... }
  geolocations: {}, // { sectionId: { photoType: geolocationData,... },... }
  currentCustomerId: null, // To persist the active customer ID
};


document.addEventListener("DOMContentLoaded", function () {
  const customerNameInput = document.getElementById("customerName");
  const districtInput = document.getElementById("district");
  const plantTypeSelect = document.getElementById("plantType");
  const mobileInput = document.getElementById("mobile");

  const addressInput = document.getElementById("address");
  const customerFormSection = document.getElementById("customerFormSection");
  const customerDisplaySection = document.getElementById("customerDisplaySection");
  const photoSectionsContainer = document.getElementById("photoSections");

  const displayCustomerName = document.getElementById("displayCustomerName");
  const displayDistrict = document.getElementById("displayDistrict");
  const displayPlantType = document.getElementById("displayPlantType");
  const displayMobile = document.getElementById("displayMobile");
  const displayAddress = document.getElementById("displayAddress");

  const createCustomerBtn = document.getElementById("createCustomerBtn");
  const addExistingCustomerBtn = document.getElementById(
    "addExistingCustomerBtn"
  );
  const changeCustomerBtn = document.getElementById("changeCustomerBtn");
  const editCustomerBtn = document.getElementById("editCustomerBtn");
  const saveCustomerBtn = document.getElementById("saveCustomerBtn");

  const technicianSelect = document.getElementById('technicianSelect');
  const displayTechnician = document.getElementById('displayTechnician');
  const panelSerialsGrid = document.getElementById('panelSerialsGrid');

  const submitAllBtn = document.getElementById("submitAll");
  const clearAllBtn = document.getElementById("clearAll");

  const photoInputs = document.querySelectorAll(".file-input");
  const sectionSubmitBtns = document.querySelectorAll(".submit-section");
  const sectionClearBtns = document.querySelectorAll(".clear-section");
  const removePhotoBtns = document.querySelectorAll(".remove-btn");

  // Helper to convert Data URL to Blob
  // function dataURLtoBlob(dataurl) {
  //   // Ensure dataurl has the expected format before splitting
  //   const commaIndex = dataurl.indexOf(",");
  //   if (commaIndex === -1) {
  //     console.error("Invalid data URL format:", dataurl);
  //     return new Blob(); // Return an empty blob or handle error appropriately
  //   }
  //   const arr = dataurl.split(",");
  //   // Use regex match for more robust MIME type extraction
  //   const mimeMatch = arr[0].match(/:(.*?);/);
  //   const mime = mimeMatch ? mimeMatch[1] : "image/jpeg"; // Default to jpeg if mime not found

  //   // Check if arr[1] exists before decoding
  //   if (!arr[1]) {
  //     console.error("Data URL missing base64 part:", dataurl);
  //     return new Blob(); // Return an empty blob or handle error appropriately
  //   }

  //   const bstr = atob(arr[1]);
  //   let n = bstr.length;
  //   const u8arr = new Uint8Array(n);
  //   while (n--) {
  //     u8arr[n] = bstr.charCodeAt(n);
  //   }
  //   return new Blob([u8arr], { type: mime });
  // }
  function dataURLtoBlob(dataurl) {
    try {
      // Extract base64 data and MIME type
      const arr = dataurl.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const bstr = atob(arr[1]);

      // Convert to Uint8Array
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }

      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error("Data URL conversion error:", error);
      return new Blob([], { type: "image/jpeg" });
    }
  }

  // Save data to local storage
  function saveToLocalStorage() {
    console.log("Saving formData to local storage:", formData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
  }

  // Helper: determine required panel photo count by plant type
  function serialsCountForPlant(plantType) {
    switch (plantType) {
      case '3kw': return 6;
      case '4kw': return 8;
      case '5kw': return 9;
      case '6kw': return 11;
      case '8kw': return 15;
      default: return 0;
    }
  }

  // Render panel serial photo inputs inside #panelSerialsGrid
  function renderPanelSerialPhotoInputs(plantType, backendPhotos) {
    if (!panelSerialsGrid) return;
    panelSerialsGrid.innerHTML = '';
    const count = serialsCountForPlant(plantType);
    for (let i = 0; i < count; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'photo-upload';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'photo-label';
      labelDiv.textContent = `Panel S.No. ${i+1}`;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.className = 'file-input';
      input.id = `panelSerial_${i}`;
      input.dataset.sectionId = 'panelSerials';
      input.dataset.photoType = `Panel S.No. ${i+1}`;

      const fileLabel = document.createElement('label');
      fileLabel.htmlFor = input.id;
      fileLabel.className = 'file-label';
      fileLabel.innerHTML = `<i class="fas fa-camera"></i><span>Tap to capture</span>`;

      const previewContainer = document.createElement('div');
      previewContainer.className = 'preview-container';
      const img = document.createElement('img');
      img.className = 'preview';
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', () => {
        input.value = '';
        img.src = '';
        previewContainer.style.display = 'none';
  // Restore the capture placeholder when preview is removed
  fileLabel.style.display = 'flex';
        if (formData.photos && formData.photos['panelSerials']) {
          delete formData.photos['panelSerials'][input.dataset.photoType];
          if (Object.keys(formData.photos['panelSerials']).length === 0) delete formData.photos['panelSerials'];
        }
        if (formData.geolocations && formData.geolocations['panelSerials']) {
          delete formData.geolocations['panelSerials'][input.dataset.photoType];
          if (Object.keys(formData.geolocations['panelSerials']).length === 0) delete formData.geolocations['panelSerials'];
        }
        saveToLocalStorage();
        updateSectionStatuses();
      });

      previewContainer.appendChild(img);
      previewContainer.appendChild(removeBtn);

      wrapper.appendChild(labelDiv);
      wrapper.appendChild(input);
      wrapper.appendChild(fileLabel);
      wrapper.appendChild(previewContainer);

      // If backendPhotos provided, show URL
      const existingUrl = backendPhotos && backendPhotos[i] ? backendPhotos[i].imageUrl : null;
      if (existingUrl) {
        if (!formData.photos) formData.photos = {};
        if (!formData.photos['panelSerials']) formData.photos['panelSerials'] = {};
        formData.photos['panelSerials'][`Panel S.No. ${i+1}`] = existingUrl;
        img.src = existingUrl;
  // Show preview and hide the capture placeholder
  previewContainer.style.display = 'block';
  fileLabel.style.display = 'none';
      }

      input.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
          const photoUploadDiv = input.closest('.photo-upload');
          
          // Show geolocation capturing status
          showGeolocationStatus(photoUploadDiv, 'capturing');
          fileLabel.classList.add('capturing');
          
          // Show notification about location capture
          showNotification("📍 Capturing location data for photo...", "info");
          
          // Capture geolocation when photo is taken
          const geolocation = await getCurrentLocation();
          
          // Update geolocation status based on result
          if (geolocation) {
            showGeolocationStatus(photoUploadDiv, 'success', geolocation.address);
            showNotification(`📍 Location captured: ${geolocation.address}`, "success");
          } else {
            showGeolocationStatus(photoUploadDiv, 'error');
            showNotification("⚠️ Location unavailable - photo saved without location", "info");
          }
          
          fileLabel.classList.remove('capturing');
          
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (!formData.photos) formData.photos = {};
            if (!formData.photos['panelSerials']) formData.photos['panelSerials'] = {};
            if (!formData.geolocations) formData.geolocations = {};
            if (!formData.geolocations['panelSerials']) formData.geolocations['panelSerials'] = {};
            
            formData.photos['panelSerials'][input.dataset.photoType] = dataUrl;
            formData.geolocations['panelSerials'][input.dataset.photoType] = geolocation;
            
            saveToLocalStorage();
            img.src = dataUrl;
            // Show preview and hide the capture placeholder
            previewContainer.style.display = 'block';
            fileLabel.style.display = 'none';
            updateSectionStatuses();
            
            // Hide geolocation status after preview is shown
            setTimeout(() => {
              hideGeolocationStatus(photoUploadDiv);
            }, 5000); // Increased to 5 seconds for address visibility
          };
          reader.readAsDataURL(file);
        }
      });

      panelSerialsGrid.appendChild(wrapper);
    }
  }

  // Technician select change
  if (technicianSelect) {
    technicianSelect.addEventListener('change', function () {
      const tech = technicianSelect.value;
      if (!formData) formData = {};
      formData.technician = tech;
      if (displayTechnician) displayTechnician.textContent = tech || '-';
      saveToLocalStorage();
      if (currentCustomerId) debounceSaveCustomer();
    });
  }

  // Debounced save of technician / panelSerials to backend
  let saveTimeout = null;
  function debounceSaveCustomer() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (!currentCustomerId) return;
      try {
        const payload = Object.assign({}, formData.customer || {}, {
          name: (formData.customer && formData.customer.name) || displayCustomerName.textContent || '',
          district: (formData.customer && formData.customer.district) || displayDistrict.textContent || '',
          plantType: (formData.customer && formData.customer.plantType) || displayPlantType.textContent || '',
          mobile: (formData.customer && formData.customer.mobile) || displayMobile.textContent || '',
          address: (formData.customer && formData.customer.address) || '',
          technician: formData.technician || ''
        });
        const resp = await fetch(`${API_BASE_URL}/customers/${currentCustomerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('Failed saving customer extras');
        const updated = await resp.json();
        // Refresh local copy
        formData.customer = {
          name: updated.name,
          district: updated.district,
          plantType: updated.plantType,
          mobile: updated.mobile,
          address: updated.address || ''
        };
  formData.technician = updated.technician || '';
        saveToLocalStorage();
      } catch (err) {
        console.error('Failed to save customer extras:', err);
      }
    }, 600);
  }

  // No QR scanning — panel serials are handled as photo uploads in the panelSerials section

  // Load data from local storage
  function loadFromLocalStorage() {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    // console.log("Loading formData from local storage savedData:", savedData);
    if (savedData) {
      formData = JSON.parse(savedData);

      console.log("Loaded formData from local storage:", formData);

      // Populate customer details form (if visible)
      customerNameInput.value = formData.customer.name || "";
      districtInput.value = formData.customer.district || "";
      plantTypeSelect.value = formData.customer.plantType || "";
      mobileInput.value = formData.customer.mobile || "";
      addressInput.value = formData.customer.address || "";

      // If a customer ID is present, display customer details and photo sections
      if (formData.currentCustomerId) {
        currentCustomerId = formData.currentCustomerId;
        displayCustomerDetails(formData.customer); // This will handle UI visibility
        updateSectionStatuses(); // Update statuses based on loaded data
      } else {
        // No customer active, ensure form is visible and photo sections are hidden
        customerFormSection.classList.remove("hidden");
        customerDisplaySection.classList.add("hidden");
        photoSectionsContainer.classList.add("hidden");
      }

  // Populate photo previews
      photoInputs.forEach((input) => {
        const sectionId = input.dataset.sectionId;
        const photoType = input.dataset.photoType;
        const previewContainer = input.nextElementSibling.nextElementSibling; // Get preview container
        const previewImg = previewContainer.querySelector(".preview");
        const fileLabel = input.nextElementSibling;

        if (formData.photos[sectionId] && formData.photos[sectionId]) {
          const dataUrl = formData.photos[sectionId][photoType];
          previewImg.src = dataUrl;
          previewContainer.style.display = "block";
          fileLabel.style.display = "none";
        } else {
          previewImg.src = "";
          previewContainer.style.display = "none";
          fileLabel.style.display = "flex";
        }
      });
      // Render dynamic panelSerials inputs if present
      if (panelSerialsGrid) {
        const backend = (formData.backendSections && formData.backendSections.panelSerials) ? formData.backendSections.panelSerials.photos : null;
        renderPanelSerialPhotoInputs(formData.customer.plantType, backend);
      }
    } else {
      // If no saved data, ensure form is visible and photo sections are hidden
      customerFormSection.classList.remove("hidden");
      customerDisplaySection.classList.add("hidden");
      photoSectionsContainer.classList.add("hidden");
    }
  }

  // Clear a specific photo input and its preview
  function clearPhotoInput(inputElement) {
    const sectionId = inputElement.dataset.sectionId;
    const photoType = inputElement.dataset.photoType;
    const previewContainer = inputElement.nextElementSibling.nextElementSibling;
    const previewImg = previewContainer.querySelector(".preview");
    const fileLabel = inputElement.nextElementSibling;

    if (previewImg) {
      previewImg.src = ""; // Clear preview image
    }
    previewContainer.style.display = "none";
    fileLabel.style.display = "flex";
    inputElement.value = ""; // Clear file input

    // Remove from formData
    if (formData.photos[sectionId]) {
      delete formData.photos[sectionId][photoType];
      if (Object.keys(formData.photos[sectionId]).length === 0) {
        delete formData.photos[sectionId];
      }
    }
    
    // Remove geolocation data
    if (formData.geolocations && formData.geolocations[sectionId]) {
      delete formData.geolocations[sectionId][photoType];
      if (Object.keys(formData.geolocations[sectionId]).length === 0) {
        delete formData.geolocations[sectionId];
      }
    }
    
    saveToLocalStorage();
    updateSectionStatuses();
  }

  // Display customer details and hide form
  function displayCustomerDetails(customer) {
    displayCustomerName.textContent = customer.name;
    displayDistrict.textContent = customer.district;
    displayPlantType.textContent = customer.plantType;
    displayMobile.textContent = customer.mobile;
    // Optionally display address if you add it to the UI
  // Technician display
  if (displayTechnician) displayTechnician.textContent = (customer.technician && customer.technician.length) ? customer.technician : '-';
  // Render panel serial photo inputs according to plant type and backend photos
  if (panelSerialsGrid) {
    const backendPhotos = (formData.backendSections && formData.backendSections.panelSerials) ? formData.backendSections.panelSerials.photos : null;
    renderPanelSerialPhotoInputs(customer.plantType, backendPhotos);
  }

    customerFormSection.classList.add("hidden");
    customerDisplaySection.classList.remove("hidden");
    photoSectionsContainer.classList.remove("hidden");

    saveToLocalStorage();
  }

  // Fetch customer from backend and populate frontend state (status, photos)
  // If mergeLocal=true, merge local formData.photos (data URLs) with server imageUrls: prefer server URLs.
  async function fetchCustomerFromServer(customerId, mergeLocal = false) {
    try {
      const resp = await fetch(`${API_BASE_URL}/customers/${customerId}`);
      if (!resp.ok) throw new Error('Failed to fetch customer from server');
      const customer = await resp.json();

      console.log("Fetched customer from server:", customer);
      // Update local state
      currentCustomerId = customer._id;
      formData.currentCustomerId = customer._id;
      formData.customer = {
        name: customer.name,
        district: customer.district,
        plantType: customer.plantType,
        mobile: customer.mobile,
        address: customer.address || ''
      };

  // store technician in formData
  formData.technician = customer.technician || '';

  // Build backendSections from server (include panelSerials)
  const backendSections = {};
  ["panelSerials","module", "inverter", "la", "earthing", "acdb", "dcdb", "wifi", "tightness"].forEach((sectionKey) => {
        if (customer[sectionKey]) {
          backendSections[sectionKey] = {
            status: customer[sectionKey].status,
            photos: customer[sectionKey].photos
          };
        }
      });

      // Merge local photos with server photos
      const mergedPhotos = {};
      // Start with server images (authoritative for uploaded photos)
      Object.keys(backendSections).forEach((sectionId) => {
        const sectionPhotos = backendSections[sectionId].photos || [];
        sectionPhotos.forEach((photo) => {
          if (!mergedPhotos[sectionId]) mergedPhotos[sectionId] = {};
          if (photo.imageUrl) mergedPhotos[sectionId][photo.title] = photo.imageUrl;
        });
      });

      // If mergeLocal, prefer server URLs but keep local data URLs where server lacks them
      if (mergeLocal && formData.photos) {
        Object.keys(formData.photos).forEach((sectionId) => {
          const sectionObj = formData.photos[sectionId];
          Object.keys(sectionObj).forEach((title) => {
            const val = sectionObj[title];
            const isDataUrl = typeof val === 'string' && val.startsWith('data:');
            if (!mergedPhotos[sectionId]) mergedPhotos[sectionId] = {};
            // If server already has a URL for this title, keep it; otherwise keep local (data URL)
            if (!mergedPhotos[sectionId][title]) {
              mergedPhotos[sectionId][title] = val;
            } else {
              // server has value, keep server (no-op)
            }
          });
        });
      }

      // If not merging, replace with server images only
      formData.backendSections = backendSections;
      formData.photos = mergedPhotos;

      // Render dynamic panelSerials inputs now that we have backend info
      if (panelSerialsGrid) {
        const backend = backendSections.panelSerials ? backendSections.panelSerials.photos : null;
        renderPanelSerialPhotoInputs(formData.customer.plantType, backend);
      }

  // ensure technician and serials are reflected in UI
  if (technicianSelect) technicianSelect.value = formData.technician || '';
  if (displayTechnician) displayTechnician.textContent = formData.technician || '-';
  // panel serials are rendered as photo inputs via renderPanelSerialPhotoInputs

      saveToLocalStorage();
      displayCustomerDetails(customer);
      updateSectionStatuses();
    } catch (err) {
      console.error('Error fetching customer from server:', err);
    }
  }

  // Hide customer details and show form
  function showCustomerForm() {
    customerFormSection.classList.remove("hidden");
    customerDisplaySection.classList.add("hidden");
    photoSectionsContainer.classList.add("hidden");
    currentCustomerId = null;
    formData.currentCustomerId = null; // Clear from local storage data
    formData.photos = {}; // Clear photos from local storage when changing customer
    formData.geolocations = {}; // Clear geolocations from local storage when changing customer
    saveToLocalStorage();
    // Optionally clear form fields
    customerNameInput.value = "";
    districtInput.value = "";
    plantTypeSelect.value = "";
    mobileInput.value = "";
    // Reset all photo previews
    photoInputs.forEach((input) => {
      const previewContainer = input.nextElementSibling.nextElementSibling;
      const previewImg = previewContainer.querySelector(".preview");
      const fileLabel = input.nextElementSibling;
      previewImg.src = "";
      previewContainer.style.display = "none";
      fileLabel.style.display = "flex";
      input.value = "";
    });
    updateSectionStatuses(); // All sections will be pending
  }

  // Update section statuses based on formData
  function updateSectionStatuses() {
    // If we have loaded a customer from backend, use backend status
    if (formData.customer && formData.currentCustomerId && formData.backendSections) {
      document.querySelectorAll(".photo-section").forEach((section) => {
        const sectionId = section.dataset.sectionId;
        const statusDiv = section.querySelector(".status");
        const backendSection = formData.backendSections[sectionId];
        if (statusDiv && backendSection) {
          if (backendSection.status === "completed") {
            statusDiv.classList.remove("status-pending");
            statusDiv.classList.add("status-completed");
            statusDiv.textContent = "Completed";
          } else {
            statusDiv.classList.remove("status-completed");
            statusDiv.classList.add("status-pending");
            statusDiv.textContent = "Pending";
          }
        }
      });
    } else {
      // Fallback: local logic
      document.querySelectorAll(".photo-section").forEach((section) => {
        const sectionId = section.dataset.sectionId;
        const statusDiv = section.querySelector(".status");
        const inputsInSection = section.querySelectorAll(".file-input");
        let allPhotosPresent = true;
        if (statusDiv && !statusDiv.classList.contains("status-completed")) {
          inputsInSection.forEach((input) => {
            if (!(input.files && input.files[0])) {
              allPhotosPresent = false;
            }
          });
          if (allPhotosPresent && inputsInSection.length > 0) {
            statusDiv.classList.remove("status-pending");
            statusDiv.textContent = "Pending";
            statusDiv.classList.add("status-pending");
          } else {
            statusDiv.classList.remove("status-completed");
            statusDiv.textContent = "Pending";
            statusDiv.classList.add("status-pending");
          }
        }
      });
    }
  }

  // Event Listeners for Customer Details Inputs (for local storage persistence)
  customerNameInput.addEventListener("input", () => {
    formData.customer.name = customerNameInput.value;
    saveToLocalStorage();
  });

  districtInput.addEventListener("input", () => {
    formData.customer.district = districtInput.value;
    saveToLocalStorage();
  });

  plantTypeSelect.addEventListener("change", () => {
    formData.customer.plantType = plantTypeSelect.value;
    saveToLocalStorage();
  });

  mobileInput.addEventListener("input", () => {
    formData.customer.mobile = mobileInput.value;
    saveToLocalStorage();
  });

  addressInput.addEventListener("input", () => {
    formData.customer.address = addressInput.value;
    saveToLocalStorage();
  });

  // Event Listener for Create New Customer Button
  createCustomerBtn.addEventListener("click", async function () {
    const name = customerNameInput.value.trim();
    const district = districtInput.value.trim();
    const plantType = plantTypeSelect.value;
    const mobile = mobileInput.value.trim();
    const address = addressInput.value.trim();

    if (!name || !district || !plantType || !mobile || !address) {
      showNotification("Please fill all required customer details.", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, district, plantType, mobile, address }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create customer");
      }

      const customer = await response.json();
      currentCustomerId = customer._id;
  // Display and then fetch authoritative backend state
  displayCustomerDetails(customer);
  await fetchCustomerFromServer(customer._id);
      showNotification("Customer created successfully!", "success");
      // Clear any old photo data from local storage for new customer
      formData.photos = {};
      saveToLocalStorage();
      updateSectionStatuses(); // All sections will be pending for a new customer
    } catch (error) {
      console.error("Error creating customer:", error);
      showNotification("Error creating customer: " + error.message, "error");
    }
  });

  // Edit current customer details - show form populated and allow save
  editCustomerBtn.addEventListener('click', function () {
    if (!formData || !formData.customer) return;
    // Show the form and populate fields
    customerFormSection.classList.remove('hidden');
    customerDisplaySection.classList.add('hidden');
    photoSectionsContainer.classList.add('hidden');

    customerNameInput.value = formData.customer.name || '';
    districtInput.value = formData.customer.district || '';
    plantTypeSelect.value = formData.customer.plantType || '';
    mobileInput.value = formData.customer.mobile || '';
    addressInput.value = formData.customer.address || '';

    // Toggle buttons: hide create/add, show save
    createCustomerBtn.classList.add('hidden');
    addExistingCustomerBtn.classList.add('hidden');
    saveCustomerBtn.classList.remove('hidden');
  });

  // Save updated customer details
  saveCustomerBtn.addEventListener('click', async function () {
    if (!currentCustomerId) {
      showNotification('No customer selected to edit.', 'error');
      return;
    }

    const name = customerNameInput.value.trim();
    const district = districtInput.value.trim();
    const plantType = plantTypeSelect.value;
    const mobile = mobileInput.value.trim();
    const address = addressInput.value.trim();

    if (!name || !district || !plantType || !mobile || !address) {
      showNotification('Please fill all required customer details before saving.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${currentCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, district, plantType, mobile, address })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update customer');
      }

      const updated = await response.json();
      // Update local state and UI
      formData.customer = {
        name: updated.name,
        district: updated.district,
        plantType: updated.plantType,
        mobile: updated.mobile,
        address: updated.address || ''
      };
      saveToLocalStorage();

      // Reset UI toggles
      saveCustomerBtn.classList.add('hidden');
      createCustomerBtn.classList.remove('hidden');
      addExistingCustomerBtn.classList.remove('hidden');

      // Return to display mode and refresh backendSections
      await fetchCustomerFromServer(currentCustomerId, true);
      showNotification('Customer details updated successfully.', 'success');
    } catch (err) {
      console.error('Error updating customer:', err);
      showNotification('Error updating customer: ' + err.message, 'error');
    }
  });

  // Event Listener for Add Existing Customer Button
  addExistingCustomerBtn.addEventListener("click", async function () {
    const name = customerNameInput.value.trim();
    const district = districtInput.value.trim();
    const mobile = mobileInput.value.trim();

    if (!name && !district && !mobile) {
      showNotification(
        "Please enter at least one search criteria (Name, District, or Mobile Number).",
        "info"
      );
      return;
    }

    try {
      const params = new URLSearchParams();
      if (name) params.append("name", name);
      if (district) params.append("district", district);
      if (mobile) params.append("mobile", mobile);

      const response = await fetch(
        `${API_BASE_URL}/customers?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to search for customer");
      }

      const customers = await response.json();

      if (customers.length === 0) {
        showNotification(
          "No customer found with the provided details.",
          "info"
        );
        return;
      }

  // For simplicity, take the first matching customer and load authoritative state from backend
  const customer = customers[0];
  await fetchCustomerFromServer(customer._id);
  showNotification("Customer found and loaded!", "success");
    } catch (error) {
      console.error("Error searching for customer:", error);
      showNotification(
        "Error searching for customer: " + error.message,
        "error"
      );
    }
  });

  // Event Listener for Change Customer Button
  changeCustomerBtn.addEventListener("click", showCustomerForm);

  // Event Listeners for Photo Inputs
  photoInputs.forEach((input) => {
    input.addEventListener("change", async (event) => {
      const file = event.target.files[0]; // Get the single file
      const sectionId = input.closest(".photo-section").dataset.sectionId;
      const photoType = input.dataset.photoType;
      const previewContainer = input.nextElementSibling.nextElementSibling;
      const previewImg = previewContainer.querySelector(".preview");
      const fileLabel = input.nextElementSibling;
      const photoUploadDiv = input.closest(".photo-upload");
      
      console.log(
        `file : ${file}, sectionID : ${sectionId}, photoType : ${photoType}`
      );

      if (file) {
        // Show geolocation capturing status
        showGeolocationStatus(photoUploadDiv, 'capturing');
        fileLabel.classList.add('capturing');
        
        // Show notification about location capture
        showNotification("📍 Capturing location data for photo...", "info");
        
        // Capture geolocation when photo is taken
        const geolocation = await getCurrentLocation();
        
        // Update geolocation status based on result
        if (geolocation) {
          showGeolocationStatus(photoUploadDiv, 'success', geolocation.address);
          showNotification(`📍 Location captured: ${geolocation.address}`, "success");
        } else {
          showGeolocationStatus(photoUploadDiv, 'error');
          showNotification("⚠️ Location unavailable - photo saved without location", "info");
        }
        
        fileLabel.classList.remove('capturing');
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          if (!formData.photos[sectionId]) {
            formData.photos[sectionId] = {};
          }
          if (!formData.geolocations) {
            formData.geolocations = {};
          }
          if (!formData.geolocations[sectionId]) {
            formData.geolocations[sectionId] = {};
          }
          
          formData.photos[sectionId][photoType] = dataUrl; // Store specific photo type
          formData.geolocations[sectionId][photoType] = geolocation; // Store geolocation
          
          saveToLocalStorage();
          console.log(formData);
          
          // Display preview
          if (previewImg) {
            previewImg.src = dataUrl;
            previewContainer.style.display = "block";
            fileLabel.style.display = "none";
            
            // Hide geolocation status after preview is shown
            setTimeout(() => {
              hideGeolocationStatus(photoUploadDiv);
            }, 5000); // Increased to 5 seconds for address visibility
          }
          updateSectionStatuses();
        };
        reader.readAsDataURL(file);
      } else {
        // If file is cleared, remove from data and preview
        clearPhotoInput(input);
      }
    });
  });

  // Event Listeners for Remove Photo Buttons
  removePhotoBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      const previewContainer = this.parentElement;
      const fileInput =
        previewContainer.previousElementSibling.previousElementSibling; // Get the file input
      clearPhotoInput(fileInput);
    });
  });

  // Event Listeners for Section Submit Buttons
  sectionSubmitBtns.forEach((button) => {
    button.addEventListener("click", async function () {
      const sectionId = button.dataset.sectionId;
      const section = document.querySelector(`.photo-section[data-section-id='${sectionId}']`);
      const inputsInSection = section.querySelectorAll(".file-input");
      let photoFiles = [];
      let photoTypes = [];
      let missingPhotos = [];

      // Gather all photo files and types for this section
      let geolocations = [];
      inputsInSection.forEach((input) => {
        const photoType = input.dataset.photoType;
        if (input.files && input.files[0]) {
          photoFiles.push(input.files[0]);
          photoTypes.push(photoType);
          // Get geolocation for this photo
          const geolocation = formData.geolocations && formData.geolocations[sectionId] 
            ? formData.geolocations[sectionId][photoType] 
            : null;
          geolocations.push(geolocation);
        } else if (formData.photos[sectionId] && formData.photos[sectionId][photoType]) {
          // Use Data URL from local storage if file input is empty
          const dataUrl = formData.photos[sectionId][photoType];
          const blob = dataURLtoBlob(dataUrl);
          photoFiles.push(blob);
          photoTypes.push(photoType);
          // Get geolocation for this photo
          const geolocation = formData.geolocations && formData.geolocations[sectionId] 
            ? formData.geolocations[sectionId][photoType] 
            : null;
          geolocations.push(geolocation);
        } else {
          missingPhotos.push(photoType);
        }
      });

      if (missingPhotos.length > 0 || photoFiles.length === 0) {
        showNotification("Please select all required photos before submitting this section.", "error");
        return;
      }

      // Prepare FormData for upload
      const formDataUpload = new FormData();
      console.log("photoFiles:");
      console.log("photoFiles:", photoFiles);
      photoFiles.forEach((file, idx) => {
        // If Blob, give a filename
        console.log("photoFiles:", file);
        if (file instanceof Blob && !(file instanceof File)) {
          formDataUpload.append("photos", file, `${photoTypes[idx]}.jpg`);
        } else {
          formDataUpload.append("photos", file);
        }
      });
      formDataUpload.append("section", sectionId);
      formDataUpload.append("photoTypes", JSON.stringify(photoTypes));
      formDataUpload.append("geolocations", JSON.stringify(geolocations));
      console.log(`Submitting section: ${sectionId} with photos:`, photoFiles);
      console.log(`Geolocations for section ${sectionId}:`, geolocations);
      console.log(`FormData for section ${sectionId}:`, formDataUpload);

      try {
        const notifId = `upload-section-${sectionId}`;
        showPersistentNotification(notifId, `Uploading photos for ${sectionId}...`);
        const response = await fetch(`${API_BASE_URL}/photos/${currentCustomerId}`, {
          method: "POST",
          body: formDataUpload,
        });
        if (!response.ok) {
          const error = await response.json();
          removePersistentNotification(notifId);
          showNotification(`Failed to submit section: ${JSON.stringify(error)}`, "error");
          return;
        }
        // On success, update backendSections status for this section
        const result = await response.json();
        if (!formData.backendSections) formData.backendSections = {};
        formData.backendSections[sectionId] = {
          status: result.status,
          photos: result.photos
        };
        // Update local photo previews with Cloudinary URLs
        if (!formData.photos[sectionId]) formData.photos[sectionId] = {};
        result.photos.forEach((photo) => {
          if (photo.imageUrl) {
            formData.photos[sectionId][photo.title] = photo.imageUrl;
          }
        });
  removePersistentNotification(notifId);
  saveToLocalStorage();
  updateSectionStatuses();
  showNotification("Section submitted successfully!", "success");
      } catch (error) {
  removePersistentNotification(`upload-section-${sectionId}`);
  showNotification("Failed to submit section: " + error.message, "error");
      }
    });
  });

  // Event Listeners for Section Clear Buttons
  sectionClearBtns.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionElement = button.closest(".photo-section");
      const sectionId = sectionElement.dataset.sectionId;
      const inputsInSection = sectionElement.querySelectorAll(".file-input");

      inputsInSection.forEach((input) => {
        clearPhotoInput(input);
      });
      showNotification(
        `All photos for ${sectionId} cleared from local storage.`,
        "info"
      );
    });
  });

  // Event Listener for Submit All Button (Top Header)
  submitAllBtn.addEventListener("click", async () => {
    if (!currentCustomerId) {
      showNotification("Please create or select a customer first.", "error");
      return;
    }

    if (
      !confirm("Are you sure you want to submit all currently selected photos?")
    ) {
      return;
    }

    let allSectionsSubmittedSuccessfully = true;

    // Iterate through each section and submit its photos
    for (const sectionId in formData.photos) {
      const sectionElement = document.querySelector(
        `.photo-section[data-section-id="${sectionId}"]`
      );
      if (!sectionElement) continue; // Skip if section element not found

      const inputsInSection = sectionElement.querySelectorAll(".file-input");
      const photosToUpload = [];
      const photoTypesToUpload = [];

      inputsInSection.forEach((input) => {
        const photoType = input.dataset.photoType;
        if (formData.photos[sectionId] && formData.photos[sectionId]) {
          const dataUrl = formData.photos[sectionId][photoType];
          const blob = dataURLtoBlob(dataUrl);
          photosToUpload.push(blob);
          photoTypesToUpload.push(photoType);
        }
      });

      if (photosToUpload.length > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append("section", sectionId);
        photosToUpload.forEach((photoBlob, index) => {
          uploadFormData.append("photos", photoBlob, `photo_${index}.jpeg`);
        });
        uploadFormData.append("photoTypes", JSON.stringify(photoTypesToUpload));
        const notifId = `upload-section-${sectionId}`;
        showPersistentNotification(notifId, `Uploading photos for ${sectionId}...`);
        try {
          const response = await fetch(`${API_BASE_URL}/photos/${currentCustomerId}`, {
            method: "POST",
            body: uploadFormData,
          });

          if (response.ok) {
            // Clear local storage for this section's photos
            inputsInSection.forEach((input) => {
              const photoType = input.dataset.photoType;
              if (formData.photos[sectionId] && formData.photos[sectionId]) {
                delete formData.photos[sectionId];
              }
            });
            if (formData.photos[sectionId] && Object.keys(formData.photos[sectionId]).length === 0) {
              delete formData.photos[sectionId];
            }
            saveToLocalStorage();
            updateSectionStatuses();
            removePersistentNotification(notifId);
          } else {
            allSectionsSubmittedSuccessfully = false;
            const errorText = await response.text();
            console.error(`Failed to submit section ${sectionId}:`, errorText);
            removePersistentNotification(notifId);
            showNotification(`Failed to submit photos for ${sectionId}.`, "error");
          }
        } catch (error) {
          allSectionsSubmittedSuccessfully = false;
          console.error(`Error submitting section ${sectionId}:`, error);
          removePersistentNotification(notifId);
          showNotification(`An error occurred submitting photos for ${sectionId}.`, "error");
        }
      }
    }

    if (allSectionsSubmittedSuccessfully) {
      showNotification(
        "All selected photos submitted successfully!",
        "success"
      );
    } else {
      showNotification(
        "Some photos failed to submit. Check console for details.",
        "error"
      );
    }
  });

  // Event Listener for Clear All Button (Top Header)
  clearAllBtn.addEventListener("click", () => {
    if (
      !confirm(
        "Are you sure you want to clear all data from this page (including local storage)? This will not affect already uploaded photos on the server."
      )
    ) {
      return;
    }

    showCustomerForm(); // This function already handles clearing form, local storage, and resetting UI
    showNotification("All local data cleared.", "info");
  });

  // Load data when the page loads
  loadFromLocalStorage();
});


// Function to show notification (kept outside DOMContentLoaded for global access)
function showNotification(message, type) {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
        <div>${message}</div>
        <button class="close-btn"><i class="fas fa-times"></i></button>
    `;

  // Add to body
  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);

  // Close button
  notification.querySelector(".close-btn").addEventListener("click", () => {
    notification.remove();
  });
}

// Show a persistent notification (returns id used to remove it)
function showPersistentNotification(id, message) {
  // If exists, update text
  let existing = document.getElementById(id);
  if (existing) {
    existing.querySelector('div').textContent = message;
    return id;
  }
  const notification = document.createElement('div');
  notification.className = `notification info`;
  notification.id = id;
  notification.innerHTML = `
        <div>${message}</div>
        <button class="close-btn"><i class="fas fa-times"></i></button>
    `;
  // Close button removes it
  notification.querySelector('.close-btn').addEventListener('click', () => notification.remove());
  document.body.appendChild(notification);
  return id;
}

function removePersistentNotification(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

