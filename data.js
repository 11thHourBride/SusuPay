     // Enhanced SusuPay Application with Firebase Integration
        import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, sendEmailVerification, updateProfile as updateFirebaseProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, writeBatch, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
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
        let screenshotFile = null;
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
            },
            monthlyRates: {}, // Enhanced: Track rates for each month
            rateLockedMonths: [] // Enhanced: Track which months have locked rates
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

        // Enhanced: Load user data from Firestore with monthly rate tracking
        async function loadUserData(userId) {
            try {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    userData = {
                        ...userData,
                        ...data,
                        kycDocuments: { ...userData.kycDocuments, ...data.kycDocuments },
                        preferences: { ...userData.preferences, ...data.preferences },
                        monthlyRates: data.monthlyRates || {},
                        rateLockedMonths: data.rateLockedMonths || []
                    };
                    userData.transactions = Array.isArray(data.transactions) ? data.transactions : [];
                } else {
                    await setDoc(userRef, userData);
                }
                
                updateDashboardUI();
                updateKYCBanner();
                
            } catch (error) {
                console.error('Error loading user data:', error);
                showAlert('Failed to load user data.', 'error', 'dashboard-alert-container');
            }
        }

        // Enhanced: Save user data with monthly rates
        async function saveUserData(userId) {
            try {
                const userRef = doc(db, 'users', userId);
                const userUpdate = {
                    ...userData,
                    updatedAt: new Date()
                };
                await setDoc(userRef, userUpdate, { merge: true });
            } catch (error) {
                console.error('Error saving user data:', error);
                showAlert('Failed to save data.', 'error', 'dashboard-alert-container');
            }
        }

        // Enhanced: Update dashboard UI with rate locking and safety checks
        function updateDashboardUI() {
            try {
                updateStats();
                generateCalendar();
                updateTransactionHistory();
                updateRateControls();
                
                const rateInput = document.getElementById('daily-rate-input');
                if (rateInput && userData && userData.monthlyRates) {
                    rateInput.value = userData.monthlyRates[currentMonth] || '';
                }
            } catch (error) {
                console.error('Error updating dashboard UI:', error);
            }
        }

        // Enhanced: Update statistics with better progress calculation
        function updateStats() {
            document.getElementById('total-balance').textContent = `₵${userData.balance.toFixed(2)}`;
            const currentRate = userData.monthlyRates[currentMonth] || 0;
            document.getElementById('daily-rate').textContent = `₵${currentRate.toFixed(2)}`;
            document.getElementById('contribute-amount').textContent = currentRate.toFixed(2);
            
            // Calculate month progress based on approved days (enhanced for multi-day contributions)
            const daysInMonth = 31; // All months have 31 days as requested
            const approvedDays = getApprovedDaysForMonth(currentMonth);
            const progressPercentage = Math.round((approvedDays / daysInMonth) * 100);
            
            document.getElementById('month-progress').textContent = `${progressPercentage}%`;
            const progressBar = document.getElementById('month-progress-bar');
            progressBar.style.width = `${progressPercentage}%`;
            
            // Color coding based on progress
            if (progressPercentage < 50) {
                progressBar.style.background = 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)';
            } else if (progressPercentage < 80) {
                progressBar.style.background = 'linear-gradient(135deg, #d69e2e 0%, #b7791f 100%)';
            } else {
                progressBar.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            }
        }

        // Enhanced: Generate calendar with 31 days for all months
        function generateCalendar() {
            const grid = document.getElementById('contribution-grid');
            const daysInMonth = 31; // All months have 31 days as requested
            
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

        // Enhanced: Get approved days count for a month (handles multi-day contributions)
        function getApprovedDaysForMonth(month) {
            let approvedDays = 0;
            if (userData.contributions[month]) {
                for (let day in userData.contributions[month]) {
                    if (userData.contributions[month][day].status === 'approved') {
                        approvedDays += userData.contributions[month][day].daysCovered || 1;
                    }
                }
            }
            return Math.min(approvedDays, 31);
        }

        // Enhanced: Rate control management with locking and safety checks
        function updateRateControls() {
            const setRateBtn = document.getElementById('set-rate-btn');
            const rateLockNotice = document.getElementById('rate-lock-notice');
            const currentMonthName = document.getElementById('current-month-name');
            const lockedMonthName = document.getElementById('locked-month-name');
            const rateInput = document.getElementById('daily-rate-input');
            
            // Safety check - if elements don't exist yet, retry later
            if (!setRateBtn || !rateLockNotice || !rateInput) {
                console.log('Rate control elements not found, skipping update');
                return;
            }

            // Update month name if element exists
            if (currentMonthName) {
                currentMonthName.textContent = months[currentMonth];
            }
            
            if (userData && userData.rateLockedMonths && userData.rateLockedMonths.includes(currentMonth)) {
                setRateBtn.disabled = true;
                setRateBtn.innerHTML = `Rate Locked for ${months[currentMonth]}`;
                rateLockNotice.style.display = 'block';
                if (lockedMonthName) {
                    lockedMonthName.textContent = months[currentMonth];
                }
                rateInput.disabled = true;
                rateInput.style.background = '#f1f5f9';
                rateInput.style.color = '#64748b';
            } else {
                setRateBtn.disabled = false;
                setRateBtn.innerHTML = `Set Rate for ${months[currentMonth]}`;
                rateLockNotice.style.display = 'none';
                rateInput.disabled = false;
                rateInput.style.background = '#fff';
                rateInput.style.color = '#4a5568';
            }
        }

        // Enhanced: Set user rate with month locking
        window.setUserRate = async function() {
            const rate = parseFloat(document.getElementById('daily-rate-input').value);
            if (!rate || rate <= 0) {
                showAlert('Please enter a valid daily rate!', 'error', 'dashboard-alert-container');
                return;
            }
            
            if (userData.rateLockedMonths.includes(currentMonth)) {
                showAlert('Rate is already locked for this month!', 'error', 'dashboard-alert-container');
                return;
            }
            
            userData.monthlyRates[currentMonth] = rate;
            userData.rateLockedMonths.push(currentMonth);
            userData.dailyRate = rate; // Keep for backward compatibility
            
            updateDashboardUI();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Rate set and locked for ${months[currentMonth]}! Daily contribution: ₵${rate}`, 'success', 'dashboard-alert-container');
        };

        // Enhanced: Calculate days coverage for custom contributions
        window.calculateDaysCoverage = function() {
            const customAmount = parseFloat(document.getElementById('custom-amount-input').value);
            const currentRate = userData.monthlyRates[currentMonth];
            const daysCoverageDiv = document.getElementById('days-coverage');
            const coverageDaysSpan = document.getElementById('coverage-days');
            
            if (!currentRate) {
                daysCoverageDiv.style.display = 'none';
                showAlert('Please set your daily rate for this month first!', 'info', 'dashboard-alert-container');
                return;
            }
            
            if (customAmount && customAmount > 0) {
                const daysCovered = Math.floor(customAmount / currentRate);
                if (daysCovered >= 1) {
                    coverageDaysSpan.textContent = daysCovered;
                    daysCoverageDiv.style.display = 'block';
                    
                    // Show additional info if covers multiple days
                    if (daysCovered > 1) {
                        const remainingAmount = (customAmount % currentRate).toFixed(2);
                        if (parseFloat(remainingAmount) > 0) {
                            daysCoverageDiv.innerHTML = `This amount will cover <strong>${daysCovered}</strong> days of contribution<br><small style="color: #718096;">Remaining ₵${remainingAmount} will be added to your balance</small>`;
                        }
                    }
                } else {
                    daysCoverageDiv.style.display = 'none';
                }
            } else {
                daysCoverageDiv.style.display = 'none';
            }
        };

        // Enhanced: Contribute custom amount with multi-day support
        window.contributeCustomAmount = async function() {
            const customAmount = parseFloat(document.getElementById('custom-amount-input').value);
            const currentRate = userData.monthlyRates[currentMonth];
            
            if (!currentRate) {
                showAlert('Please set your daily rate for this month first!', 'error', 'dashboard-alert-container');
                return;
            }
            
            if (!customAmount || customAmount <= 0) {
                showAlert('Please enter a valid contribution amount!', 'error', 'dashboard-alert-container');
                return;
            }
            
            const daysCovered = Math.floor(customAmount / currentRate);
            if (daysCovered < 1) {
                showAlert(`Minimum contribution amount is ₵${currentRate} (1 day coverage)!`, 'error', 'dashboard-alert-container');
                return;
            }
            
            // Find the next available day to start coverage
            const today = new Date().getDate();
            let startDay = findNextAvailableDay(today);
            
            if (startDay === -1) {
                showAlert('No available days left in this month for contribution!', 'error', 'dashboard-alert-container');
                return;
            }
            
            // Check if we have enough consecutive days available
            if (!hasConsecutiveAvailableDays(startDay, daysCovered)) {
                showAlert(`Not enough consecutive available days for ${daysCovered} days coverage!`, 'error', 'dashboard-alert-container');
                return;
            }
            
            if (!userData.contributions[currentMonth]) {
                userData.contributions[currentMonth] = {};
            }
            
            const contributionRequest = {
                amount: customAmount,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                daysCovered: daysCovered,
                startDay: startDay
            };
            
            userData.contributions[currentMonth][startDay] = contributionRequest;
            userData.transactions.unshift({
                id: `contrib_${Date.now()}`,
                type: 'contribution',
                amount: customAmount,
                date: `${months[currentMonth]} ${startDay}, 2025`,
                description: `Multi-day contribution for ${daysCovered} days (₵${customAmount})`,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                daysCovered: daysCovered,
                startDay: startDay
            });
            
            document.getElementById('custom-amount-input').value = '';
            document.getElementById('days-coverage').style.display = 'none';
            updateDashboardUI();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Multi-day contribution request of ₵${customAmount} submitted (covers ${daysCovered} days starting from day ${startDay}). Awaiting admin approval.`, 'success', 'dashboard-alert-container');
        };

        // Helper function to find next available day
        function findNextAvailableDay(startFrom) {
            for (let day = startFrom; day <= 31; day++) {
                if (!userData.contributions[currentMonth] || !userData.contributions[currentMonth][day]) {
                    return day;
                }
            }
            return -1;
        }

        // Helper function to check consecutive available days
        function hasConsecutiveAvailableDays(startDay, daysNeeded) {
            for (let i = 0; i < daysNeeded; i++) {
                const day = startDay + i;
                if (day > 31 || (userData.contributions[currentMonth] && userData.contributions[currentMonth][day])) {
                    return false;
                }
            }
            return true;
        }

        // Enhanced: Update transaction history with detailed status messages and rejection reasons
        function updateTransactionHistory() {
            const transactionsList = document.getElementById('transactions-list');
            
            if (userData.transactions.length === 0) {
                transactionsList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No transactions yet. Start contributing to see your history here!</p>';
                return;
            }
            
            transactionsList.innerHTML = '';
            
            // Sort transactions by date (newest first)
            const sortedTransactions = [...userData.transactions].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
            
            sortedTransactions.forEach(transaction => {
                const transactionItem = document.createElement('div');
                transactionItem.className = 'transaction-item';
                
                let statusMessage = '';
                let statusClass = `status-${transaction.status}`;
                let additionalInfo = '';
                
                // Enhanced status messages with detailed success information
                if (transaction.status === 'approved') {
                    if (transaction.type === 'contribution') {
                        const dailyRate = transaction.daysCovered ? (transaction.amount / transaction.daysCovered).toFixed(2) : transaction.amount.toFixed(2);
                        
                        // Special formatting for multi-day contributions
                        if (transaction.daysCovered && transaction.daysCovered > 1) {
                            statusMessage = `✅ Multi-Day Contribution Success - ₵${transaction.amount.toFixed(2)}`;
                        } else {
                            statusMessage = `✅ Successful Contribution - ₵${transaction.amount.toFixed(2)}`;
                        }
                        
                        let successDetails = [];
                        
                        // Add date information
                        if (transaction.date) {
                            successDetails.push(`Month: ${transaction.date.split(' ')[0]}`);
                        }
                        
                        // Add multi-day coverage information with daily rate
                        if (transaction.daysCovered && transaction.daysCovered > 1) {
                            successDetails.push(`${transaction.daysCovered} Days Covered Successfully`);
                            successDetails.push(`Days: ${transaction.startDay} - ${transaction.startDay + transaction.daysCovered - 1}`);
                            successDetails.push(`Daily Rate: ₵${dailyRate}`);
                        } else {
                            successDetails.push(`Day: ${transaction.date.split(' ')[1]}`);
                        }
                        
                        // Add approval timestamp
                        if (transaction.approvedAt) {
                            const approvedDate = new Date(transaction.approvedAt).toLocaleString();
                            successDetails.push(`Approved: ${approvedDate}`);
                        }
                        
                        additionalInfo = `<div style="color: #38a169; font-size: 0.85rem; margin-top: 5px; padding: 8px; background: #f0fff4; border-radius: 6px; border: 1px solid #9ae6b4;">
                            ${successDetails.map(detail => `✓ ${detail}`).join('<br>')}
                        </div>`;
                        
                    } else if (transaction.type === 'withdrawal') {
                        statusMessage = `✅ Successful Withdrawal - ₵${transaction.amount.toFixed(2)}`;
                        let successDetails = [];
                        
                        // Add withdrawal details
                        if (transaction.approvedAt) {
                            const approvedDate = new Date(transaction.approvedAt).toLocaleString();
                            successDetails.push(`Processed: ${approvedDate}`);
                        }
                        
                        if (transaction.commission) {
                            successDetails.push(`Commission: ₵${transaction.commission.toFixed(2)}`);
                        }
                        
                        if (transaction.method) {
                            successDetails.push(`Method: ${transaction.method}`);
                        }
                        
                        additionalInfo = `<div style="color: #38a169; font-size: 0.85rem; margin-top: 5px; padding: 8px; background: #f0fff4; border-radius: 6px; border: 1px solid #9ae6b4;">
                            ${successDetails.map(detail => `✓ ${detail}`).join('<br>')}
                        </div>`;
                    }
                } else if (transaction.status === 'rejected') {
                    if (transaction.type === 'contribution') {
                        statusMessage = transaction.daysCovered > 1 ? 
                            `❌ Multi-Day Contribution Rejected - ₵${transaction.amount.toFixed(2)}` :
                            `❌ Contribution Rejected - ₵${transaction.amount.toFixed(2)}`;
                    } else if (transaction.type === 'withdrawal') {
                        statusMessage = `❌ Withdrawal Rejected - ₵${transaction.amount.toFixed(2)}`;
                    }
                } else {
                    // Pending status with enhanced information
                    const transactionType = transaction.type === 'contribution' ? 
                        (transaction.daysCovered > 1 ? '🕒 Multi-Day Contribution Pending' : '🕒 Contribution Pending') : 
                        '🕒 Withdrawal Pending';
                    statusMessage = `${transactionType} - ₵${transaction.amount.toFixed(2)}`;
                    
                    if (transaction.type === 'contribution' && transaction.daysCovered > 1) {
                        const dailyRate = (transaction.amount / transaction.daysCovered).toFixed(2);
                        additionalInfo = `<div style="color: #744210; font-size: 0.85rem; margin-top: 3px; padding: 8px; background: #fef5e7; border-radius: 6px; border: 1px solid #f6cc33;">
                            ⏳ ${transaction.daysCovered} days pending approval<br>
                            📅 Days: ${transaction.startDay} - ${transaction.startDay + transaction.daysCovered - 1}<br>
                            💰 Daily Rate: ₵${dailyRate}
                        </div>`;
                    }
                }
                
                let rejectionReason = '';
                if (transaction.status === 'rejected' && transaction.rejectionReason) {
                    rejectionReason = `
                        <div class="rejection-reason">
                            <div class="reason-title">Rejection Reason:</div>
                            <div>${transaction.rejectionReason}</div>
                        </div>
                    `;
                }
                
                // Add appropriate icon based on transaction type and status
                const getTransactionIcon = (type, status) => {
                    if (status === 'approved') {
                        return type === 'contribution' ? '💰' : '💸';
                    } else if (status === 'rejected') {
                        return '❌';
                    } else {
                        return '⏳';
                    }
                };

                const icon = getTransactionIcon(transaction.type, transaction.status);
                
                transactionItem.innerHTML = `
                    <div style="display: flex; align-items: flex-start; gap: 15px;">
                        <div style="font-size: 1.5rem; line-height: 1;">${icon}</div>
                        <div style="flex: 1;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${transaction.description}</div>
                        <div style="color: #718096; font-size: 0.9rem;">${transaction.date}</div>
                        ${additionalInfo}
                        ${rejectionReason}
                    </div>
                    <div style="text-align: right; min-width: 120px;">
                        <div style="font-weight: 600; color: ${transaction.type === 'contribution' ? '#38a169' : '#e53e3e'}; margin-bottom: 8px;">
                            ${transaction.type === 'contribution' ? '+' : '-'}₵${transaction.amount.toFixed(2)}
                        </div>
                        <div class="transaction-status ${statusClass}" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 12px;">
                            ${statusMessage}
                        </div>
                    </div>
                `;
                
                transactionsList.appendChild(transactionItem);
            });
        }

        // Simulate admin actions for demo (Enhanced with multi-day support)
        function simulateAdminApproval(transactionId, approved = true, rejectionReason = '') {
            // Find and update the transaction in the transactions array
            const transactionIndex = userData.transactions.findIndex(t => t.id === transactionId);
            if (transactionIndex === -1) return;
            
            // Get the transaction and create a new updated version
            const transaction = { ...userData.transactions[transactionIndex] };
            const currentTime = new Date().toISOString();
            
            if (approved) {
                // Update basic approval information
                transaction.status = 'approved';
                transaction.approvedAt = currentTime;
                transaction.updatedAt = currentTime;
                
                if (transaction.type === 'contribution') {
                    userData.balance += transaction.amount;
                    
                    // Handle multi-day contributions
                    const daysCovered = transaction.daysCovered || 1;
                    const startDay = transaction.startDay || parseInt(transaction.date.split(' ')[1]);
                    const monthName = transaction.date.split(' ')[0];
                    const monthIndex = months.indexOf(monthName);
                    
                    // Update transaction with contribution details
                    transaction.dailyRate = transaction.amount / daysCovered;
                    transaction.daysProcessed = true; // Flag to indicate days have been processed
                    
                    if (monthIndex !== -1) {
                        if (!userData.contributions[monthIndex]) {
                            userData.contributions[monthIndex] = {};
                        }
                        
                        // Mark multiple days as contributed
                        for (let i = 0; i < daysCovered && (startDay + i) <= 31; i++) {
                            const day = startDay + i;
                            const isFirstDay = i === 0;
                            
                            userData.contributions[monthIndex][day] = {
                                amount: isFirstDay ? transaction.amount : 0,
                                status: 'approved',
                                daysCovered: isFirstDay ? daysCovered : 1,
                                coveredBy: isFirstDay ? null : startDay,
                                requestedAt: transaction.requestedAt,
                                approvedAt: currentTime,
                                dailyRate: transaction.dailyRate,
                                isPartOfMultiDay: daysCovered > 1,
                                multiDayStart: startDay,
                                multiDayEnd: startDay + daysCovered - 1,
                                transactionId: transaction.id
                            };
                        }
                    }
                } else if (transaction.type === 'withdrawal') {
                    // Update withdrawal specific details
                    userData.balance -= transaction.totalDeduction || transaction.amount;
                    transaction.processedAt = currentTime;
                    transaction.withdrawalConfirmed = true;
                }
                
                // Add approval details
                transaction.approvedBy = {
                    timestamp: currentTime,
                    action: 'approved'
                };
                
            } else {
                // Handle rejection
                transaction.status = 'rejected';
                transaction.rejectionReason = rejectionReason;
                transaction.updatedAt = currentTime;
                transaction.rejectedAt = currentTime;
                
                if (transaction.type === 'contribution') {
                    // Mark contribution days as rejected
                    const startDay = transaction.startDay || parseInt(transaction.date.split(' ')[1]);
                    const monthName = transaction.date.split(' ')[0];
                    const monthIndex = months.indexOf(monthName);
                    
                    if (monthIndex !== -1 && userData.contributions[monthIndex] && userData.contributions[monthIndex][startDay]) {
                        userData.contributions[monthIndex][startDay].status = 'rejected';
                        userData.contributions[monthIndex][startDay].rejectionReason = rejectionReason;
                    }
                }
            }
            
            updateDashboardUI();
        }

        // Rest of the original functionality (keeping all existing functions)
        window.contributeToday = function() {
            const today = new Date().getDate();
            contributeForDay(today);
        };

        window.contributeForDay = async function(day) {
            const currentRate = userData.monthlyRates[currentMonth];
            if (!currentRate) {
                showAlert('Please set your daily rate for this month first!', 'error', 'dashboard-alert-container');
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
                amount: currentRate,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                daysCovered: 1
            };
            
            userData.contributions[currentMonth][day] = contributionRequest;
            userData.transactions.unshift({
                id: `contrib_${Date.now()}`,
                type: 'contribution',
                amount: currentRate,
                date: `${months[currentMonth]} ${day}, 2025`,
                description: `Daily contribution request for ${months[currentMonth]} ${day}`,
                status: 'pending',
                requestedAt: new Date().toISOString(),
                daysCovered: 1,
                startDay: day
            });
            
            updateDashboardUI();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Contribution request of ₵${currentRate} submitted for day ${day}. Awaiting admin approval.`, 'success', 'dashboard-alert-container');
        };

        window.processWithdrawal = async function() {
            const amount = parseFloat(document.getElementById('withdrawal-amount').value);
            if (!amount || amount <= 0) {
                showAlert('Please enter a valid withdrawal amount!', 'error', 'dashboard-alert-container');
                return;
            }
            
            const currentRate = userData.monthlyRates[currentMonth] || userData.dailyRate || 0;
            if (!currentRate) {
                showAlert('Please set your daily rate first!', 'error', 'dashboard-alert-container');
                return;
            }
            
            if (amount > userData.balance) {
                showAlert('Insufficient balance for this withdrawal!', 'error', 'dashboard-alert-container');
                return;
            }
            
            const commission = currentRate;
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
            updateDashboardUI();
            await saveUserData(auth.currentUser.uid);
            showAlert(`Withdrawal request of ₵${amount} submitted. Awaiting admin approval.`, 'success', 'dashboard-alert-container');
        };

        window.selectMonth = function(monthIndex) {
            currentMonth = monthIndex;
            document.querySelectorAll('.month-btn').forEach((btn, index) => {
                btn.classList.remove('active');
                if (index === monthIndex) {
                    btn.classList.add('active');
                }
            });
            
            document.getElementById('current-month-display').querySelector('h3').textContent = `${months[monthIndex]} 2025`;
            updateDashboardUI();
        };

        // Initialize all the original functionality
        function initializeKYC() {
            setupFileUpload('front-id-upload', 'front-id-input', 'front-id-preview', 'front-id-image', 'frontId');
            setupFileUpload('back-id-upload', 'back-id-input', 'back-id-preview', 'back-id-image', 'backId');
            
            document.getElementById('start-camera-btn').addEventListener('click', startCamera);
            document.getElementById('capture-selfie-btn').addEventListener('click', captureSelfie);
            document.getElementById('retake-selfie-btn').addEventListener('click', retakeSelfie);
            document.getElementById('start-kyc-btn').addEventListener('click', openKYCModal);
            document.getElementById('close-kyc-modal').addEventListener('click', closeKYCModal);
            document.getElementById('submit-kyc-btn').addEventListener('click', submitKYC);
            
            document.querySelectorAll('#kyc-modal .nav-tab').forEach(tab => {
                tab.addEventListener('click', () => switchKYCTab(tab.dataset.tab));
            });
        }

        function setupFileUpload(uploadAreaId, inputId, previewId, imageId, docType) {
            const uploadArea = document.getElementById(uploadAreaId);
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            const image = document.getElementById(imageId);
            
            uploadArea.addEventListener('click', () => input.click());
            
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0], preview, image, docType);
                }
            });
        }

        async function handleFileUpload(file, preview, image, docType) {
            if (!file.type.startsWith('image/')) {
                showAlert('Please upload a valid image file!', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                image.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
            
            userData.kycDocuments[docType] = 'uploaded';
            showAlert(`${docType === 'frontId' ? 'Front' : 'Back'} ID uploaded successfully!`, 'success');
        }

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
            } catch (error) {
                showAlert('Camera access denied. Please allow camera access and try again.', 'error');
            }
        }

        async function captureSelfie() {
            const video = document.getElementById('selfie-video');
            const canvas = document.getElementById('selfie-canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            const preview = document.getElementById('selfie-preview');
            const image = document.getElementById('selfie-image');
            image.src = canvas.toDataURL();
            preview.style.display = 'block';
            
            userData.kycDocuments.selfie = 'captured';
            document.getElementById('capture-selfie-btn').style.display = 'none';
            document.getElementById('retake-selfie-btn').style.display = 'inline-block';
            
            showAlert('Selfie captured successfully!', 'success');
        }

        function retakeSelfie() {
            document.getElementById('selfie-preview').style.display = 'none';
            document.getElementById('capture-selfie-btn').style.display = 'inline-block';
            document.getElementById('retake-selfie-btn').style.display = 'none';
        }

        function openKYCModal() {
            kycModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            updateKYCStatus();
        }

        function closeKYCModal() {
            kycModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
        }

        function switchKYCTab(tabName) {
            document.querySelectorAll('#kyc-modal .nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`#kyc-modal [data-tab="${tabName}"]`).classList.add('active');
            
            document.querySelectorAll('#kyc-modal .tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(tabName).style.display = 'block';
            
            currentKycTab = tabName;
        }

        async function submitKYC() {
            if (!userData.kycDocuments.frontId || !userData.kycDocuments.backId || !userData.kycDocuments.selfie) {
                showAlert('Please complete all verification steps before submitting!', 'error');
                return;
            }
            
            userData.kycStatus = 'pending';
            await saveUserData(auth.currentUser.uid);
            
            showAlert('KYC documents submitted successfully! We will review your documents within 24-48 hours.', 'success', 'dashboard-alert-container');
            closeKYCModal();
            updateKYCBanner();
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
            
            document.querySelectorAll('#settings-modal .nav-tab').forEach(tab => {
                tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
            });
            
            document.getElementById('profile-update-form').addEventListener('submit', updateUserProfile);
            document.getElementById('save-preferences-btn').addEventListener('click', savePreferences);
        }

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
            document.querySelectorAll('#settings-modal .nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`#settings-modal [data-tab="${tabName}"]`).classList.add('active');
            
            document.querySelectorAll('#settings-modal .tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(tabName).style.display = 'block';
        }

        function loadUserSettings() {
            document.getElementById('edit-first-name').value = userData.firstName || '';
            document.getElementById('edit-middle-name').value = userData.middleName || '';
            document.getElementById('edit-surname').value = userData.surname || '';
            document.getElementById('edit-email-display').value = userData.email || '';
            document.getElementById('edit-country-display').value = userData.country || '';
            document.getElementById('edit-phone').value = userData.phone || '';
        }

        async function updateUserProfile(e) {
            e.preventDefault();
            
            userData.firstName = document.getElementById('edit-first-name').value.trim();
            userData.middleName = document.getElementById('edit-middle-name').value.trim();
            userData.surname = document.getElementById('edit-surname').value.trim();
            userData.country = document.getElementById('edit-country-display').value;
            userData.phone = document.getElementById('edit-phone').value.trim();
            
            await saveUserData(auth.currentUser.uid);
            showAlert('Profile updated successfully!', 'success');
        }

        async function savePreferences() {
            userData.preferences = {
                emailNotifications: document.getElementById('email-notifications').checked,
                dailyReminders: document.getElementById('daily-reminders').checked,
                securityAlerts: document.getElementById('security-alerts').checked,
                currency: document.getElementById('currency-preference').value,
                language: document.getElementById('language-preference').value
            };
            await saveUserData(auth.currentUser.uid);
            showAlert('Preferences saved successfully!', 'success');
        }

        // Report Problem functionality
        function initializeReportProblem() {
            const reportModal = document.getElementById('report-modal');
            const reportBtn = document.getElementById('report-btn');
            const closeReportBtn = document.getElementById('close-report-modal');
            const reportForm = document.getElementById('report-problem-form');

            reportBtn.addEventListener('click', () => {
                reportModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            });

            closeReportBtn.addEventListener('click', () => {
                reportModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                reportForm.reset();
            });

            reportForm.addEventListener('submit', handleReportSubmission);
        }

        async function handleReportSubmission(e) {
            e.preventDefault();
            
            const category = document.getElementById('problem-category').value;
            const description = document.getElementById('problem-description').value;
            
            showAlert('Your report has been submitted successfully. We\'ll look into it as soon as possible.', 'success');
            document.getElementById('report-modal').style.display = 'none';
            document.getElementById('report-problem-form').reset();
        }

        // Initialize app with real user data
        function initializeSusuPayApp() {
            // Set up event listeners
            signinForm.addEventListener('submit', handleSignIn);
            signupForm.addEventListener('submit', handleSignUp);
            googleSigninBtn.addEventListener('click', handleGoogleSignIn);
            authToggleBtn.addEventListener('click', toggleAuthMode);
            logoutBtn.addEventListener('click', handleLogout);

            // Verification screen event listeners
            document.getElementById('resend-verification-btn').addEventListener('click', resendVerificationEmail);
            document.getElementById('back-to-login-btn').addEventListener('click', showAuth);

            // Reset to clean state for real user data
            userData = {
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
                },
                monthlyRates: {},
                rateLockedMonths: []
            };

            // Auth state observer
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) {
                        showVerificationScreen(user.email);
                        return;
                    }
                    await loadUserData(user.uid);
                    showDashboard(user);
                } else {
                    showAuth();
                }
            });

            // Initialize the current month
            selectMonth(currentMonth);
        }

        // Enhanced form validation
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

                const newUserData = {
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
                    monthlyRates: {},
                    rateLockedMonths: [],
                    createdAt: new Date(),
                    emailVerified: user.emailVerified
                };

                await setDoc(userRef, newUserData);
            }
        }

        // Show verification screen
        function showVerificationScreen(email) {
            authContainer.style.display = 'none';
            verificationContainer.style.display = 'block';
            document.getElementById('verification-email').textContent = email;
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

        // Show authentication screen
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
                // Reset user data
                initializeSusuPayApp();
            } catch (error) {
                console.error('Logout error:', error);
                showAlert('Logout failed. Please try again.', 'error', 'dashboard-alert-container');
            }
        }

        // Initialize functionality
        updatePhoneCode();
        initializeKYC();
        initializeSettings();
        initializeReportProblem();
        initializeSusuPayApp();
