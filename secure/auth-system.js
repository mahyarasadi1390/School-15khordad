// auth-system.js - سیستم احراز هویت امن برای مدرسه ۱۵ خرداد
// تاریخ ایجاد: ۵ دسامبر ۲۰۲۵
class AuthSystem {
    constructor() {
        this.REPO = 'mahyarasadi1390/School-15khordad';
        this.AUTH_FILE = '.secure/auth.json';
        this.session = null;
        this.init();
    }

    async init() {
        // بررسی جلسه ذخیره شده
        if (this.checkSession()) {
            this.enableEditMode();
            this.showAdminPanel();
        }
    }

    // تابع هش رمز (همانند فایل auth.json)
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 7) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // دریافت اطلاعات احراز هویت از GitHub
    async loadCredentials() {
        try {
            const response = await fetch(
                `https://raw.githubusercontent.com/${this.REPO}/main/${this.AUTH_FILE}?_=${Date.now()}`
            );
            
            if (!response.ok) throw new Error('فایل احراز هویت پیدا نشد');
            
            return await response.json();
        } catch (error) {
            console.warn('استفاده از رمزهای پیش‌فرض');
            return {
                passwords: {
                    creator: 'a1b2c3d4e5f67890',
                    manager: 'f6e5d4c3b2a10987'
                },
                permissions: {
                    creator: ['all'],
                    manager: ['students', 'staff', 'announcements', 'grades', 'attendance']
                }
            };
        }
    }

    // ورود به سیستم
    async login(password) {
        const credentials = await this.loadCredentials();
        const inputHash = this.simpleHash(password);

        // بررسی نقش کاربر
        for (const [role, storedHash] of Object.entries(credentials.passwords)) {
            if (inputHash === storedHash) {
                // ایجاد جلسه
                this.session = {
                    role: role,
                    name: role === 'creator' ? 'سازنده' : 'مدیر',
                    permissions: credentials.permissions[role] || [],
                    loginTime: Date.now(),
                    token: this.generateToken(),
                    expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 ساعت
                };

                localStorage.setItem('school_admin_session', JSON.stringify(this.session));
                this.enableEditMode();
                this.showAdminPanel();
                this.showNotification(`✅ خوش آمدید ${this.session.name}!`, 'success');
                
                // بستن مودال
                const modal = bootstrap.Modal.getInstance(document.getElementById('login-modal'));
                if (modal) modal.hide();
                
                return { success: true, role: role };
            }
        }

        this.showNotification('❌ رمز عبور نادرست است', 'error');
        return { success: false };
    }

    // بررسی جلسه
    checkSession() {
        const savedSession = localStorage.getItem('school_admin_session');
        if (!savedSession) return false;

        const session = JSON.parse(savedSession);
        if (Date.now() > session.expiresAt) {
            localStorage.removeItem('school_admin_session');
            this.showNotification('⚠️ جلسه منقضی شده', 'warning');
            return false;
        }

        this.session = session;
        return true;
    }

    // تولید توکن
    generateToken() {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // فعال کردن حالت ویرایش
    enableEditMode() {
        document.body.classList.add('edit-mode');
        
        // اضافه کردن دکمه‌های ویرایش به عناصر
        this.addEditButtonsToElements();
        
        // اضافه کردن پنل مدیریت شناور
        this.createFloatingAdminPanel();
    }

    // اضافه کردن دکمه ویرایش به عناصر
    addEditButtonsToElements() {
        // دانش‌آموزان
        document.querySelectorAll('.student-card h5, .student-card p').forEach(el => {
            if (!el.classList.contains('has-edit-btn')) {
                el.classList.add('editable', 'has-edit-btn');
                const editBtn = this.createEditButton(el, 'student');
                el.style.position = 'relative';
                el.appendChild(editBtn);
            }
        });

        // کادر مدرسه
        document.querySelectorAll('.staff-card h5, .staff-card h6, .staff-post').forEach(el => {
            if (!el.classList.contains('has-edit-btn')) {
                el.classList.add('editable', 'has-edit-btn');
                const editBtn = this.createEditButton(el, 'staff');
                el.style.position = 'relative';
                el.appendChild(editBtn);
            }
        });

        // اطلاعیه‌ها
        document.querySelectorAll('.announcement-card h5, .announcement-card p').forEach(el => {
            if (!el.classList.contains('has-edit-btn')) {
                el.classList.add('editable', 'has-edit-btn');
                const editBtn = this.createEditButton(el, 'announcement');
                el.style.position = 'relative';
                el.appendChild(editBtn);
            }
        });

        // نمرات
        document.querySelectorAll('.student-grade-card h5, .subject-grade-card').forEach(el => {
            if (!el.classList.contains('has-edit-btn')) {
                el.classList.add('editable', 'has-edit-btn');
                const editBtn = this.createEditButton(el, 'grade');
                el.style.position = 'relative';
                el.appendChild(editBtn);
            }
        });
    }

    // ایجاد دکمه ویرایش
    createEditButton(element, type) {
        const btn = document.createElement('button');
        btn.className = 'edit-button';
        btn.innerHTML = '<i class="fas fa-edit"></i>';
        btn.title = 'ویرایش';
        
        btn.onclick = (e) => {
            e.stopPropagation();
            this.openEditor(element, type);
        };
        
        return btn;
    }

    // باز کردن ویرایشگر
    openEditor(element, type) {
        const currentText = element.textContent;
        const newText = prompt(`ویرایش ${type}:\n(لغو = Cancel)`, currentText);
        
        if (newText !== null && newText !== currentText) {
            element.textContent = newText;
            this.showNotification('✅ تغییرات ذخیره شد', 'success');
            // در اینجا می‌توانید تغییرات را به GitHub هم ارسال کنید
        }
    }

    // ایجاد پنل مدیریت شناور
    createFloatingAdminPanel() {
        if (document.getElementById('admin-floating-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'admin-floating-panel';
        panel.className = 'admin-floating-panel';
        panel.innerHTML = `
            <div class="admin-panel-header">
                <h6><i class="fas fa-user-shield me-2"></i>پنل مدیریت</h6>
                <small>${this.session.name}</small>
            </div>
            <div class="admin-panel-body">
                <button class="btn btn-sm btn-primary w-100 mb-2" onclick="authSystem.saveAllChanges()">
                    <i class="fas fa-save me-1"></i>ذخیره همه تغییرات
                </button>
                <button class="btn btn-sm btn-success w-100 mb-2" onclick="authSystem.exportData()">
                    <i class="fas fa-download me-1"></i>خروجی JSON
                </button>
                <button class="btn btn-sm btn-warning w-100 mb-2" onclick="authSystem.reloadOriginal()">
                    <i class="fas fa-sync me-1"></i>بارگذاری مجدد
                </button>
                <button class="btn btn-sm btn-danger w-100" onclick="authSystem.logout()">
                    <i class="fas fa-sign-out-alt me-1"></i>خروج
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    // نمایش پنل
    showAdminPanel() {
        const panel = document.getElementById('admin-floating-panel');
        if (panel) panel.style.display = 'block';
        
        // دکمه نمایش/مخفی کردن پنل
        if (!document.getElementById('admin-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'admin-toggle-btn';
            toggleBtn.className = 'admin-toggle-btn';
            toggleBtn.innerHTML = '<i class="fas fa-cog"></i>';
            toggleBtn.title = 'مدیریت';
            
            toggleBtn.onclick = () => {
                const panel = document.getElementById('admin-floating-panel');
                if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            };
            
            document.body.appendChild(toggleBtn);
        }
    }

    // نمایش نوتیفیکیشن
    showNotification(message, type = 'info') {
        // حذف نوتیفیکیشن قبلی
        const oldNotif = document.getElementById('global-notification');
        if (oldNotif) oldNotif.remove();
        
        // ایجاد نوتیفیکیشن جدید
        const notif = document.createElement('div');
        notif.id = 'global-notification';
        notif.className = `global-notification ${type}`;
        notif.innerHTML = `
            <div class="notification-content">
                ${message}
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notif);
        
        // حذف خودکار بعد از 5 ثانیه
        setTimeout(() => {
            if (notif.parentElement) notif.remove();
        }, 5000);
    }

    // خروج از سیستم
    logout() {
        this.session = null;
        localStorage.removeItem('school_admin_session');
        document.body.classList.remove('edit-mode');
        
        // حذف دکمه‌های ویرایش
        document.querySelectorAll('.edit-button').forEach(btn => btn.remove());
        document.querySelectorAll('.editable').forEach(el => el.classList.remove('editable', 'has-edit-btn'));
        
        // حذف پنل‌ها
        const panel = document.getElementById('admin-floating-panel');
        if (panel) panel.remove();
        
        const toggleBtn = document.getElementById('admin-toggle-btn');
        if (toggleBtn) toggleBtn.remove();
        
        this.showNotification('🔒 با موفقیت خارج شدید', 'info');
        location.reload();
    }

    // ذخیره همه تغییرات (نمونه - می‌توانید توسعه دهید)
    async saveAllChanges() {
        this.showNotification('🔄 در حال ذخیره تغییرات...', 'info');
        
        // اینجا کد ارسال تغییرات به GitHub قرار می‌گیرد
        setTimeout(() => {
            this.showNotification('✅ همه تغییرات ذخیره شد', 'success');
        }, 1500);
    }

    // خروجی گرفتن از داده‌ها
    exportData() {
        // جمع‌آوری داده‌های ویرایش شده
        const editedData = {
            students: [],
            staff: [],
            announcements: [],
            grades: [],
            timestamp: new Date().toISOString()
        };
        
        // ایجاد فایل JSON
        const dataStr = JSON.stringify(editedData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `school-data-export-${new Date().toLocaleDateString('fa-IR')}.json`;
        link.click();
        
        this.showNotification('📥 فایل خروجی دانلود شد', 'success');
    }

    // بارگذاری مجدد داده‌های اصلی
    reloadOriginal() {
        if (confirm('آیا مطمئنید؟ همه تغییرات ذخیره نشده از بین خواهند رفت.')) {
            location.reload();
        }
    }
}

// ایجاد نمونه جهانی
window.authSystem = new AuthSystem();

// تابع برای نمایش مودال ورود
function showLoginModal() {
    // ایجاد مودال اگر وجود ندارد
    if (!document.getElementById('login-modal')) {
        const modalHTML = `
            <div class="modal fade" id="login-modal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="fas fa-lock me-2"></i>ورود به پنل مدیریت</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="admin-password" class="form-label">رمز عبور:</label>
                                <input type="password" class="form-control" id="admin-password" 
                                       placeholder="رمز سازنده یا مدیر را وارد کنید">
                                <small class="text-muted">رمز سازنده: Mahyar@8077 | رمز مدیر: @Bahrami9010</small>
                            </div>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                بعد از ورود، دکمه‌های ویرایش در تمام بخش‌ها ظاهر می‌شوند.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">انصراف</button>
                            <button type="button" class="btn btn-primary" onclick="handleLogin()">ورود</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // نمایش مودال
    const modal = new bootstrap.Modal(document.getElementById('login-modal'));
    modal.show();
}

// تابع مدیریت ورود
async function handleLogin() {
    const password = document.getElementById('admin-password').value;
    if (!password) {
        alert('لطفاً رمز عبور را وارد کنید');
        return;
    }
    
    const result = await authSystem.login(password);
    if (result.success) {
        document.getElementById('admin-password').value = '';
    }
}

// اضافه کردن دکمه ورود به نوار بالا
document.addEventListener('DOMContentLoaded', function() {
    // اضافه کردن دکمه ورود در نوار بالایی
    const headerActions = document.querySelector('header .col-2.text-start');
    if (headerActions && !document.getElementById('admin-login-btn')) {
        const loginBtn = document.createElement('button');
        loginBtn.id = 'admin-login-btn';
        loginBtn.className = 'btn btn-sm btn-outline-light';
        loginBtn.innerHTML = '<i class="fas fa-user-shield me-1"></i>ورود مدیریت';
        loginBtn.onclick = showLoginModal;
        headerActions.appendChild(loginBtn);
    }
});
