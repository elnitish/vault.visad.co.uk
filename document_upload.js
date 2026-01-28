console.oog("This is the document upload page");
$(document).ready(function () {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');
    const recordType = urlParams.get('type');

    let clientData = {
        personal: {},
        questions: {}
    };

    // Document categories
    const categories = ['insurance', 'flight', 'application', 'appointment', 'hotel'];

    // Store uploaded files per category
    let categoryFiles = {
        insurance: [],
        flight: [],
        application: [],
        appointment: [],
        hotel: []
    };

    // Maximum file size (2MB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024;

    // Check if required parameters are present
    if (!recordId || !recordType) {
        showError('Missing required parameters. Please access this page from the client form viewer.');
        return;
    }

    // Load client data
    loadClientData();

    async function loadClientData() {
        const session = await VaultAuth.requireAuth();
        if (!session) return;

        const endpoint = recordType === 'traveler' ? `/travelers/${recordId}` : `/dependents/${recordId}`;
        const url = VaultAuth.API_BASE_URL + endpoint;

        VaultAuth.apiCall({
            url: url,
            method: 'GET'
        }).done(function (res) {
            if (res.status === 'success' && res.data) {
                let flatData = { ...res.data };
                if (flatData.questions) {
                    flatData = { ...flatData, ...flatData.questions };
                }
                processClientData(flatData);
                loadExistingDocuments();
                showDocumentsSection();
            } else {
                showError(res.message || 'Failed to load client data.');
            }
        }).fail(function () {
            showError('Server request failed. Please try again.');
        });
    }

    function processClientData(flatData) {
        // Personal fields
        const personalFieldKeys = [
            'first_name', 'last_name', 'dob', 'nationality', 'passport_no',
            'travel_country', 'visa_type', 'visa_center', 'package'
        ];

        personalFieldKeys.forEach(key => {
            if (flatData[key] !== undefined) {
                clientData.personal[key] = flatData[key];
            }
        });

        // Update header with client info
        const fullName = ((clientData.personal.first_name || '') + ' ' + (clientData.personal.last_name || '')).trim();
        $('#client-name').text(fullName || 'Client Name');
        $('#visa-country').text(clientData.personal.travel_country || '-');
        $('#visa-type').text(clientData.personal.visa_type || '-');
        $('#application-city').text(clientData.personal.visa_center || '-');
        $('#package-type').text(clientData.personal.package || '-');
    }

    function loadExistingDocuments() {
        // Load existing documents from server for each category
        let loadedCount = 0;
        categories.forEach(category => {
            $.get(`api/documents.php?action=get_documents&id=${recordId}&type=${recordType}&category=${category}`, function (res) {
                if (res.status === 'success' && res.documents) {
                    categoryFiles[category] = res.documents;
                    renderFiles(category);
                }
                loadedCount++;

                // Update all button states after all categories are loaded
                if (loadedCount === categories.length) {
                    updateAllButtonStates();
                }
            }, 'json');
        });
    }

    function showDocumentsSection() {
        $('#loading-state').hide();
        $('#documents-section').show();
    }

    function showError(message) {
        $('#loading-state').hide();
        $('#error-message').text(message);
        $('#error-state').show();
    }

    // Trigger file upload
    window.triggerUpload = function (category) {
        $(`#file-${category}`).click();
    };

    // Handle file selection
    window.handleFileSelect = function (event, category) {
        const files = event.target.files;
        uploadFiles(files, category);
        // Reset input
        event.target.value = '';
    };

    function uploadFiles(files, category) {
        const validFiles = [];
        const errors = [];

        // Validate files
        Array.from(files).forEach(file => {
            // Check file size
            if (file.size > MAX_FILE_SIZE) {
                errors.push(`${file.name} exceeds 2MB limit`);
                return;
            }

            // Check file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                errors.push(`${file.name} has invalid file type`);
                return;
            }

            validFiles.push(file);
        });

        // Show errors if any
        if (errors.length > 0) {
            alert('Upload Errors:\n' + errors.join('\n'));
        }

        // Upload valid files
        if (validFiles.length > 0) {
            validFiles.forEach(file => {
                uploadSingleFile(file, category);
            });
        }
    }

    function uploadSingleFile(file, category) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('id', recordId);
        formData.append('type', recordType);
        formData.append('category', category);

        // Show upload progress (you can add a progress indicator here)

        $.ajax({
            url: 'api/documents.php?action=upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (res) {
                if (res.status === 'success') {
                    // Add file to category
                    categoryFiles[category].push(res.file);
                    renderFiles(category);

                    // Show success message
                    showNotification('File uploaded successfully!', 'success');
                } else {
                    showNotification('Upload failed: ' + res.message, 'error');
                }
            },
            error: function () {
                showNotification('Upload failed. Please try again.', 'error');
            }
        });
    }

    function renderFiles(category) {
        const files = categoryFiles[category];
        const container = $(`#files-${category}`);

        // Update file count
        $(`#count-${category}`).text(`${files.length} file${files.length !== 1 ? 's' : ''}`);

        // Update navigation button state
        updateNavigationButtonState(category, files.length);

        if (files.length === 0) {
            container.html(`
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No files uploaded yet</p>
                </div>
            `);
            return;
        }

        let html = '';
        files.forEach((file, index) => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const isPdf = fileExtension === 'pdf';
            const isImage = ['jpg', 'jpeg', 'png'].includes(fileExtension);

            const iconClass = isPdf ? 'fa-file-pdf pdf' : isImage ? 'fa-file-image image' : 'fa-file';
            const fileSize = formatFileSize(file.size);
            const uploadDate = formatDate(file.uploaded_at);

            html += `
                <div class="file-item" data-file-id="${file.id}">
                    <div class="file-info">
                        <i class="fas ${iconClass} file-icon"></i>
                        <div class="file-details">
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-meta">${fileSize} • Uploaded ${uploadDate}</div>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-view" onclick="viewFile('${category}', ${index})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-delete" onclick="confirmDelete('${category}', ${index})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });

        container.html(html);
    }

    function updateNavigationButtonState(category, fileCount) {
        // Map category names to button data-action values
        const categoryToAction = {
            'insurance': 'insurance',
            'flight': 'flight',
            'application': 'application-form',
            'appointment': 'appointment',
            'hotel': 'hotel'
        };

        const action = categoryToAction[category];
        if (action) {
            const button = $(`.action-btn[data-action="${action}"]`);
            if (fileCount > 0) {
                button.addClass('has-files');
            } else {
                button.removeClass('has-files');
            }
        }
    }

    function updateAllButtonStates() {
        // Update all button states on initial load
        categories.forEach(category => {
            const fileCount = categoryFiles[category].length;
            updateNavigationButtonState(category, fileCount);
        });
    }

    // View file
    window.viewFile = function (category, index) {
        const file = categoryFiles[category][index];
        if (file && file.url) {
            window.open(file.url, '_blank');
        }
    };

    // Confirm delete
    let deleteCallback = null;
    window.confirmDelete = function (category, index) {
        const file = categoryFiles[category][index];
        $('#delete-filename').text(file.name);
        $('#delete-modal').fadeIn(300);

        deleteCallback = function () {
            deleteFile(category, index);
        };
    };

    $('#delete-cancel').on('click', function () {
        $('#delete-modal').fadeOut(300);
        deleteCallback = null;
    });

    $('#delete-confirm').on('click', function () {
        if (deleteCallback) {
            deleteCallback();
            $('#delete-modal').fadeOut(300);
            deleteCallback = null;
        }
    });

    function deleteFile(category, index) {
        const file = categoryFiles[category][index];

        $.post('api/documents.php?action=delete', {
            id: recordId,
            type: recordType,
            file_id: file.id,
            category: category
        }, function (res) {
            if (res.status === 'success') {
                // Remove from array
                categoryFiles[category].splice(index, 1);
                renderFiles(category);
                showNotification('File deleted successfully!', 'success');
            } else {
                showNotification('Delete failed: ' + res.message, 'error');
            }
        }, 'json').fail(function () {
            showNotification('Delete failed. Please try again.', 'error');
        });
    }

    // Drag and drop functionality
    categories.forEach(category => {
        const uploadArea = $(`#upload-${category}`)[0];

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                $(uploadArea).addClass('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                $(uploadArea).removeClass('dragover');
            }, false);
        });

        uploadArea.addEventListener('drop', function (e) {
            const files = e.dataTransfer.files;
            uploadFiles(files, category);
        }, false);
    });

    // Navigation buttons
    $('.action-btn').on('click', function () {
        const action = $(this).data('action');

        if (action === 'locker-data') {
            window.location.href = `form_data_viewer.html?id=${recordId}&type=${recordType}`;
        } else if (action === 'covering-letter') {
            window.location.href = `covering_letter_schengen.html?id=${recordId}&type=${recordType}`;
        } else if (action === 'insurance' || action === 'flight' || action === 'application' || action === 'appointment' || action === 'hotel') {
            // Scroll to the relevant section
            const categoryElement = $(`.document-category:has(#upload-${action})`);
            if (categoryElement.length) {
                $('html, body').animate({
                    scrollTop: categoryElement.offset().top - 180
                }, 500);
            }
        }
    });

    // Sticky header scroll effect
    $(window).on('scroll', function () {
        const scrollTop = $(window).scrollTop();
        if (scrollTop > 50) {
            $('.client-info-header').addClass('scrolled');
        } else {
            $('.client-info-header').removeClass('scrolled');
        }
    });

    // Helper functions
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function showNotification(message, type) {
        // Simple notification (you can enhance this with a toast library)
        const bgColor = type === 'success' ? '#10b981' : '#ef4444';
        const notification = $(`
            <div style="
                position: fixed;
                top: 200px;
                right: 20px;
                background: ${bgColor};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 3000;
                font-weight: 600;
                animation: slideIn 0.3s ease;
            ">
                ${message}
            </div>
        `);

        $('body').append(notification);

        setTimeout(() => {
            notification.fadeOut(300, function () {
                $(this).remove();
            });
        }, 3000);
    }
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
