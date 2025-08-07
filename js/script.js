const API_BASE_URL = "http://localhost:5000/api"; // Update with your backend URL
let currentCustomerId = null;
const LOCAL_STORAGE_KEY = "kamnSolarFormData";

// Data structure to hold form data and photo URLs
let formData = {
  customer: {
    name: "",
    district: "",
    plantType: "",
    mobile: "",
    address: ""
  },
  photos: {}, // { sectionId: { photoType: dataURL,... },... }
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
  // Add address display if needed

  const createCustomerBtn = document.getElementById("createCustomerBtn");
  const addExistingCustomerBtn = document.getElementById(
    "addExistingCustomerBtn"
  );
  const changeCustomerBtn = document.getElementById("changeCustomerBtn");

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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
  }

  // Load data from local storage
  function loadFromLocalStorage() {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
      formData = JSON.parse(savedData);

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
      delete formData.photos[sectionId];
      if (Object.keys(formData.photos[sectionId]).length === 0) {
        delete formData.photos[sectionId];
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

    customerFormSection.classList.add("hidden");
    customerDisplaySection.classList.remove("hidden");
    photoSectionsContainer.classList.remove("hidden");

    // Store customer ID in formData for persistence
    formData.currentCustomerId = customer._id;
    saveToLocalStorage();
  }

  // Hide customer details and show form
  function showCustomerForm() {
    customerFormSection.classList.remove("hidden");
    customerDisplaySection.classList.add("hidden");
    photoSectionsContainer.classList.add("hidden");
    currentCustomerId = null;
    formData.currentCustomerId = null; // Clear from local storage data
    formData.photos = {}; // Clear photos from local storage when changing customer
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
    document.querySelectorAll(".photo-section").forEach((section) => {
      const sectionId = section.dataset.sectionId;
      const statusDiv = section.querySelector(".status");
      const inputsInSection = section.querySelectorAll(".file-input");
      let allPhotosPresent = true;
      // Only set to pending if not completed
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
      displayCustomerDetails(customer);
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

      // For simplicity, take the first matching customer
      const customer = customers[0]; // Backend returns an array, take the first one
      console.log("in no display", customer);
      currentCustomerId = customer._id;
      formData.customer = {
        // Update formData.customer with fetched data
        name: customer.name,
        district: customer.district,
        plantType: customer.plantType,
        mobile: customer.mobile,
        address: customer.address || ""
      };
      displayCustomerDetails(customer); // Load existing photos for this customer into local storage
      showNotification("Customer found and loaded!", "success");

      formData.photos = {}; // Clear previous photos
      // Iterate through all photo arrays in the fetched customer object
      const sections = [
        "module", "inverter", "la", "earthing", "acdb", "dcdb", "wifi", "tightness"
      ];
      sections.forEach((sectionKey) => {
        if (customer[sectionKey] && customer[sectionKey].photos) {
          const sectionId = sectionKey;
          customer[sectionKey].photos.forEach((photo) => {
            if (photo.driveId && photo.imageUrl) {
              if (!formData.photos[sectionId]) {
                formData.photos[sectionId] = {};
              }
              formData.photos[sectionId][photo.title] = photo.imageUrl;
            }
          });
        }
      });
      saveToLocalStorage();
      loadFromLocalStorage(); // Re-load to update previews and statuses
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
    input.addEventListener("change", (event) => {
      const file = event.target.files[0]; // Get the single file
      const sectionId = input.closest(".photo-section").dataset.sectionId;
      const photoType = input.dataset.photoType;
      const previewContainer = input.nextElementSibling.nextElementSibling;
      const previewImg = previewContainer.querySelector(".preview");
      const fileLabel = input.nextElementSibling;
      console.log(
        `file : ${file}, sectionID : ${sectionId}, photoType : ${photoType}`
      );

      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          if (!formData.photos[sectionId]) {
            formData.photos[sectionId] = {};
          }
          formData.photos[sectionId][photoType] = dataUrl; // Store specific photo type
          saveToLocalStorage();
          console.log(formData);
          // Display preview
          if (previewImg) {
            previewImg.src = dataUrl;
            previewContainer.style.display = "block";
            fileLabel.style.display = "none";
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
      console.log("inputsInSection",inputsInSection)
      let allPhotosPresent = true;
      let photoFiles = [];
      let photoTypes = [];

      // Gather all photo files and types for this section
      inputsInSection.forEach((input) => {
        if (input.files && input.files[0]) {
          photoFiles.push(input.files[0]);
          photoTypes.push(input.dataset.photoType);
        } else {
          allPhotosPresent = false;
        }
      });

      if (!allPhotosPresent || photoFiles.length === 0) {
        showNotification("Please select all required photos before submitting this section.", "error");
        return;
      }

      // Prepare FormData for upload
      const formDataUpload = new FormData();
      photoFiles.forEach((file) => formDataUpload.append("photos", file));
      formDataUpload.append("section", sectionId);
      formDataUpload.append("photoTypes", photoTypes);

      try {
        const response = await fetch(`${API_BASE_URL}/photos/${currentCustomerId}`, {
          method: "POST",
          body: formDataUpload,
        });
        if (!response.ok) {
          const error = await response.json();
          showNotification(`Failed to submit section: ${JSON.stringify(error)}`, "error");
          return;
        }
        // On success, update status to completed
        const statusDiv = section.querySelector(".status");
        if (statusDiv) {
          statusDiv.classList.remove("status-pending");
          statusDiv.classList.add("status-completed");
          statusDiv.textContent = "Completed";
        }
        showNotification("Section submitted successfully!", "success");
      } catch (error) {
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

        try {
          const response = await fetch(
            `${API_BASE_URL}/photos/${currentCustomerId}`,
            {
              method: "POST",
              body: uploadFormData,
            }
          );

          if (response.ok) {
            // Clear local storage for this section's photos
            inputsInSection.forEach((input) => {
              const photoType = input.dataset.photoType;
              if (formData.photos[sectionId] && formData.photos[sectionId]) {
                delete formData.photos[sectionId];
              }
            });
            if (
              formData.photos[sectionId] &&
              Object.keys(formData.photos[sectionId]).length === 0
            ) {
              delete formData.photos[sectionId];
            }
            saveToLocalStorage();
            updateSectionStatuses();
          } else {
            allSectionsSubmittedSuccessfully = false;
            const errorText = await response.text();
            console.error(`Failed to submit section ${sectionId}:`, errorText);
            showNotification(
              `Failed to submit photos for ${sectionId}.`,
              "error"
            );
          }
        } catch (error) {
          allSectionsSubmittedSuccessfully = false;
          console.error(`Error submitting section ${sectionId}:`, error);
          showNotification(
            `An error occurred submitting photos for ${sectionId}.`,
            "error"
          );
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
