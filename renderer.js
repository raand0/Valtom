// ========== GLOBAL FUNCTIONS (for HTML onclick) ==========
window.showModal = showModal;
window.hideModal = hideModal;
window.hideDeleteModal = hideDeleteModal;
window.confirmDelete = confirmDelete;
window.logout = logout;

// ========== UTILITY FUNCTIONS ==========

const fs = require('fs');
const path = require('path');
const { app } = require('electron').remote || require('@electron/remote');

// Use userData directory for storing files (writable in packaged apps)
const userDataPath = app.getPath('userData');
const dataPath = path.join(userDataPath, 'accounts.json');
const loginFilePath = path.join(userDataPath, 'login.json');
const keyFile = path.join(userDataPath, 'key.json');

const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

let secretKey, iv;
let allAccounts = []; // Store all accounts for filtering

// Ensure userData directory exists
if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

// Load or generate encryption key + iv
if (fs.existsSync(keyFile)) {
    const saved = JSON.parse(fs.readFileSync(keyFile));
    secretKey = Buffer.from(saved.key, 'hex');
    iv = Buffer.from(saved.iv, 'hex');
} else {
    secretKey = crypto.randomBytes(32); // 256-bit key
    iv = crypto.randomBytes(16);        // 128-bit iv

    const toSave = {
        key: secretKey.toString('hex'),
        iv: iv.toString('hex')
    };

    fs.writeFileSync(keyFile, JSON.stringify(toSave, null, 2));
}

// ========== ENCRYPTION FUNCTIONS ==========

function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ========== AUTHENTICATION FUNCTIONS ==========

// UI Elements (will be available after DOM loads)
let loginPage, signupPage, mainApp, loginForm, signupForm, loginError, signupError, signupSuccess;

// Show error message
function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// Show success message
function showSuccess(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// Check if login file exists and show appropriate page
function initializeApp() {
    if (fs.existsSync(loginFilePath)) {
        showLoginPage();
    } else {
        showSignupPage();
    }
}

function showLoginPage() {
    if (loginPage && signupPage && mainApp) {
        loginPage.classList.remove('hidden');
        signupPage.classList.add('hidden');
        mainApp.classList.add('hidden');
    }
}

function showSignupPage() {
    if (loginPage && signupPage && mainApp) {
        signupPage.classList.remove('hidden');
        loginPage.classList.add('hidden');
        mainApp.classList.add('hidden');
    }
}

function showMainApp() {
    if (loginPage && signupPage && mainApp) {
        mainApp.classList.remove('hidden');
        loginPage.classList.add('hidden');
        signupPage.classList.add('hidden');
        loadDefaultPage();
    }
}

// Handle signup
function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    
    // Simple validation - check if fields are empty
    if (!username || !password || !confirmPassword) {
        showError(signupError, 'Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(signupError, 'Passwords do not match');
        return;
    }
    
    // Create login data
    const loginData = {
        username: username,
        password: encrypt(password),
        createdAt: new Date().toISOString()
    };
    
    try {
        // Save to login.json
        fs.writeFileSync(loginFilePath, JSON.stringify(loginData, null, 2));
        
        showSuccess(signupSuccess, 'Account created successfully! Please log in.');
        
        // Clear form
        signupForm.reset();
        
        // Show login page after 2 seconds
        setTimeout(() => {
            showLoginPage();
        }, 2000);
        
    } catch (error) {
        showError(signupError, 'Error creating account. Please try again.');
    }
}

// Handle login
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    // Simple validation - check if fields are empty
    if (!username || !password) {
        showError(loginError, 'Please fill in all fields');
        return;
    }
    
    try {
        // Read login data
        const loginData = JSON.parse(fs.readFileSync(loginFilePath, 'utf8'));
        
        // Verify credentials
        if (username === loginData.username && password === decrypt(loginData.password)) {
            // Login successful
            showMainApp();
        } else {
            showError(loginError, 'Invalid username or password');
        }
        
    } catch (error) {
        showError(loginError, 'Error reading login data. Please try again.');
    }
}

// Logout function
function logout() {
    showLoginPage();
    
    // Clear login form
    if (loginForm) {
        loginForm.reset();
    }
}

// Load default page content
function loadDefaultPage() {
    const container = document.getElementById('contentDisplay');
    if (container) {
        // Load the password generator page by default
        const addTab = document.querySelector('.addAcc');
        if (addTab) {
            loadPage('generate.html', addTab, container);
        }
    }
}

// ========== PASSWORD GENERATOR ==========

function generatePassword(length, includeNumbers, includeSymbols, includeUppercase) {
    let charset = "abcdefghijklmnopqrstuvwxyz";
    
    if (includeUppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeNumbers) charset += "0123456789";
    if (includeSymbols) charset += '!@#$%^&*()<>?/[]_+=-;';
    
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    return password;
}

// ========== CLIPBOARD FUNCTIONS ==========

async function copyToClipboard(text, button) {
    if (!text) {
        return;
    }
    
    await navigator.clipboard.writeText(text);
    showCopyFeedback(button);
}

function showCopyFeedback(button) {
    if (!button) return;
    
    const originalText = button.textContent;
    const originalBg = button.style.backgroundColor;
    
    button.textContent = 'Copied';
    button.style.backgroundColor = '#4CAF50';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = originalBg;
    }, 1500);
}

async function pasteFromClipboard(targetInput, button) {
    if (!targetInput) {
        console.error('No input element provided');
        return;
    }
    const text = await navigator.clipboard.readText();
    targetInput.value = text;
    showPasteFeedback(button);
}

function showPasteFeedback(button, customMessage = 'Pasted') {
    if (!button) return;
    
    const originalText = button.textContent;
    const originalBg = button.style.backgroundColor;
    
    button.textContent = customMessage;
    button.style.backgroundColor = '#2196F3';
    
    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = originalBg;
    }, 1500);
}

// ========== ACCOUNT MANAGEMENT ==========

function saveInfo(service, username, pass) {
    const account = {
        service,
        username,
        pass: encrypt(pass)
    };

    if (editingIndex >= 0) {
        // Update existing account
        allAccounts[editingIndex] = account;
    } else {
        // Add new account
        let data = [];
        if (fs.existsSync(dataPath)) {
            const raw = fs.readFileSync(dataPath);
            data = JSON.parse(raw);
        }
        data.push(account);
        allAccounts = data;
    }

    fs.writeFileSync(dataPath, JSON.stringify(allAccounts, null, 2));
}

// ========== MODAL FUNCTIONALITY ==========

function showModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset modal for add mode and clear form
        resetModalForAdd();
        const serviceInput = document.querySelector('#servc');
        const usernameInput = document.querySelector('#username');
        const passwordInput = document.querySelector('#pass');
        
        if (serviceInput) serviceInput.value = '';
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    }
}

// ========== SEARCH FUNCTIONALITY ==========

function initializeSearch() {
    const searchInput = document.querySelector('.search-bar');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            filterAccounts(searchTerm);
        });
    }
}

function filterAccounts(searchTerm) {
    const listContainer = document.querySelector('.password-list');
    if (!listContainer) return;
    
    // Clear current display
    listContainer.innerHTML = '';
    
    // Filter accounts based on service name
    const filteredAccounts = allAccounts.filter(acc => 
        acc.service.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Display filtered accounts
    displayAccounts(filteredAccounts, listContainer);
}

function displayAccounts(accounts, container) {
    accounts.forEach((acc, displayIndex) => {
        if (acc.pass && typeof acc.pass === 'string') {
            try {
                const password = decrypt(acc.pass);
                
                // Find the original index of this account in allAccounts
                const originalIndex = allAccounts.findIndex(originalAcc => 
                    originalAcc.service === acc.service && 
                    originalAcc.username === acc.username && 
                    originalAcc.pass === acc.pass
                );
        
                const itemHTML = `
                  <div class="password-item" data-account-index="${originalIndex}">
                    <div class="item-header">
                      <div class="item-info">
                        <div class="item-title">${acc.service}</div>
                        <div class="item-email">Email: ${acc.username}</div>
                      </div>
                      <div class="item-actions">
                        <button class="action-btn delete-btn" data-service="${acc.service}" data-account-index="${originalIndex}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Delete
                        </button>
                        <button class="action-btn edit-btn" data-account-index="${originalIndex}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                            Edit
                        </button>
                        </div>
                    </div>
                    <div class="password-field">
                      <div class="password-display">${password}</div>
                      <button class="copy-btn">Copy</button>
                    </div>
                  </div>
                `;
        
                container.insertAdjacentHTML('beforeend', itemHTML);
            } catch (error) {
                console.error('Error decrypting password for:', acc.service, error);
            }
        } else {
            console.warn('Skipping account with missing or invalid password:', acc);
        }
    });
    
    // Re-initialize all buttons for the new elements
    initializeCopyButtons();
    initializeActionButtons();
}

// ========== EDIT AND DELETE FUNCTIONALITY ==========

let editingIndex = -1; // Track which account is being edited

function initializeActionButtons() {
    // Initialize delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const accountIndex = parseInt(e.target.closest('.delete-btn').dataset.accountIndex);
            const serviceName = e.target.closest('.delete-btn').dataset.service;
            showDeleteModal(accountIndex, serviceName);
        });
    });
    
    // Initialize edit buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const accountIndex = parseInt(e.target.closest('.edit-btn').dataset.accountIndex);
            showEditModal(accountIndex);
        });
    });
}

function showDeleteModal(accountIndex, serviceName) {
    // Create delete confirmation modal
    const deleteModalHTML = `
        <div class="modal-overlay" id="deleteModalOverlay" style="display: flex;">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Confirm Delete</h3>
                    <button class="modal-close" onclick="hideDeleteModal()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="color: white;">Are you sure you want to delete the account for <strong style="color: #00d4ff;">${serviceName}</strong>?</p>
                    <p style="color: white;">This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="hideDeleteModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                        Cancel
                    </button>
                    <button class="btn btn-danger" onclick="confirmDelete(${accountIndex})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add to body
    document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
    document.body.style.overflow = 'hidden';
}

function hideDeleteModal() {
    const deleteModal = document.getElementById('deleteModalOverlay');
    if (deleteModal) {
        deleteModal.remove();
        document.body.style.overflow = 'auto';
    }
}

function confirmDelete(accountIndex) {
    // Remove account from allAccounts array
    allAccounts.splice(accountIndex, 1);
    
    // Save updated accounts to file
    fs.writeFileSync(dataPath, JSON.stringify(allAccounts, null, 2));
    
    // Hide delete modal
    hideDeleteModal();
    
    // Refresh the password page
    const listContainer = document.querySelector('.password-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        displayAccounts(allAccounts, listContainer);
    }
}

function showEditModal(accountIndex) {
    const account = allAccounts[accountIndex];
    if (!account) return;
    
    editingIndex = accountIndex;
    
    // Show the main modal
    showModal();
    
    // Change modal title and button text for editing
    const modalTitle = document.querySelector('.modal-title');
    const saveBtn = document.querySelector('#saveBtn');
    
    if (modalTitle) {
        modalTitle.textContent = 'Edit Account';
    }
    
    if (saveBtn) {
        saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Update Account
        `;
    }
    
    // Fill the form with existing data
    const serviceInput = document.querySelector('#servc');
    const usernameInput = document.querySelector('#username');
    const passwordInput = document.querySelector('#pass');
    
    if (serviceInput) serviceInput.value = account.service;
    if (usernameInput) usernameInput.value = account.username;
    if (passwordInput) passwordInput.value = decrypt(account.pass);
}

function resetModalForAdd() {
    editingIndex = -1;
    
    // Reset modal title and button text
    const modalTitle = document.querySelector('.modal-title');
    const saveBtn = document.querySelector('#saveBtn');
    
    if (modalTitle) {
        modalTitle.textContent = 'Add New Account';
    }
    
    if (saveBtn) {
        saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Save Password
        `;
    }
}

function initializeCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        // Remove existing event listeners to prevent duplicates
        button.replaceWith(button.cloneNode(true));
    });
    
    // Add event listeners to the new buttons
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', () => {
            const passwordItem = button.closest('.password-item');
            const passwordDisplay = passwordItem?.querySelector('.password-display');
            
            if (passwordDisplay) {
                const password = passwordDisplay.textContent;
                copyToClipboard(password, button);
            }
        });
    });
}

// ========== PAGE INITIALIZATION ==========

function initializePasswordGenerator() {
    const genBtn = document.querySelector('.generate-btn');
    const slider = document.querySelector('.slider');
    const checkboxes = document.querySelectorAll('.checkbox');
    const sliderLabel = document.querySelector('.option-label');
    const passwordDisplay = document.querySelector('.password-display');
    const copyBtn = document.querySelector('.copy-btn');
    
    // Generate password functionality
    if (genBtn && slider && checkboxes.length >= 3 && passwordDisplay) {
        genBtn.addEventListener('click', () => {
            const length = parseInt(slider.value);
            const includeNumbers = checkboxes[0].checked;
            const includeSymbols = checkboxes[1].checked;
            const includeUppercase = checkboxes[2].checked;
            
            const password = generatePassword(length, includeNumbers, includeSymbols, includeUppercase);
            passwordDisplay.textContent = password;
        });
    }
    
    // Slider functionality
    if (slider && sliderLabel) {
        slider.addEventListener('input', () => {
            sliderLabel.textContent = `Length: ${slider.value}`;
        });
    }
    
    // Copy button functionality
    if (copyBtn && passwordDisplay) {
        copyBtn.addEventListener('click', () => {
            copyToClipboard(passwordDisplay.textContent, copyBtn);
        });
    }
}

function initializePasswordPage() {
    const listContainer = document.querySelector('.password-list');
    
    // Load all accounts and store them
    allAccounts = [];
    
    if (fs.existsSync(dataPath)) {
        const raw = fs.readFileSync(dataPath, 'utf8');
        allAccounts = JSON.parse(raw);
    }
    
    // Display all accounts initially
    displayAccounts(allAccounts, listContainer);
    
    // Initialize search functionality
    initializeSearch();
}

// ========== NAVIGATION SYSTEM ==========

function loadPage(path, activeTab, container) {
    fetch(path)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;
            
            // Update active navigation state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            activeTab.classList.add('active');
            
            // Initialize page-specific functionality
            if (path === 'generate.html') {
                initializePasswordGenerator();
            } else if (path === 'passPage.html') {
                initializePasswordPage();
            }
        })
        .catch(error => {
            console.error('Failed to load page:', error);
            container.innerHTML = '<p>Error loading page. Please try again.</p>';
        });
}

function initializeModal() {
    const pasteBtn = document.querySelector('.paste-btn');
    const serviceNameInput = document.querySelector('#servc');
    const userNameInput = document.querySelector('#username');
    const passwordInput = document.querySelector('#pass');
    const saveBtn = document.querySelector('#saveBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const serviceName = serviceNameInput.value.trim();
            const userName = userNameInput.value.trim();
            const password = passwordInput.value.trim();
    
            if (serviceName && userName && password != "") {
                saveInfo(serviceName, userName, password);
                serviceNameInput.value = "";
                userNameInput.value = "";
                passwordInput.value = "";
                hideModal();
                
                // Refresh the account list if we're on the password page
                const listContainer = document.querySelector('.password-list');
                if (listContainer) {
                    listContainer.innerHTML = '';
                    displayAccounts(allAccounts, listContainer);
                }
            } else {
                console.log("empty fields!");
                return;
            }
        });
    }
    
    if (pasteBtn && passwordInput) {
        pasteBtn.addEventListener('click', () => {
            pasteFromClipboard(passwordInput, pasteBtn);
        });
    }
}

// ========== MAIN INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
    // Initialize authentication UI elements
    loginPage = document.getElementById('loginPage');
    signupPage = document.getElementById('signupPage');
    mainApp = document.getElementById('mainApp');
    loginForm = document.getElementById('loginForm');
    signupForm = document.getElementById('signupForm');
    loginError = document.getElementById('loginError');
    signupError = document.getElementById('signupError');
    signupSuccess = document.getElementById('signupSuccess');
    
    // Initialize authentication system
    initializeApp();
    
    // Add event listeners for authentication forms
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Add keyboard navigation for login and signup forms
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const activeElement = document.activeElement;
            const isLoginPage = !loginPage.classList.contains('hidden');
            const isSignupPage = !signupPage.classList.contains('hidden');
            
            if (isLoginPage) {
                const loginUsername = document.getElementById('loginUsername');
                const loginPassword = document.getElementById('loginPassword');
                
                if (e.key === 'ArrowDown' && activeElement === loginUsername) {
                    e.preventDefault();
                    loginPassword.focus();
                } else if (e.key === 'ArrowUp' && activeElement === loginPassword) {
                    e.preventDefault();
                    loginUsername.focus();
                }
            } else if (isSignupPage) {
                const signupUsername = document.getElementById('signupUsername');
                const signupPassword = document.getElementById('signupPassword');
                const confirmPassword = document.getElementById('confirmPassword');
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (activeElement === signupUsername) {
                        signupPassword.focus();
                    } else if (activeElement === signupPassword) {
                        confirmPassword.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (activeElement === confirmPassword) {
                        signupPassword.focus();
                    } else if (activeElement === signupPassword) {
                        signupUsername.focus();
                    }
                }
            }
        }
    });
    
    // Initialize main app navigation (only if main app is visible)
    const addTab = document.querySelector('.addAcc');
    const allTab = document.querySelector('.accounts');
    const container = document.getElementById('contentDisplay');
    
    if (addTab) {
        addTab.addEventListener('click', () => {
            loadPage('generate.html', addTab, container);
        });
    }
    
    if (allTab) {
        allTab.addEventListener('click', () => {
            loadPage('passPage.html', allTab, container);
        });
    }
    
    // Initialize modal functionality
    initializeModal();
    
    // Modal event listeners
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        // Close modal when clicking outside
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal();
        }
    });
});