        // Import Firebase functions
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, sendEmailVerification, updateProfile as updateFirebaseProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";
        import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";

        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyAoomGKHjU2iUJjjMxEDGCsLzRtIkHtqhY",
            authDomain: "susupay-5286e.firebaseapp.com",
            projectId: "susupay-5286e",
            storageBucket: "susupay-5286e.firebasestorage.app",
            messagingSenderId: "83852132974",
            appId: "1:83852132974:web:2d8be2d1adb7e7639f5c7f",
            measurementId: "G-EQM64CTX83"
        };

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);
        const analytics = getAnalytics(app);

        // Global variables
        let isSignUp = false;
        let userData = {
            firstName: '',
            middleName: '',
            surname: '',
            email: '',
            phone: '',
            country: '',
            dailyRate: 0,
            balance: 0,
            contributions: {},
            transactions: [],
            kycStatus: 'not_started',
            kycDocuments: {
                frontId: null,
                backId: null,
                selfie: null
            },
            preferences: {
                emailNotifications: true,
                dailyReminders: true,
                securityAlerts: true,
                currency: 'GHS',
                language: 'en'
            }
        };
        let currentMonth = new Date().getMonth();
        let currentKycTab = 'id-verification';
        let currentSettingsTab = 'profile-settings';
        let cameraStream = null;
        let selfieActionIndex = 0;
        const selfieActions = [
            'Please look straight into the camera',
            'Please turn your head slightly to the left',
            'Please turn your head slightly to the right',
            'Please smile',
            'Please look straight again'
        ];
        
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

        // DOM elements
        const authContainer = document.getElementById('auth-container');
        const verificationContainer = document.getElementById('verification-container');
        const dashboardContainer = document.getElementById('dashboard-container');
        const kycModal = document.getElementById('kyc-modal');
        const settingsModal = document.getElementById('settings-modal');
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        const loadingDiv = document.getElementById('loading');
        const googleSigninBtn = document.getElementById('google-signin-btn');
        const authToggleBtn = document.getElementById('auth-toggle-btn');
        const authToggleText = document.getElementById('auth-toggle-text');
        const logoutBtn = document.getElementById('logout-btn');

        // Show/hide loading
        function showLoading() {
            loadingDiv.style.display = 'block';
            document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
        }

        function hideLoading() {
            loadingDiv.style.display = 'none';
            document.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
        }

        // Show alert messages
        function showAlert(message, type, containerId = 'alert-container') {
            const container = document.getElementById(containerId);
            const alert = document.createElement('div');
            alert.className = `alert alert-${type}`;
            alert.textContent = message;
            
            container.appendChild(alert);
            
            setTimeout(() => {
                alert.remove();
            }, 5000);
        }

        // Toggle between signin and signup
        function toggleAuthMode() {
            isSignUp = !isSignUp;
            
            if (isSignUp) {
                signinForm.style.display = 'none';
                signupForm.style.display = 'block';
                authToggleText.textContent = 'Already have an account?';
                authToggleBtn.textContent = 'Sign In';
                updatePhoneCode();
            } else {
                signinForm.style.display = 'block';
                signupForm.style.display = 'none';
                authToggleText.textContent = "Don't have an account?";
                authToggleBtn.textContent = 'Sign Up';
            }
        }

        // Update phone code based on country selection
        function updatePhoneCode() {
            const countrySelect = document.getElementById('country');
            const phoneCodeSelect = document.getElementById('phone-code');
            
            countrySelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const phoneCode = selectedOption.getAttribute('data-code');
                
                // Clear and populate phone code
                phoneCodeSelect.innerHTML = '<option value="">Code</option>';
                if (phoneCode) {
                    const option = document.createElement('option');
                    option.value = phoneCode;
                    option.textContent = phoneCode;
                    option.selected = true;
                    phoneCodeSelect.appendChild(option);
                }
            });
        }

        // Form validation
        function validateSignupForm() {
            const firstName = document.getElementById('first-name').value.trim();
            const surname = document.getElementById('surname').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const country = document.getElementById('country').value;
            const phoneCode = document.getElementById('phone-code').value;
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!firstName || !surname) {
                showAlert('Please enter your first name and surname.', 'error');
                return false;
            }

            if (!email || !isValidEmail(email)) {
                showAlert('Please enter a valid email address.', 'error');
                return false;
            }

            if (!country) {
                showAlert('Please select your country.', 'error');
                return false;
            }

            if (!phoneCode || !phone) {
                showAlert('Please enter your phone number.', 'error');
                return false;
            }

            if (password.length < 6) {
                showAlert('Password must be at least 6 characters long.', 'error');
                return false;
            }

            if (password !== confirmPassword) {
                showAlert('Passwords do not match.', 'error');
                return false;
            }

            return true;
        }

        function isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        // Handle sign in form submission
        async function handleSignIn(e) {
            e.preventDefault();
            
            const email = document.getElementById('signin-email').value.trim();
            const password = document.getElementById('signin-password').value;

            if (!email || !password) {
                showAlert('Please enter both email and password.', 'error');
                return;
            }

            showLoading();

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                showAlert('Signed in successfully!', 'success');
            } catch (error) {
                console.error('Sign in error:', error);
                let errorMessage = 'Sign in failed. Please check your credentials.';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email address.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later.';
                        break;
                }
                
                showAlert(errorMessage, 'error');
            } finally {
                hideLoading();
            }
        }

        // Handle sign up form submission
        async function handleSignUp(e) {
            e.preventDefault();
            
            if (!validateSignupForm()) {
                return;
            }

            const firstName = document.getElementById('first-name').value.trim();
            const middleName = document.getElementById('middle-name').value.trim();
            const surname = document.getElementById('surname').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const country = document.getElementById('country').value;
            const phoneCode = document.getElementById('phone-code').value;
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('signup-password').value;

            showLoading();

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update user profile
                const displayName = middleName ? `${firstName} ${middleName} ${surname}` : `${firstName} ${surname}`;
                await updateFirebaseProfile(user, {
                    displayName: displayName
                });

                // Create user profile in Firestore
                await createUserProfile(user, {
                    firstName,
                    middleName,
                    surname,
                    email,
                    country,
                    phone: `${phoneCode}${phone}`
                });

                // Send email verification
                await sendEmailVerification(user);
                
                // Show verification screen
                showVerificationScreen(email);
                
                showAlert('Account created successfully! Please check your email to verify your account.', 'success');
            } catch (error) {
                console.error('Sign up error:', error);
                let errorMessage = 'Account creation failed. Please try again.';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'An account with this email already exists.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password should be at least 6 characters.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                }
                
                showAlert(errorMessage, 'error');
            } finally {
                hideLoading();
            }
        }

        // Handle Google sign in
        async function handleGoogleSignIn() {
            const provider = new GoogleAuthProvider();
            
            showLoading();
            
            try {
                const result = await signInWithPopup(auth, provider);
                await createUserProfile(result.user);
                showAlert('Signed in with Google successfully!', 'success');
            } catch (error) {
                console.error('Google sign in error:', error);
                showAlert('Google sign in failed. Please try again.', 'error');
            } finally {
                hideLoading();
            }
        }

        // Create user profile in Firestore
        async function createUserProfile(user, additionalData = {}) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const nameParts = user.displayName ? user.displayName.split(' ') : [user.email.split('@')[0]];
                const firstName = additionalData.firstName || nameParts[0] || '';
                const surname = additionalData.surname || nameParts[nameParts.length - 1] || '';
                const middleName = additionalData.middleName || (nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '');

                await setDoc(userRef, {
                    firstName,
                    middleName,
                    surname,
                    email: user.email,
                    country: additionalData.country || '',
                    phone: additionalData.phone || '',
                    dailyRate: 0,
                    balance: 0,
                    contributions: {},
                    transactions: [],
                    kycStatus: 'not_started',
                    kycDocuments: {
                        frontId: null,
                        backId: null,
                        selfie: null
                    },
                    preferences: {
                        emailNotifications: true,
                        dailyReminders: true,
                        securityAlerts: true,
                        currency: 'GHS',
                        language: 'en'
                    },
                    createdAt: new Date(),
                    emailVerified: user.emailVerified
                });
            }
        }

        // Show verification screen
        function showVerificationScreen(email) {
            authContainer.style.display = 'none';
            verificationContainer.style.display = 'block';
            document.getElementById('verification-email').textContent = email;
            
            // Attach event to check verification button
            const checkBtn = document.getElementById('check-verification-btn');
            checkBtn.onclick = async function() {
                if (auth.currentUser) {
                    await auth.currentUser.reload();
                    if (auth.currentUser.emailVerified) {
                        showDashboard(auth.currentUser);
                    } else {
                        showAlert('Email not verified yet. Please check your inbox and click the verification link.', 'error');
                    }
                }
            };
        }

        // Resend verification email
        async function resendVerificationEmail() {
            if (!auth.currentUser) {
                showAlert('No user signed in. Please try signing up again.', 'error');
                return;
            }

            try {
                await sendEmailVerification(auth.currentUser);
                showAlert('Verification email sent! Please check your inbox.', 'success');
            } catch (error) {
                console.error('Resend verification error:', error);
                showAlert('Failed to resend verification email. Please try again.', 'error');
            }
        }

        // Load user data from Firestore
        async function loadUserData(userId) {
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    userData = {
                        firstName: data.firstName || '',
                        middleName: data.middleName || '',
                        surname: data.surname || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        country: data.country || '',
                        dailyRate: data.dailyRate || 0,
                        balance: data.balance || 0,
                        contributions: data.contributions || {},
                        transactions: data.transactions || [],
                        kycStatus: data.kycStatus || 'not_started',
                        kycDocuments: data.kycDocuments || {
                            frontId: null,
                            backId: null,
                            selfie: null
                        },
                        preferences: data.preferences || {
                            emailNotifications: true,
                            dailyReminders: true,
                            securityAlerts: true,
                            currency: 'GHS',
                            language: 'en'
                        }
                    };
                }
                
                updateDashboardUI();
                updateKYCBanner();
            } catch (error) {
                console.error('Error loading user data:', error);
                showAlert('Failed to load user data.', 'error', 'dashboard-alert-container');
            }
        }

        // Save user data to Firestore
        async function saveUserData(userId) {
            try {
                const userRef = doc(db, 'users', userId);
                await setDoc(userRef, {
                    firstName: userData.firstName,
                    middleName: userData.middleName,
                    surname: userData.surname,
                    email: userData.email,
                    phone: userData.phone,
                    country: userData.country,
                    dailyRate: userData.dailyRate,
                    balance: userData.balance,
                    contributions: userData.contributions,
                    transactions: userData.transactions,
                    kycStatus: userData.kycStatus,
                    kycDocuments: userData.kycDocuments,
                    preferences: userData.preferences,
                    updatedAt: new Date()
                }, { merge: true });
            } catch (error) {
                console.error('Error saving user data:', error);
                showAlert('Failed to save data.', 'error', 'dashboard-alert-container');
            }
        }

        // Show dashboard
        function showDashboard(user) {
            authContainer.style.display = 'none';
            verificationContainer.style.display = 'none';
            dashboardContainer.style.display = 'block';
            document.body.style.alignItems = 'flex-start';
            document.body.style.justifyContent = 'flex-start';
            document.body.style.padding = '0';
            
            // Update user info
            const displayName = user.displayName || `${userData.firstName} ${userData.surname}` || user.email.split('@')[0];
            document.getElementById('user-display-name').textContent = displayName;
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('user-avatar').textContent = displayName[0].toUpperCase();
            
            loadUserData(user.uid);
        }

        // Show authentication
        function showAuth() {
            authContainer.style.display = 'block';
            verificationContainer.style.display = 'none';
            dashboardContainer.style.display = 'none';
            document.body.style.alignItems = 'center';
            document.body.style.justifyContent = 'center';
            document.body.style.padding = '20px';
        }

        // Handle logout
        async function handleLogout() {
            try {
                await signOut(auth);
                showAlert('Signed out successfully!', 'success');
                showAuth();
                // Reset forms
                signinForm.reset();
                signupForm.reset();
                if (isSignUp) toggleAuthMode(); // Reset to sign in mode
            } catch (error) {
                console.error('Logout error:', error);
                showAlert('Logout failed. Please try again.', 'error', 'dashboard-alert-container');
            }
        }

        // Update dashboard UI
        function updateDashboardUI() {
            updateStats();
            generateCalendar();
            updateTransactionHistory();
            document.getElementById('daily-rate-input').value = userData.dailyRate || '';
        }

        // Update statistics
        function updateStats() {
            document.getElementById('total-balance').textContent = `₵${userData.balance.toFixed(2)}`;
            document.getElementById('daily-rate').textContent = `₵${userData.dailyRate.toFixed(2)}`;
            document.getElementById('contribute-amount').textContent = userData.dailyRate.toFixed(2);
            
            // Calculate month progress
            const today = new Date();
            const currentMonthIndex = today.getMonth();
            const daysInMonth = new Date(today.getFullYear(), currentMonthIndex + 1, 0).getDate();
            const daysPassed = today.getDate();
            const progressPercentage = Math.round((daysPassed / daysInMonth) * 100);
            
            document.getElementById('month-progress').textContent = `${progressPercentage}%`;
            document.getElementById('month-progress-bar').style.width = `${progressPercentage}%`;
        }

        // Generate calendar
        function generateCalendar() {
            const grid = document.getElementById('contribution-grid');
            const today = new Date();
            const year = today.getFullYear();
            const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
            
            grid.innerHTML = '';
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dayCell = document.createElement('div');
                dayCell.className = 'day-cell';
                dayCell.textContent = day;
                dayCell.onclick = () => contributeForDay(day);
                
                // Check if there's a contribution for this day
                if (userData.contributions[currentMonth] && userData.contributions[currentMonth][day]) {
                    const contribution = userData.contributions[currentMonth][day];
                    switch (contribution.status) {
                        case 'approved':
                            dayCell.classList.add('contributed');
                            break;
                        case 'pending':
                            dayCell.classList.add('contribution-pending');
                            break;
                        case 'rejected':
                            dayCell.classList.add('contribution-rejected');
                            break;
                    }
                }
                
                grid.appendChild(dayCell);
            }
        }

        // Update transaction history
        function updateTransactionHistory() {
            const transactionsList = document.getElementById('transactions-list');
            
            if (userData.transactions.length === 0) {
                transactionsList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No transactions yet. Start contributing to see your history here!</p>';
                return;
            }
            
            transactionsList.innerHTML = '';
            
            userData.transactions.forEach(transaction => {
                const transactionItem = document.createElement('div');
                transactionItem.className = 'transaction-item';
                
                transactionItem.innerHTML = `
                    <div>
                        <div style="font-weight: 600; margin-bottom: 5px;">${transaction.description}</div>
                        <div style="color: #718096; font-size: 0.9rem;">${transaction.date}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: ${transaction.type === 'contribution' ? '#38a169' : '#e53e3e'};">
                            ${transaction.type === 'contribution' ? '+' : '-'}₵${transaction.amount.toFixed(2)}
                        </div>
                        <div class="transaction-status status-${transaction.status}">
                            ${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </div>
                    </div>
                `;
                
                transactionsList.appendChild(transactionItem);
            });
        }

        // Dashboard functions (make them globally available)
        window.setUserRate = async function() {
            const rate = parseFloat(document.getElementById('daily-rate-input').value);
            if (!rate || rate <= 0) {
                showAlert('Please enter a valid daily rate!', 'error', 'dashboard-alert-container');
                return;
            }
            userData.dailyRate = rate;
            updateStats();
            generateCalendar();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Rate set successfully! Daily contribution: ₵${rate}`, 'success', 'dashboard-alert-container');
        };

        window.contributeToday = function() {
            const today = new Date().getDate();
            contributeForDay(today);
        };

        window.contributeForDay = async function(day) {
            if (!userData.dailyRate) {
                showAlert('Please set your daily rate first!', 'error', 'dashboard-alert-container');
                return;
            }
            if (userData.contributions[currentMonth] && userData.contributions[currentMonth][day]) {
                showAlert(`You already have a contribution request for day ${day}!`, 'error', 'dashboard-alert-container');
                return;
            }
            if (!userData.contributions[currentMonth]) {
                userData.contributions[currentMonth] = {};
            }
            
            const contributionRequest = {
                amount: userData.dailyRate,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                type: 'contribution'
            };
            
            userData.contributions[currentMonth][day] = contributionRequest;
            userData.transactions.unshift({
                id: `contrib_${Date.now()}`,
                type: 'contribution',
                amount: userData.dailyRate,
                date: `${months[currentMonth]} ${day}, 2025`,
                description: `Daily contribution request for day ${day}`,
                status: 'pending',
                requestedAt: new Date().toISOString()
            });
            
            generateCalendar();
            updateStats();
            updateTransactionHistory();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Contribution request of ₵${userData.dailyRate} submitted for day ${day}. Awaiting admin approval.`, 'success', 'dashboard-alert-container');
        };

        window.processWithdrawal = async function() {
            const amount = parseFloat(document.getElementById('withdrawal-amount').value);
            if (!amount || amount <= 0) {
                showAlert('Please enter a valid withdrawal amount!', 'error', 'dashboard-alert-container');
                return;
            }
            if (!userData.dailyRate) {
                showAlert('Please set your daily rate first!', 'error', 'dashboard-alert-container');
                return;
            }
            if (amount > userData.balance) {
                showAlert('Insufficient balance for this withdrawal!', 'error', 'dashboard-alert-container');
                return;
            }
            
            const commission = userData.dailyRate;
            const totalDeduction = amount + commission;
            
            if (totalDeduction > userData.balance) {
                showAlert(`Insufficient balance! You need ₵${totalDeduction} (₵${amount} + ₵${commission} commission)`, 'error', 'dashboard-alert-container');
                return;
            }
            
            const withdrawalRequest = {
                id: `withdraw_${Date.now()}`,
                type: 'withdrawal',
                amount: amount,
                commission: commission,
                totalDeduction: totalDeduction,
                date: new Date().toLocaleDateString(),
                description: `Withdrawal request of ₵${amount} (Commission: ₵${commission})`,
                status: 'pending',
                requestedAt: new Date().toISOString()
            };
            
            userData.transactions.unshift(withdrawalRequest);
            document.getElementById('withdrawal-amount').value = '';
            updateStats();
            updateTransactionHistory();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Withdrawal request of ₵${amount} submitted. Awaiting admin approval.`, 'success', 'dashboard-alert-container');
        };

        window.selectMonth = function(monthIndex) {
            currentMonth = monthIndex;
            document.querySelectorAll('.month-btn').forEach((btn, index) => {
                btn.classList.toggle('active', index === monthIndex);
            });
            document.getElementById('current-month-display').querySelector('h3').textContent = `${months[monthIndex]} 2025`;
            generateCalendar();
            updateStats();
        };

        // KYC functions
        function initializeKYC() {
            // File upload handlers
            setupFileUpload('front-id-upload', 'front-id-input', 'front-id-preview', 'front-id-image', 'frontId');
            setupFileUpload('back-id-upload', 'back-id-input', 'back-id-preview', 'back-id-image', 'backId');
            
            // Camera functionality
            document.getElementById('start-camera-btn').addEventListener('click', startCamera);
            document.getElementById('capture-selfie-btn').addEventListener('click', captureSelfie);
            document.getElementById('retake-selfie-btn').addEventListener('click', retakeSelfie);
            
            // KYC modal handlers
            document.getElementById('start-kyc-btn').addEventListener('click', openKYCModal);
            document.getElementById('close-kyc-modal').addEventListener('click', closeKYCModal);
            document.getElementById('submit-kyc-btn').addEventListener('click', submitKYC);
            
            // Tab navigation
            document.querySelectorAll('#kyc-modal .nav-tab').forEach(tab => {
                tab.addEventListener('click', () => switchKYCTab(tab.dataset.tab));
            });
        }

        // File upload setup
        function setupFileUpload(uploadAreaId, inputId, previewId, imageId, docType) {
            const uploadArea = document.getElementById(uploadAreaId);
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const image = document.getElementById(imageId);
            
            uploadArea.addEventListener('click', () => input.click());
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    handleFileUpload(files[0], preview, image, docType);
                }
            });
            
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0], preview, image, docType);
                }
            });
        }

        // Handle file upload
        async function handleFileUpload(file, preview, image, docType) {
            if (!file.type.startsWith('image/')) {
                showAlert('Please upload a valid image file!', 'error', 'alert-container');
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                showAlert('File size must be less than 10MB!', 'error', 'alert-container');
                return;
            }
            
            try {
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    image.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // Upload to Firebase Storage
                const userId = auth.currentUser.uid;
                const storageRef = ref(storage, `kyc/${userId}/${docType}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                
                // Update user data
                userData.kycDocuments[docType] = downloadURL;
                
                // Mark step as completed
                const stepElement = document.getElementById(`${docType === 'frontId' ? 'front' : 'back'}-id-step`);
                const stepNumber = document.getElementById(`${docType === 'frontId' ? 'front' : 'back'}-step-number`);
                stepElement.classList.add('completed');
                stepNumber.classList.add('completed');
                stepNumber.textContent = '✓';
                
                showAlert(`${docType === 'frontId' ? 'Front' : 'Back'} ID uploaded successfully!`, 'success', 'alert-container');
                
            } catch (error) {
                console.error('Upload error:', error);
                showAlert('Upload failed. Please try again.', 'error', 'alert-container');
            }
        }

        // Camera functions
        async function startCamera() {
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' }, 
                    audio: false 
                });
                
                const video = document.getElementById('selfie-video');
                video.srcObject = cameraStream;
                
                document.getElementById('start-camera-btn').style.display = 'none';
                document.getElementById('capture-selfie-btn').style.display = 'inline-block';
                
                // Start live action prompts
                startLiveActionPrompts();
                
            } catch (error) {
                console.error('Camera error:', error);
                showAlert('Camera access denied. Please allow camera access and try again.', 'error', 'alert-container');
            }
        }

        function startLiveActionPrompts() {
            const actionElement = document.getElementById('live-action-prompt').querySelector('.action-text');
            
            const interval = setInterval(() => {
                if (selfieActionIndex < selfieActions.length) {
                    actionElement.textContent = selfieActions[selfieActionIndex];
                    selfieActionIndex++;
                } else {
                    actionElement.textContent = 'Ready to capture!';
                    clearInterval(interval);
                }
            }, 2000);
        }

        async function captureSelfie() {
            const video = document.getElementById('selfie-video');
            const canvas = document.getElementById('selfie-canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            // Convert to blob and upload
            canvas.toBlob(async (blob) => {
                try {
                    const userId = auth.currentUser.uid;
                    const storageRef = ref(storage, `kyc/${userId}/selfie_${Date.now()}`);
                    await uploadBytes(storageRef, blob);
                    const downloadURL = await getDownloadURL(storageRef);
                    
                    userData.kycDocuments.selfie = downloadURL;
                    
                    // Show preview
                    const preview = document.getElementById('selfie-preview');
                    const image = document.getElementById('selfie-image');
                    image.src = canvas.toDataURL();
                    preview.style.display = 'block';
                    
                    // Mark step as completed
                    const stepElement = document.getElementById('selfie-step');
                    const stepNumber = document.getElementById('selfie-step-number');
                    stepElement.classList.add('completed');
                    stepNumber.classList.add('completed');
                    stepNumber.textContent = '✓';
                    
                    document.getElementById('capture-selfie-btn').style.display = 'none';
                    document.getElementById('retake-selfie-btn').style.display = 'inline-block';
                    
                    showAlert('Selfie captured successfully!', 'success', 'alert-container');
                    
                } catch (error) {
                    console.error('Selfie upload error:', error);
                    showAlert('Selfie upload failed. Please try again.', 'error', 'alert-container');
                }
            }, 'image/jpeg', 0.8);
        }

        function retakeSelfie() {
            document.getElementById('selfie-preview').style.display = 'none';
            document.getElementById('capture-selfie-btn').style.display = 'inline-block';
            document.getElementById('retake-selfie-btn').style.display = 'none';
            
            selfieActionIndex = 0;
            startLiveActionPrompts();
        }

        // KYC Modal functions
        function openKYCModal() {
            kycModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            updateKYCStatus();
        }

        function closeKYCModal() {
            kycModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            // Stop camera if running
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
        }

        function switchKYCTab(tabName) {
            // Update active tab
            document.querySelectorAll('#kyc-modal .nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`#kyc-modal [data-tab="${tabName}"]`).classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('#kyc-modal .tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(tabName).style.display = 'block';
            
            currentKycTab = tabName;
        }

        async function submitKYC() {
            if (!userData.kycDocuments.frontId || !userData.kycDocuments.backId || !userData.kycDocuments.selfie) {
                showAlert('Please complete all verification steps before submitting!', 'error', 'alert-container');
                return;
            }
            
            try {
                userData.kycStatus = 'pending';
                await saveUserData(auth.currentUser.uid);
                
                showAlert('KYC documents submitted successfully! We will review your documents within 24-48 hours.', 'success', 'dashboard-alert-container');
                closeKYCModal();
                updateKYCBanner();
                
            } catch (error) {
                console.error('KYC submission error:', error);
                showAlert('KYC submission failed. Please try again.', 'error', 'alert-container');
            }
        }

        function updateKYCStatus() {
            const status = userData.kycStatus;
            const banner = document.getElementById('kyc-banner');
            const statusIndicator = document.getElementById('kyc-status-indicator');
            
            switch (status) {
                case 'not_started':
                    statusIndicator.textContent = '🔴 KYC: Not Started';
                    statusIndicator.style.color = '#e53e3e';
                    banner.style.display = 'block';
                    break;
                case 'pending':
                    statusIndicator.textContent = '🟡 KYC: Under Review';
                    statusIndicator.style.color = '#d69e2e';
                    banner.innerHTML = `
                        <h3>🕐 KYC Under Review</h3>
                        <p>Your documents are being reviewed. We'll notify you once verification is complete.</p>
                    `;
                    break;
                case 'approved':
                    statusIndicator.textContent = '🟢 KYC: Verified';
                    statusIndicator.style.color = '#38a169';
                    banner.style.display = 'none';
                    break;
                case 'rejected':
                    statusIndicator.textContent = '🔴 KYC: Rejected';
                    statusIndicator.style.color = '#e53e3e';
                    banner.innerHTML = `
                        <h3>❌ KYC Rejected</h3>
                        <p>Your documents were rejected. Please check your email for details and resubmit.</p>
                        <button class="kyc-btn" onclick="openKYCModal()">Resubmit Documents</button>
                    `;
                    break;
            }
        }

        function updateKYCBanner() {
            updateKYCStatus();
        }

        // Settings functionality
        function initializeSettings() {
            document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
            document.getElementById('close-settings-modal').addEventListener('click', closeSettingsModal);
            document.getElementById('open-kyc-from-settings').addEventListener('click', () => {
                closeSettingsModal();
                openKYCModal();
            });
            
            // Tab navigation
            document.querySelectorAll('#settings-modal .nav-tab').forEach(tab => {
                tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
            });
            
            // Form handlers
            document.getElementById('profile-update-form').addEventListener('submit', updateUserProfile);
            document.getElementById('password-update-form').addEventListener('submit', updateUserPassword);
            document.getElementById('save-preferences-btn').addEventListener('click', savePreferences);
            document.getElementById('delete-account-btn').addEventListener('click', deleteAccount);
        }

        // Settings Modal functions
        function openSettingsModal() {
            settingsModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            loadUserSettings();
        }

        function closeSettingsModal() {
            settingsModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        function switchSettingsTab(tabName) {
            // Update active tab
            document.querySelectorAll('#settings-modal .nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`#settings-modal [data-tab="${tabName}"]`).classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('#settings-modal .tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(tabName).style.display = 'block';
            
            currentSettingsTab = tabName;
        }

        function loadUserSettings() {
            // Load profile data
            document.getElementById('edit-first-name').value = userData.firstName || '';
            document.getElementById('edit-middle-name').value = userData.middleName || '';
            document.getElementById('edit-surname').value = userData.surname || '';
            document.getElementById('edit-email-display').value = userData.email || '';
            document.getElementById('edit-country-display').value = userData.country || '';
            document.getElementById('edit-phone').value = userData.phone || '';
            
            // Load preferences
            document.getElementById('email-notifications').checked = userData.preferences?.emailNotifications ?? true;
            document.getElementById('daily-reminders').checked = userData.preferences?.dailyReminders ?? true;
            document.getElementById('security-alerts').checked = userData.preferences?.securityAlerts ?? true;
            document.getElementById('currency-preference').value = userData.preferences?.currency || 'GHS';
            document.getElementById('language-preference').value = userData.preferences?.language || 'en';
            
            // Update KYC status in settings
            const kycStatus = document.getElementById('settings-kyc-status');
            switch (userData.kycStatus) {
                case 'not_started':
                    kycStatus.textContent = 'Not started - Click to verify';
                    break;
                case 'pending':
                    kycStatus.textContent = 'Under review - Please wait';
                    break;
                case 'approved':
                    kycStatus.textContent = 'Verified ✓';
                    kycStatus.style.color = '#38a169';
                    break;
                case 'rejected':
                    kycStatus.textContent = 'Rejected - Click to resubmit';
                    break;
            }
        }

        async function updateUserProfile(e) {
            e.preventDefault();
            
            try {
                userData.firstName = document.getElementById('edit-first-name').value.trim();
                userData.middleName = document.getElementById('edit-middle-name').value.trim();
                userData.surname = document.getElementById('edit-surname').value.trim();
                userData.country = document.getElementById('edit-country-display').value;
                userData.phone = document.getElementById('edit-phone').value.trim();
                
                await saveUserData(auth.currentUser.uid);
                
                // Update display name in auth
                const displayName = userData.middleName ? 
                    `${userData.firstName} ${userData.middleName} ${userData.surname}` : 
                    `${userData.firstName} ${userData.surname}`;
                    
                await updateFirebaseProfile(auth.currentUser, { displayName });
                
                // Update UI
                document.getElementById('user-display-name').textContent = displayName;
                
                showAlert('Profile updated successfully!', 'success', 'alert-container');
                
            } catch (error) {
                console.error('Profile update error:', error);
                showAlert('Profile update failed. Please try again.', 'error', 'alert-container');
            }
        }

        async function updateUserPassword(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-new-password').value;
            
            if (newPassword !== confirmPassword) {
                showAlert('New passwords do not match!', 'error', 'alert-container');
                return;
            }
            
            if (newPassword.length < 6) {
                showAlert('Password must be at least 6 characters long!', 'error', 'alert-container');
                return;
            }
            
            try {
                const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
                await reauthenticateWithCredential(auth.currentUser, credential);
                await updatePassword(auth.currentUser, newPassword);
                document.getElementById('password-update-form').reset();
                showAlert('Password updated successfully!', 'success', 'alert-container');
            } catch (error) {
                console.error('Password update error:', error);
                let errorMessage = 'Password update failed. Please try again.';
                if (error.code === 'auth/wrong-password') {
                    errorMessage = 'Current password is incorrect.';
                }
                showAlert(errorMessage, 'error', 'alert-container');
            }
        }

        async function savePreferences() {
            try {
                userData.preferences = {
                    emailNotifications: document.getElementById('email-notifications').checked,
                    dailyReminders: document.getElementById('daily-reminders').checked,
                    securityAlerts: document.getElementById('security-alerts').checked,
                    currency: document.getElementById('currency-preference').value,
                    language: document.getElementById('language-preference').value
                };
                await saveUserData(auth.currentUser.uid);
                showAlert('Preferences saved successfully!', 'success', 'alert-container');
            } catch (error) {
                console.error('Preferences save error:', error);
                showAlert('Failed to save preferences. Please try again.', 'error', 'alert-container');
            }
        }

        async function deleteAccount() {
            if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                return;
            }
            
            const password = prompt('Please enter your password to confirm account deletion:');
            if (!password) {
                return;
            }
            
            try {
                // Re-authenticate user
                const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
                await reauthenticateWithCredential(auth.currentUser, credential);
                
                // Delete user data from Firestore
                await deleteDoc(doc(db, 'users', auth.currentUser.uid));
                
                // Delete user account
                await deleteUser(auth.currentUser);
                
                showAlert('Account deleted successfully.', 'success');
                showAuth();
                
            } catch (error) {
                console.error('Account deletion error:', error);
                let errorMessage = 'Account deletion failed. Please try again.';
                if (error.code === 'auth/wrong-password') {
                    errorMessage = 'Incorrect password.';
                }
                showAlert(errorMessage, 'error', 'alert-container');
            }
        }

        // Make KYC functions globally available
        window.openKYCModal = openKYCModal;
        window.closeKYCModal = closeKYCModal;

        // Event listeners
        signinForm.addEventListener('submit', handleSignIn);
        signupForm.addEventListener('submit', handleSignUp);
        googleSigninBtn.addEventListener('click', handleGoogleSignIn);
        authToggleBtn.addEventListener('click', toggleAuthMode);
        logoutBtn.addEventListener('click', handleLogout);

        // Verification screen event listeners
        document.getElementById('resend-verification-btn').addEventListener('click', resendVerificationEmail);
        document.getElementById('back-to-login-btn').addEventListener('click', () => {
            showAuth();
            if (auth.currentUser && !auth.currentUser.emailVerified) {
                signOut(auth);
            }
        });

        // Initialize functionality
        updatePhoneCode();
        initializeKYC();
        initializeSettings();

        // Auth state observer
        onAuthStateChanged(auth, (user) => {
            if (user) {
                if (user.emailVerified) {
                    showDashboard(user);
                } else {
                    showVerificationScreen(user.email);
                }
            } else {
                showAuth();
            }
        });

        // Initialize the current month
        selectMonth(currentMonth);
