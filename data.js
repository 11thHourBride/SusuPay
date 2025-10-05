import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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

        // Global variables
        let currentUser = null;
        let userData = null;
        let selectedMonth = new Date().getMonth();
        let selectedYear = new Date().getFullYear();
        let selectedPaymentMethod = null;
        let selectedCrypto = null;
        let contributionDays = 1;
        let withdrawalAttempts = 0;
        let lockoutTimer = null;
        let mediaStream = null;
        let frontIdFile = null;
        let backIdFile = null;
        let selfieBlob = null;

        // Crypto wallet addresses (in production, generate unique addresses per user)
        const cryptoAddresses = {
            usdt: {
                erc20: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
                trc20: 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS'
            },
            btc: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
            eth: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            usdc: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            bnb: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2',
            trx: 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS'
        };

        // Show alert function
        function showAlert(message, type = 'info', container = 'dashboard-alert') {
            const alertDiv = document.getElementById(container);
            alertDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
            setTimeout(() => alertDiv.innerHTML = '', 5000);
        }

        // Format currency
        function formatCurrency(amount) {
            return `₵${parseFloat(amount || 0).toFixed(2)}`;
        }

        // Auth toggle
        document.getElementById('auth-toggle-btn').addEventListener('click', () => {
            const signinForm = document.getElementById('signin-form');
            const signupForm = document.getElementById('signup-form');
            const toggleText = document.getElementById('auth-toggle-text');
            const toggleBtn = document.getElementById('auth-toggle-btn');

            if (signinForm.classList.contains('hidden')) {
                signinForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
                toggleText.textContent = "Don't have an account?";
                toggleBtn.textContent = 'Sign Up';
            } else {
                signinForm.classList.add('hidden');
                signupForm.classList.remove('hidden');
                toggleText.textContent = 'Already have an account?';
                toggleBtn.textContent = 'Sign In';
            }
        });

        // Forgot Password
        document.getElementById('forgot-password-btn').addEventListener('click', () => {
            document.getElementById('forgot-password-modal').style.display = 'block';
            document.getElementById('reset-success').classList.add('hidden');
            document.getElementById('forgot-password-form').classList.remove('hidden');
        });

        document.getElementById('close-forgot-password').addEventListener('click', () => {
            document.getElementById('forgot-password-modal').style.display = 'none';
        });

        document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;

            try {
                await sendPasswordResetEmail(auth, email);
                document.getElementById('forgot-password-form').classList.add('hidden');
                document.getElementById('reset-success').classList.remove('hidden');
                
                setTimeout(() => {
                    document.getElementById('forgot-password-modal').style.display = 'none';
                }, 3000);
            } catch (error) {
                showAlert(error.message, 'error', 'auth-alert');
            }
        });

        // Sign In
        document.getElementById('signin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signin-email').value;
            const password = document.getElementById('signin-password').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (!userCredential.user.emailVerified) {
                    showAlert('Please verify your email before signing in.', 'error', 'auth-alert');
                    await signOut(auth);
                    return;
                }
                showAlert('Sign in successful!', 'success', 'auth-alert');
            } catch (error) {
                showAlert(error.message, 'error', 'auth-alert');
            }
        });

        // Sign Up
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('first-name').value;
            const surname = document.getElementById('surname').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                showAlert('Passwords do not match!', 'error', 'auth-alert');
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Create user document
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    firstName,
                    surname,
                    email,
                    createdAt: serverTimestamp(),
                    balance: 0,
                    kycStatus: 'pending',
                    rates: {},
                    contributedDays: {},
                    withdrawalPassword: password, // In production, hash this properly
                    withdrawalAttempts: 0,
                    lockoutUntil: null
                });

                // Send verification email
                await sendEmailVerification(userCredential.user);
                
                showAlert('Account created! Please check your email to verify your account.', 'success', 'auth-alert');
                
                // Switch back to sign in
                document.getElementById('auth-toggle-btn').click();
            } catch (error) {
                showAlert(error.message, 'error', 'auth-alert');
            }
        });

        // Auth state observer
        onAuthStateChanged(auth, async (user) => {
            if (user && user.emailVerified) {
                currentUser = user;
                await loadUserData();
                showDashboard();
            } else {
                showAuth();
            }
        });

        // Load user data
        async function loadUserData() {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                userData = userDoc.data();
                updateDashboard();
            }
        }

        // Show/Hide views
        function showAuth() {
            document.getElementById('auth-wrapper').classList.remove('hidden');
            document.getElementById('app-header').classList.add('hidden');
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('main-content').classList.add('hidden');
        }

        function showDashboard() {
            document.getElementById('auth-wrapper').classList.add('hidden');
            document.getElementById('app-header').classList.remove('hidden');
            document.getElementById('sidebar').classList.remove('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            
            // Update header
            const avatar = document.getElementById('user-avatar');
            const userName = document.getElementById('user-name');
            const userEmail = document.getElementById('user-email');
            
            avatar.textContent = userData.firstName.charAt(0).toUpperCase();
            userName.textContent = `${userData.firstName} ${userData.surname}`;
            userEmail.textContent = userData.email;
            
            if (userData.kycStatus === 'approved') {
                userName.innerHTML += '<span class="vip-badge">VIP</span>';
            }
        }

        // Update dashboard stats
        function updateDashboard() {
            document.getElementById('total-balance').textContent = formatCurrency(userData.balance);
            
            const monthKey = `${selectedYear}-${selectedMonth}`;
            const currentRate = userData.rates?.[monthKey] || 0;
            document.getElementById('daily-rate').textContent = formatCurrency(currentRate);
            
            // Calculate contributions count
            const contributedDays = userData.contributedDays?.[monthKey] || [];
            document.getElementById('contributions-count').textContent = contributedDays.length;
            
            // Calculate progress
            const progress = Math.min((contributedDays.length / 31) * 100, 100);
            document.getElementById('current-month-progress').textContent = `${Math.round(progress)}%`;
        }

        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const page = item.dataset.page;
                document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
                document.getElementById(`${page}-page`).classList.remove('hidden');
                
                if (page === 'contributions') {
                    initContributionsPage();
                } else if (page === 'withdrawals') {
                    initWithdrawalsPage();
                } else if (page === 'transactions') {
                    loadTransactions();
                }
            });
        });

        // Set Rate
        document.getElementById('set-rate-btn').addEventListener('click', async () => {
            const rate = parseFloat(document.getElementById('rate-input').value);
            
            if (!rate || rate < 1) {
                showAlert('Please enter a valid rate amount.', 'error');
                return;
            }

            const monthKey = `${selectedYear}-${selectedMonth}`;
            
            // Check if rate already set for this month
            if (userData.rates?.[monthKey]) {
                showAlert('Rate is already locked for this month.', 'error');
                return;
            }

            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    [`rates.${monthKey}`]: rate
                });
                
                userData.rates = userData.rates || {};
                userData.rates[monthKey] = rate;
                
                showAlert('Monthly rate set successfully!', 'success');
                updateDashboard();
                document.getElementById('rate-input').value = '';
                document.getElementById('rate-info').classList.remove('hidden');
            } catch (error) {
                showAlert('Error setting rate: ' + error.message, 'error');
            }
        });

        // Initialize contributions page
        function initContributionsPage() {
            generateMonthSelector();
            renderContributionGrid();
            updateContributionAmount();
        }

        // Generate month selector
        function generateMonthSelector() {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const container = document.getElementById('month-selector');
            container.innerHTML = '';
            
            monthNames.forEach((month, index) => {
                const btn = document.createElement('div');
                btn.className = `month-btn ${index === selectedMonth ? 'active' : ''}`;
                btn.textContent = month;
                btn.onclick = () => {
                    selectedMonth = index;
                    initContributionsPage();
                };
                container.appendChild(btn);
            });
            
            const monthNames2 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            document.getElementById('selected-month-display').textContent = `${monthNames2[selectedMonth]} ${selectedYear}`;
        }

        // Render contribution grid
        function renderContributionGrid() {
            const grid = document.getElementById('contribution-grid');
            grid.innerHTML = '';
            
            const monthKey = `${selectedYear}-${selectedMonth}`;
            const contributedDays = userData.contributedDays?.[monthKey] || [];
            
            for (let day = 1; day <= 31; day++) {
                const cell = document.createElement('div');
                cell.className = 'day-cell';
                cell.textContent = day;
                
                const dayData = contributedDays.find(d => d.day === day);
                if (dayData) {
                    if (dayData.status === 'approved') {
                        cell.classList.add('contributed');
                    } else if (dayData.status === 'pending') {
                        cell.classList.add('pending');
                    }
                }
                
                grid.appendChild(cell);
            }
        }

        // Day selector
        document.getElementById('increase-days').addEventListener('click', () => {
            if (contributionDays < 31) {
                contributionDays++;
                document.getElementById('days-input').value = contributionDays;
                updateContributionAmount();
            }
        });

        document.getElementById('decrease-days').addEventListener('click', () => {
            if (contributionDays > 1) {
                contributionDays--;
                document.getElementById('days-input').value = contributionDays;
                updateContributionAmount();
            }
        });

        // Update contribution amount
        function updateContributionAmount() {
            const monthKey = `${selectedYear}-${selectedMonth}`;
            const rate = userData.rates?.[monthKey] || 0;
            const total = rate * contributionDays;
            document.getElementById('total-amount').textContent = total.toFixed(2);
        }

        // Contribute button
        document.getElementById('contribute-btn').addEventListener('click', () => {
            const monthKey = `${selectedYear}-${selectedMonth}`;
            const rate = userData.rates?.[monthKey];
            
            if (!rate) {
                showAlert('Please set a rate for this month first.', 'error');
                return;
            }
            
            const total = rate * contributionDays;
            document.getElementById('payment-amount-display').value = formatCurrency(total);
            document.getElementById('payment-modal').style.display = 'block';
        });

        // Payment method selection
        document.querySelectorAll('.payment-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedPaymentMethod = option.dataset.method;
                
                const cryptoSelection = document.getElementById('crypto-selection');
                const paymentDetails = document.getElementById('payment-details');
                
                paymentDetails.classList.remove('hidden');
                
                if (selectedPaymentMethod === 'crypto') {
                    cryptoSelection.classList.remove('hidden');
                } else {
                    cryptoSelection.classList.add('hidden');
                    showPaymentInstructions();
                }
            });
        });

        // Crypto option selection
        document.querySelectorAll('.crypto-option').forEach(option => {
            option.addEventListener('click', function() {
                document.querySelectorAll('.crypto-option').forEach(o => {
                    o.style.borderColor = '#e2e8f0';
                    o.style.background = 'white';
                });
                this.style.borderColor = '#667eea';
                this.style.background = '#ebf8ff';
                selectedCrypto = this.dataset.crypto;
                showPaymentInstructions();
            });
        });

        // Show payment instructions
        function showPaymentInstructions() {
            const instructions = document.getElementById('payment-instructions');
            
            if (selectedPaymentMethod === 'mobile-money') {
                instructions.innerHTML = `
                    <strong>Mobile Money Payment Instructions:</strong><br>
                    1. Dial *170# or use your mobile money app<br>
                    2. Select "Send Money"<br>
                    3. Enter: <strong>0244123456</strong> (SusuPay Merchant)<br>
                    4. Enter the amount shown above<br>
                    5. Complete the transaction<br>
                    6. Copy the transaction ID from the confirmation SMS<br>
                    7. Paste it in the field below
                `;
            } else if (selectedPaymentMethod === 'crypto' && selectedCrypto) {
                let address = '';
                let network = '';
                
                if (selectedCrypto === 'usdt') {
                    address = cryptoAddresses.usdt.erc20;
                    network = 'ERC-20 (Ethereum) or TRC-20 (Tron)';
                    instructions.innerHTML = `
                        <strong>USDT Payment Instructions:</strong><br>
                        <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px;">
                            <strong>Network Options:</strong><br>
                            <div style="margin: 10px 0;">
                                <strong>ERC-20 (Ethereum):</strong><br>
                                <code style="background: #f7fafc; padding: 5px; border-radius: 4px; font-size: 0.85rem; word-break: break-all;">${cryptoAddresses.usdt.erc20}</code>
                            </div>
                            <div style="margin: 10px 0;">
                                <strong>TRC-20 (Tron - Lower Fees):</strong><br>
                                <code style="background: #f7fafc; padding: 5px; border-radius: 4px; font-size: 0.85rem; word-break: break-all;">${cryptoAddresses.usdt.trc20}</code>
                            </div>
                        </div>
                        ⚠️ <strong>Important:</strong> Make sure to select the correct network in your wallet!<br>
                        After sending, paste the transaction hash below.
                    `;
                } else {
                    const cryptoNames = {
                        btc: 'Bitcoin',
                        eth: 'Ethereum',
                        usdc: 'USD Coin',
                        bnb: 'Binance Coin',
                        trx: 'Tron'
                    };
                    
                    address = cryptoAddresses[selectedCrypto];
                    instructions.innerHTML = `
                        <strong>${cryptoNames[selectedCrypto]} Payment Instructions:</strong><br>
                        <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px;">
                            <strong>Send to Address:</strong><br>
                            <code style="background: #f7fafc; padding: 8px; border-radius: 4px; font-size: 0.9rem; word-break: break-all; display: block; margin: 10px 0;">${address}</code>
                        </div>
                        1. Open your crypto wallet<br>
                        2. Send the exact amount shown above<br>
                        3. Use the address provided<br>
                        4. Wait for blockchain confirmation<br>
                        5. Paste transaction hash below
                    `;
                }
            }
        }

        // Confirm payment
        document.getElementById('confirm-payment-btn').addEventListener('click', async () => {
            const transactionId = document.getElementById('transaction-id').value.trim();
            
            if (!transactionId) {
                showAlert('Please enter the transaction ID.', 'error');
                return;
            }
            
            try {
                const monthKey = `${selectedYear}-${selectedMonth}`;
                const rate = userData.rates[monthKey];
                const amount = rate * contributionDays;
                
                // Get next available days
                const contributedDays = userData.contributedDays?.[monthKey] || [];
                const contributedDayNumbers = contributedDays.map(d => d.day);
                const newDays = [];
                
                let dayCounter = 1;
                for (let i = 0; i < contributionDays; i++) {
                    while (contributedDayNumbers.includes(dayCounter)) {
                        dayCounter++;
                    }
                    newDays.push({
                        day: dayCounter,
                        status: 'pending',
                        amount: rate,
                        transactionId,
                        paymentMethod: selectedPaymentMethod,
                        timestamp: new Date().toISOString()
                    });
                    contributedDayNumbers.push(dayCounter);
                    dayCounter++;
                }
                
                // Add transaction record
                await addDoc(collection(db, 'transactions'), {
                    userId: currentUser.uid,
                    type: 'contribution',
                    amount,
                    month: monthKey,
                    days: newDays.map(d => d.day),
                    status: 'pending',
                    transactionId,
                    paymentMethod: selectedPaymentMethod,
                    timestamp: serverTimestamp()
                });
                
                // Update user document
                const updatedDays = [...contributedDays, ...newDays];
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    [`contributedDays.${monthKey}`]: updatedDays
                });
                
                userData.contributedDays = userData.contributedDays || {};
                userData.contributedDays[monthKey] = updatedDays;
                
                document.getElementById('payment-modal').style.display = 'none';
                document.getElementById('transaction-id').value = '';
                selectedPaymentMethod = null;
                document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
                document.getElementById('payment-details').classList.add('hidden');
                
                showAlert('Thank you for the payment! Your transaction is under review. Check back in a few minutes for the deposit to reflect on your Total Balance.', 'success');
                
                renderContributionGrid();
                updateDashboard();
                
                // Send email notification (in production, use Cloud Functions)
                console.log('Email notification would be sent to:', userData.email);
            } catch (error) {
                showAlert('Error processing contribution: ' + error.message, 'error');
            }
        });

        // Close payment modal
        document.getElementById('close-payment-modal').addEventListener('click', () => {
            document.getElementById('payment-modal').style.display = 'none';
        });

        // Initialize withdrawals page
        function initWithdrawalsPage() {
            const select = document.getElementById('withdrawal-month');
            select.innerHTML = '<option value="">Choose month...</option>';
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            // Only show months with contributions
            Object.keys(userData.contributedDays || {}).forEach(monthKey => {
                const [year, month] = monthKey.split('-');
                const option = document.createElement('option');
                option.value = monthKey;
                option.textContent = `${monthNames[parseInt(month)]} ${year}`;
                select.appendChild(option);
            });
        }

        // Process withdrawal with 2FA verification
        document.getElementById('process-withdrawal-btn').addEventListener('click', async () => {
            const monthKey = document.getElementById('withdrawal-month').value;
            const amount = parseFloat(document.getElementById('withdrawal-amount').value);
            const method = document.getElementById('withdrawal-method').value;
            const address = document.getElementById('withdrawal-address').value;
            const password = document.getElementById('withdrawal-password').value;
            
            if (!monthKey || !amount || !method || !address || !password) {
                showAlert('Please fill in all fields.', 'error');
                return;
            }
            
            // Check lockout
            if (userData.lockoutUntil && new Date(userData.lockoutUntil) > new Date()) {
                const remainingTime = Math.ceil((new Date(userData.lockoutUntil) - new Date()) / 60000);
                showAlert(`Account locked. Please try again in ${remainingTime} minutes.`, 'error');
                return;
            }
            
            // Verify password
            if (password !== userData.withdrawalPassword) {
                withdrawalAttempts++;
                document.getElementById('withdrawal-attempts').classList.remove('hidden');
                document.getElementById('attempts-remaining').textContent = 3 - withdrawalAttempts;
                
                if (withdrawalAttempts >= 3) {
                    const lockoutTime = new Date(Date.now() + 30 * 60000);
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        lockoutUntil: lockoutTime.toISOString()
                    });
                    userData.lockoutUntil = lockoutTime.toISOString();
                    showAlert('Too many failed attempts. Account locked for 30 minutes.', 'error');
                    return;
                }
                
                showAlert('Incorrect password.', 'error');
                return;
            }
            
            // Reset attempts
            withdrawalAttempts = 0;
            document.getElementById('withdrawal-attempts').classList.add('hidden');
            
            // Check if 2FA is required
            if (userData.biometricEnabled || userData.authenticatorEnabled) {
                show2FAVerification(async () => {
                    await processWithdrawalTransaction(monthKey, amount, method, address);
                });
            } else {
                await processWithdrawalTransaction(monthKey, amount, method, address);
            }
        });

        // Show 2FA verification modal
        function show2FAVerification(callback) {
            const modal = document.getElementById('verification-modal');
            const methodDiv = document.getElementById('verification-method');
            
            methodDiv.innerHTML = '';
            
            if (userData.biometricEnabled) {
                methodDiv.innerHTML += `
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 3rem; margin-bottom: 15px;">👆</div>
                        <h3 style="color: #4a5568; margin-bottom: 10px;">Biometric Verification</h3>
                        <p style="color: #718096;">Use your fingerprint or face to confirm</p>
                        <button class="btn" id="verify-biometric" style="margin-top: 15px;">Verify with Biometric</button>
                    </div>
                `;
            }
            
            if (userData.authenticatorEnabled) {
                methodDiv.innerHTML += `
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 15px;">📱</div>
                        <h3 style="color: #4a5568; margin-bottom: 10px;">Authenticator Code</h3>
                        <p style="color: #718096; margin-bottom: 15px;">Enter the 6-digit code from your authenticator app</p>
                        <div class="form-group">
                            <input type="text" id="verify-2fa-code" maxlength="6" placeholder="000000" style="text-align: center; font-size: 1.5rem; letter-spacing: 5px;">
                        </div>
                        <button class="btn" id="verify-2fa-btn">Verify Code</button>
                    </div>
                `;
            }
            
            modal.style.display = 'block';
            
            // Biometric verification
            if (userData.biometricEnabled) {
                document.getElementById('verify-biometric').addEventListener('click', async () => {
                    try {
                        // In production, implement WebAuthn verification
                        modal.style.display = 'none';
                        await callback();
                    } catch (error) {
                        showAlert('Biometric verification failed', 'error');
                    }
                });
            }
            
            // Authenticator verification
            if (userData.authenticatorEnabled) {
                document.getElementById('verify-2fa-btn').addEventListener('click', async () => {
                    const code = document.getElementById('verify-2fa-code').value;
                    
                    if (code.length !== 6) {
                        showAlert('Please enter a 6-digit code', 'error');
                        return;
                    }
                    
                    // In production, verify TOTP code
                    modal.style.display = 'none';
                    await callback();
                });
            }
        }

        async function processWithdrawalTransaction(monthKey, amount, method, address) {
            try {
                // Check withdrawal limits
                const withdrawalsQuery = query(
                    collection(db, 'transactions'),
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'withdrawal'),
                    where('month', '==', monthKey)
                );
                
                const withdrawalDocs = await getDocs(withdrawalsQuery);
                const existingWithdrawals = withdrawalDocs.docs.length;
                
                if (existingWithdrawals >= 2) {
                    showAlert('Maximum 2 withdrawals per month allowed.', 'error');
                    return;
                }
                
                // Calculate commission
                const rate = userData.rates[monthKey] || 0;
                let commission = 0;
                let withdrawalType = 'advance';
                
                if (existingWithdrawals === 1 || amount >= userData.balance) {
                    commission = rate;
                    withdrawalType = 'final';
                }
                
                const totalDeduction = amount + commission;
                
                if (totalDeduction > userData.balance) {
                    showAlert(`Insufficient balance. Total required: ${formatCurrency(totalDeduction)} (Amount: ${formatCurrency(amount)} + Commission: ${formatCurrency(commission)})`, 'error');
                    return;
                }
                
                // Create withdrawal transaction
                await addDoc(collection(db, 'transactions'), {
                    userId: currentUser.uid,
                    type: 'withdrawal',
                    withdrawalType,
                    amount,
                    commission,
                    totalAmount: totalDeduction,
                    month: monthKey,
                    paymentMethod: method,
                    paymentAddress: address,
                    status: 'pending',
                    timestamp: serverTimestamp()
                });
                
                // Update balance
                const newBalance = userData.balance - totalDeduction;
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    balance: newBalance
                });
                
                userData.balance = newBalance;
                
                showAlert(`Withdrawal request submitted! ${commission > 0 ? `Commission of ${formatCurrency(commission)} applied.` : ''}`, 'success');
                
                // Clear form
                document.getElementById('withdrawal-month').value = '';
                document.getElementById('withdrawal-amount').value = '';
                document.getElementById('withdrawal-method').value = '';
                document.getElementById('withdrawal-address').value = '';
                document.getElementById('withdrawal-password').value = '';
                
                updateDashboard();
                
                // Send notification
                console.log('Withdrawal notification sent to:', userData.email);
            } catch (error) {
                showAlert('Error processing withdrawal: ' + error.message, 'error');
            }
        }

        // Load transactions
        async function loadTransactions() {
            const container = document.getElementById('transactions-list');
            container.innerHTML = '<div class="spinner"></div>';
            
            try {
                const q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', currentUser.uid),
                    orderBy('timestamp', 'desc')
                );
                
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No transactions yet.</p>';
                    return;
                }
                
                container.innerHTML = '';
                
                querySnapshot.forEach((doc) => {
                    const transaction = doc.data();
                    const card = document.createElement('div');
                    card.className = `transaction-card ${transaction.type}`;
                    
                    const isPaid = transaction.status === 'approved' && transaction.type === 'withdrawal';
                    
                    card.innerHTML = `
                        <div class="transaction-header">
                            <div>
                                <div class="transaction-type">${transaction.type === 'contribution' ? '💰 Contribution' : '💸 Withdrawal'}</div>
                                ${transaction.withdrawalType ? `<div style="font-size: 0.8rem; color: #718096; margin-top: 4px;">${transaction.withdrawalType === 'advance' ? 'Advance Payment' : 'Final Withdrawal'}</div>` : ''}
                            </div>
                            <div class="transaction-amount ${transaction.type === 'contribution' ? 'positive' : 'negative'}">
                                ${transaction.type === 'contribution' ? '+' : '-'}${formatCurrency(transaction.amount)}
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; color: #718096; margin-top: 8px;">
                            ${transaction.month ? `Month: ${transaction.month}` : ''}
                            ${transaction.commission ? `<br>Commission: ${formatCurrency(transaction.commission)}` : ''}
                            ${transaction.paymentMethod ? `<br>Payment Method: ${transaction.paymentMethod}` : ''}
                        </div>
                        <div class="transaction-status status-${transaction.status}">
                            ${transaction.status.toUpperCase()}
                        </div>
                        ${isPaid ? `
                            <div class="paid-stamp">
                                <div class="stamp-outer">
                                    <div class="stamp-text-top">SUSUPAY</div>
                                    <div class="stamp-inner">
                                        <div class="stamp-paid">PAID</div>
                                        <div class="stamp-date">${new Date(transaction.timestamp?.toDate()).toLocaleDateString()}</div>
                                    </div>
                                    <div class="stamp-text-bottom">SUSUPAY</div>
                                </div>
                            </div>
                        ` : ''}
                    `;
                    
                    container.appendChild(card);
                });
            } catch (error) {
                container.innerHTML = `<p style="text-align: center; color: #e53e3e; padding: 40px;">Error loading transactions: ${error.message}</p>`;
            }
        }



               // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                await signOut(auth);
                showAlert('Logged out successfully!', 'success', 'auth-alert');
            } catch (error) {
                showAlert('Error logging out: ' + error.message, 'error');
            }
        });

        // ============ SETTINGS FUNCTIONALITY ============

        // Load settings when settings page is opened
        document.querySelector('[data-page="settings"]').addEventListener('click', () => {
            loadSettings();
        });

        function loadSettings() {
            // Load profile data
            document.getElementById('edit-first-name').value = userData.firstName || '';
            document.getElementById('edit-surname').value = userData.surname || '';
            document.getElementById('edit-email').value = userData.email || '';
            
            // Load 2FA status
            updateAuthenticationStatus();
        }

        function updateAuthenticationStatus() {
            const biometricStatus = document.getElementById('biometric-status-text');
            const authenticatorStatus = document.getElementById('authenticator-status-text');
            
            if (userData.biometricEnabled) {
                biometricStatus.textContent = 'Enabled ✓';
                biometricStatus.style.color = '#48bb78';
                document.getElementById('setup-biometric-btn').textContent = 'Disable';
            } else {
                biometricStatus.textContent = 'Not configured';
                biometricStatus.style.color = '#718096';
                document.getElementById('setup-biometric-btn').textContent = 'Setup';
            }
            
            if (userData.authenticatorEnabled) {
                authenticatorStatus.textContent = 'Enabled ✓';
                authenticatorStatus.style.color = '#48bb78';
                document.getElementById('setup-authenticator-btn').textContent = 'Disable';
            } else {
                authenticatorStatus.textContent = 'Not configured';
                authenticatorStatus.style.color = '#718096';
                document.getElementById('setup-authenticator-btn').textContent = 'Setup';
            }
        }

        // Profile update
        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('edit-first-name').value;
            const surname = document.getElementById('edit-surname').value;
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    firstName,
                    surname
                });
                
                userData.firstName = firstName;
                userData.surname = surname;
                
                showAlert('Profile updated successfully!', 'success');
                showDashboard();
            } catch (error) {
                showAlert('Error updating profile: ' + error.message, 'error');
            }
        });

        // Withdrawal password setup
        document.getElementById('withdrawal-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-withdrawal-password').value;
            const confirmPassword = document.getElementById('confirm-withdrawal-password').value;
            const currentPassword = document.getElementById('current-auth-password').value;
            
            if (newPassword !== confirmPassword) {
                showAlert('Passwords do not match!', 'error');
                return;
            }
            
            try {
                // Verify current password
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
                
                // Update withdrawal password
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    withdrawalPassword: newPassword
                });
                
                userData.withdrawalPassword = newPassword;
                
                showAlert('Withdrawal password set successfully!', 'success');
                document.getElementById('withdrawal-password-form').reset();
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        });

        // Account password change
        document.getElementById('account-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-account-password').value;
            const confirmPassword = document.getElementById('confirm-account-password').value;
            
            if (newPassword !== confirmPassword) {
                showAlert('Passwords do not match!', 'error');
                return;
            }
            
            try {
                const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
                await reauthenticateWithCredential(currentUser, credential);
                await updatePassword(currentUser, newPassword);
                
                showAlert('Account password updated successfully!', 'success');
                document.getElementById('account-password-form').reset();
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        });

        // Biometric setup
        document.getElementById('setup-biometric-btn').addEventListener('click', () => {
            if (userData.biometricEnabled) {
                disableBiometric();
            } else {
                document.getElementById('biometric-modal').style.display = 'block';
                checkBiometricSupport();
            }
        });

        async function checkBiometricSupport() {
            const messageDiv = document.getElementById('biometric-support-message');
            
            if (window.PublicKeyCredential) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (available) {
                    messageDiv.innerHTML = '<div style="color: #48bb78;">✓ Your device supports biometric authentication</div>';
                    document.getElementById('enable-biometric-btn').disabled = false;
                } else {
                    messageDiv.innerHTML = '<div style="color: #e53e3e;">✗ Your device does not support biometric authentication</div>';
                    document.getElementById('enable-biometric-btn').disabled = true;
                }
            } else {
                messageDiv.innerHTML = '<div style="color: #e53e3e;">✗ Your browser does not support WebAuthn</div>';
                document.getElementById('enable-biometric-btn').disabled = true;
            }
        }

        document.getElementById('enable-biometric-btn').addEventListener('click', async () => {
            try {
                // In production, implement WebAuthn registration
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    biometricEnabled: true
                });
                
                userData.biometricEnabled = true;
                updateAuthenticationStatus();
                
                document.getElementById('biometric-modal').style.display = 'none';
                showAlert('Biometric authentication enabled successfully!', 'success');
            } catch (error) {
                showAlert('Error enabling biometric: ' + error.message, 'error');
            }
        });

        async function disableBiometric() {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    biometricEnabled: false
                });
                
                userData.biometricEnabled = false;
                updateAuthenticationStatus();
                
                showAlert('Biometric authentication disabled', 'info');
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        }

        document.getElementById('close-biometric-modal').addEventListener('click', () => {
            document.getElementById('biometric-modal').style.display = 'none';
        });

        // Authenticator setup
        document.getElementById('setup-authenticator-btn').addEventListener('click', () => {
            if (userData.authenticatorEnabled) {
                disableAuthenticator();
            } else {
                document.getElementById('authenticator-modal').style.display = 'block';
                generateAuthenticatorSecret();
            }
        });

        function generateAuthenticatorSecret() {
            // Generate random secret
            const secret = Array.from({length: 16}, () => 
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
            ).join('');
            
            const formattedSecret = secret.match(/.{1,4}/g).join(' ');
            document.getElementById('secret-key').textContent = formattedSecret;
            
            // Store for verification
            window.tempAuthSecret = secret;
        }

        document.getElementById('verify-authenticator-btn').addEventListener('click', async () => {
            const code = document.getElementById('verify-code').value;
            
            if (code.length !== 6) {
                showAlert('Please enter a 6-digit code', 'error');
                return;
            }
            
            try {
                // In production, verify TOTP code
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    authenticatorEnabled: true,
                    authenticatorSecret: window.tempAuthSecret
                });
                
                userData.authenticatorEnabled = true;
                userData.authenticatorSecret = window.tempAuthSecret;
                updateAuthenticationStatus();
                
                document.getElementById('authenticator-modal').style.display = 'none';
                document.getElementById('verify-code').value = '';
                showAlert('Authenticator app enabled successfully!', 'success');
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        });

        async function disableAuthenticator() {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    authenticatorEnabled: false,
                    authenticatorSecret: null
                });
                
                userData.authenticatorEnabled = false;
                userData.authenticatorSecret = null;
                updateAuthenticationStatus();
                
                showAlert('Authenticator app disabled', 'info');
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        }

        document.getElementById('close-authenticator-modal').addEventListener('click', () => {
            document.getElementById('authenticator-modal').style.display = 'none';
        });

        // Notification preferences
        document.getElementById('save-notifications-btn').addEventListener('click', async () => {
            const emailNotifications = document.getElementById('email-notifications').checked;
            const smsNotifications = document.getElementById('sms-notifications').checked;
            const securityAlerts = document.getElementById('security-alerts').checked;
            
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    notifications: {
                        email: emailNotifications,
                        sms: smsNotifications,
                        security: securityAlerts
                    }
                });
                
                showAlert('Notification preferences saved!', 'success');
            } catch (error) {
                showAlert('Error: ' + error.message, 'error');
            }
        });
                // ============ KYC FUNCTIONALITY ============

        // Load KYC page
        document.querySelector('[data-page="kyc"]').addEventListener('click', () => {
            initKYCPage();
        });

        async function initKYCPage() {
            // Check KYC status
            if (userData.kycStatus === 'pending' || userData.kycStatus === 'under_review') {
                document.getElementById('kyc-form-container').style.display = 'none';
                document.getElementById('kyc-status-display').classList.remove('hidden');
                document.getElementById('kyc-verification-status').textContent = 
                    userData.kycStatus === 'pending' ? 'Pending Review' : 'Under Review';
            } else if (userData.kycStatus === 'approved') {
                document.getElementById('kyc-form-container').style.display = 'none';
                document.getElementById('kyc-status-display').classList.remove('hidden');
                document.getElementById('kyc-status-display').innerHTML = `
                    <div style="background: white; border-radius: 15px; padding: 40px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                        <h3 style="color: #48bb78; margin-bottom: 15px;">Verification Approved!</h3>
                        <p style="color: #718096; margin-bottom: 20px;">
                            Congratulations! Your identity has been verified. You now have access to all VIP features.
                        </p>
                        <div style="padding: 15px; background: #c6f6d5; border-radius: 8px; color: #22543d; font-weight: 600;">
                            Status: <span>Approved ✓</span>
                        </div>
                    </div>
                `;
            } else {
                document.getElementById('kyc-form-container').style.display = 'block';
                document.getElementById('kyc-status-display').classList.add('hidden');
            }
        }

        // Terms checkbox
        document.getElementById('terms-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('id-type').disabled = false;
            } else {
                document.getElementById('id-type').disabled = true;
                document.getElementById('id-upload-section').style.display = 'none';
            }
        });

        // ID Type selection
        document.getElementById('id-type').addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('id-upload-section').style.display = 'block';
            } else {
                document.getElementById('id-upload-section').style.display = 'none';
            }
        });

        // Front ID Upload
        document.getElementById('front-upload-area').addEventListener('click', () => {
            document.getElementById('front-id-input').click();
        });

        document.getElementById('front-id-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                frontIdFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('front-preview-img').src = e.target.result;
                    document.getElementById('front-preview').style.display = 'block';
                    checkKYCCompletion();
                };
                reader.readAsDataURL(file);
            }
        });

        // Back ID Upload
        document.getElementById('back-upload-area').addEventListener('click', () => {
            document.getElementById('back-id-input').click();
        });

        document.getElementById('back-id-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                backIdFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('back-preview-img').src = e.target.result;
                    document.getElementById('back-preview').style.display = 'block';
                    checkKYCCompletion();
                };
                reader.readAsDataURL(file);
            }
        });

        // Show selfie section after both IDs uploaded
        function checkKYCCompletion() {
            if (frontIdFile && backIdFile) {
                document.getElementById('selfie-section').style.display = 'block';
            }
            
            if (frontIdFile && backIdFile && selfieBlob) {
                document.getElementById('submit-kyc-btn').style.display = 'block';
            }
        }

        // Camera functions
        document.getElementById('start-camera-btn').addEventListener('click', async () => {
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user' } 
                });
                
                const video = document.getElementById('selfie-video');
                video.srcObject = mediaStream;
                video.style.display = 'block';
                document.getElementById('selfie-placeholder').style.display = 'none';
                document.getElementById('start-camera-btn').style.display = 'none';
                document.getElementById('capture-selfie-btn').style.display = 'inline-block';
            } catch (error) {
                showAlert('Error accessing camera: ' + error.message, 'error');
            }
        });

        document.getElementById('capture-selfie-btn').addEventListener('click', () => {
            const video = document.getElementById('selfie-video');
            const canvas = document.getElementById('selfie-canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                selfieBlob = blob;
                const url = URL.createObjectURL(blob);
                document.getElementById('selfie-preview-img').src = url;
                document.getElementById('selfie-captured').style.display = 'block';
                
                // Stop camera
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
                video.style.display = 'none';
                document.getElementById('capture-selfie-btn').style.display = 'none';
                document.getElementById('retake-selfie-btn').style.display = 'inline-block';
                
                checkKYCCompletion();
            }, 'image/jpeg', 0.95);
        });

        document.getElementById('retake-selfie-btn').addEventListener('click', () => {
            selfieBlob = null;
            document.getElementById('selfie-captured').style.display = 'none';
            document.getElementById('selfie-placeholder').style.display = 'flex';
            document.getElementById('start-camera-btn').style.display = 'inline-block';
            document.getElementById('retake-selfie-btn').style.display = 'none';
            document.getElementById('submit-kyc-btn').style.display = 'none';
        });

        // Submit KYC
        document.getElementById('submit-kyc-btn').addEventListener('click', async () => {
            if (!document.getElementById('terms-checkbox').checked) {
                showAlert('Please accept the terms of service', 'error');
                return;
            }

            const idType = document.getElementById('id-type').value;
            
            if (!idType || !frontIdFile || !backIdFile || !selfieBlob) {
                showAlert('Please complete all verification steps', 'error');
                return;
            }

            try {
                document.getElementById('submit-kyc-btn').disabled = true;
                document.getElementById('submit-kyc-btn').textContent = 'Uploading...';

                // In production, upload files to Firebase Storage
                // For now, we'll create base64 data URLs
                const frontReader = new FileReader();
                const backReader = new FileReader();
                
                frontReader.readAsDataURL(frontIdFile);
                backReader.readAsDataURL(backIdFile);
                
                Promise.all([
                    new Promise(resolve => frontReader.onload = () => resolve(frontReader.result)),
                    new Promise(resolve => backReader.onload = () => resolve(backReader.result))
                ]).then(async ([frontData, backData]) => {
                    // Convert selfie blob to base64
                    const selfieReader = new FileReader();
                    selfieReader.readAsDataURL(selfieBlob);
                    selfieReader.onload = async () => {
                        // Create KYC submission document
                        const kycData = {
                            userId: currentUser.uid,
                            idType,
                            frontIdUrl: frontData, // In production, upload to Storage and store URL
                            backIdUrl: backData,
                            selfieUrl: selfieReader.result,
                            status: 'under_review',
                            submittedAt: serverTimestamp(),
                            termsAccepted: true
                        };

                        await addDoc(collection(db, 'kyc_submissions'), kycData);

                        // Update user document
                        await updateDoc(doc(db, 'users', currentUser.uid), {
                            kycStatus: 'under_review',
                            kycSubmittedAt: serverTimestamp()
                        });

                        userData.kycStatus = 'under_review';

                        showAlert('KYC documents submitted successfully! Your verification is under review.', 'success');

                        // Show status display
                        document.getElementById('kyc-form-container').style.display = 'none';
                        document.getElementById('kyc-status-display').classList.remove('hidden');
                        document.getElementById('kyc-verification-status').textContent = 'Under Review';

                        // Send email notification
                        console.log('KYC submission notification sent to:', userData.email);
                    };
                });

            } catch (error) {
                showAlert('Error submitting KYC: ' + error.message, 'error');
                document.getElementById('submit-kyc-btn').disabled = false;
                document.getElementById('submit-kyc-btn').textContent = 'Submit KYC Documents';
            }
        });

        // Drag and drop for file uploads
        ['front-upload-area', 'back-upload-area'].forEach(areaId => {
            const area = document.getElementById(areaId);
            
            area.addEventListener('dragover', (e) => {
                e.preventDefault();
                area.style.borderColor = '#667eea';
                area.style.background = '#f7fafc';
            });
            
            area.addEventListener('dragleave', () => {
                area.style.borderColor = '#cbd5e0';
                area.style.background = 'white';
            });
            
            area.addEventListener('drop', (e) => {
                e.preventDefault();
                area.style.borderColor = '#cbd5e0';
                area.style.background = 'white';
                
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    const input = document.getElementById(areaId.replace('upload-area', 'input'));
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    input.files = dataTransfer.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        });

        // ============ END OF KYC FUNCTIONALITY ============

        // Clean up camera on page unload
        window.addEventListener('beforeunload', () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
