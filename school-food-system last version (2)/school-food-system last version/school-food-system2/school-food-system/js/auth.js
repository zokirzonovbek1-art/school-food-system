// Модуль авторизации и регистрации
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация базы данных
    if (typeof Database !== 'undefined') {
        Database.init();
    }
    
    // Переключение между вкладками
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            
            // Обновляем активные кнопки
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Показываем нужную форму
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tab}-form`) {
                    form.classList.add('active');
                }
            });
        });
    });
    
    // Переключение видимости пароля
    document.querySelectorAll('.toggle-password').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (!input || !icon) return;
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Демо-авторизация
    document.querySelectorAll('.demo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            const login = this.getAttribute('data-login');
            const pass = this.getAttribute('data-pass');
            
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const roleSelect = document.getElementById('login-role');
            
            if (emailInput) emailInput.value = login || '';
            if (passwordInput) passwordInput.value = pass || '';
            if (roleSelect) roleSelect.value = role || 'student';
            
            // Переключаемся на вкладку входа
            const loginTab = document.querySelector('[data-tab="login"]');
            if (loginTab) loginTab.click();
        });
    });
    
    // Обработка входа
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    // Обработка регистрации
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
    
    // Ввод по нажатию Enter
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const activeForm = document.querySelector('.auth-form.active');
            if (!activeForm) return;
            
            if (activeForm.id === 'login-form') {
                handleLogin();
            } else if (activeForm.id === 'register-form') {
                handleRegister();
            }
        }
    });
});

// Обработчик входа
function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const roleSelect = document.getElementById('login-role');
    
    if (!emailInput || !passwordInput || !roleSelect) {
        console.error('Не найдены необходимые элементы формы входа');
        return;
    }
    
    const login = emailInput.value.trim();
    const password = passwordInput.value;
    const role = roleSelect.value;
    
    if (!login || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    // Проверяем, существует ли Database
    if (typeof Database === 'undefined') {
        showNotification('Ошибка системы. Пожалуйста, обновите страницу.', 'error');
        console.error('Database не определена');
        return;
    }
    
    // Поиск пользователя
    // Передаём роль на backend, чтобы сразу проверить корректность входа
    const user = Database.findUser(login, password, role);
    
    if (!user) {
        showNotification('Неверный логин или пароль', 'error');
        return;
    }
    
    if (user.role !== role) {
        showNotification(`Вы пытаетесь войти как ${getRoleName(role)}, но ваш аккаунт имеет роль "${getRoleName(user.role)}"`, 'error');
        return;
    }
    
    // Сохраняем данные пользователя в сессии
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    
    // Перенаправляем на соответствующую страницу
    switch(role) {
        case 'student':
            window.location.href = 'student.html';
            break;
        case 'cook':
            window.location.href = 'cook.html';
            break;
        case 'admin':
            window.location.href = 'admin.html';
            break;
        default:
            showNotification('Неизвестная роль пользователя', 'error');
    }
}

// Обработчик регистрации
function handleRegister() {
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const loginInput = document.getElementById('reg-login');
    const passwordInput = document.getElementById('reg-password');
    const classInput = document.getElementById('reg-class');
    const roleSelect = document.getElementById('reg-role');
    const termsCheckbox = document.getElementById('reg-terms');
    
    if (!nameInput || !emailInput || !loginInput || !passwordInput || !classInput || !roleSelect || !termsCheckbox) {
        console.error('Не найдены необходимые элементы формы регистрации');
        return;
    }
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const login = loginInput.value.trim();
    const password = passwordInput.value;
    const className = classInput.value.trim();
    const role = roleSelect.value;
    const termsAccepted = termsCheckbox.checked;
    
    // Валидация
    if (!name || !email || !login || !password || !className) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен содержать не менее 6 символов', 'error');
        return;
    }
    
    if (!termsAccepted) {
        showNotification('Необходимо согласиться с правилами', 'error');
        return;
    }
    
    // Проверяем, существует ли Database
    if (typeof Database === 'undefined') {
        showNotification('Ошибка системы. Пожалуйста, обновите страницу.', 'error');
        console.error('Database не определена');
        return;
    }
    
    // Проверка на существующий email или логин
    const users = Database.getUsers();
    if (users.some(user => user.email === email)) {
        showNotification('Пользователь с таким email уже существует', 'error');
        return;
    }
    
    if (users.some(user => user.login === login)) {
        showNotification('Пользователь с таким логином уже существует', 'error');
        return;
    }
    
    // Создание нового пользователя
    const newUser = Database.addUser({
        name: name,
        email: email,
        login: login,
        password: password,
        role: role,
        class: className
    });
    
    // Очистка формы и переключение на вкладку входа
    nameInput.value = '';
    emailInput.value = '';
    loginInput.value = '';
    passwordInput.value = '';
    classInput.value = '';
    termsCheckbox.checked = false;
    
    // Автоматически заполняем форму входа данными из регистрации
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginRoleSelect = document.getElementById('login-role');
    
    if (loginEmailInput) loginEmailInput.value = login;
    if (loginPasswordInput) loginPasswordInput.value = password;
    if (loginRoleSelect) loginRoleSelect.value = role;
    
    const loginTab = document.querySelector('[data-tab="login"]');
    if (loginTab) loginTab.click();
}

// Функция показа уведомления (ТОЛЬКО ДЛЯ ОШИБОК)
function showNotification(message, type = 'error') {
    // Удаляем предыдущие уведомления
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(notif => {
        notif.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notif.remove(), 300);
    });
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Добавляем возможность закрыть уведомление кликом
    notification.addEventListener('click', function() {
        this.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => this.remove(), 300);
    });
}

// Получение названия роли
function getRoleName(role) {
    const roles = {
        'student': 'Ученик',
        'cook': 'Повар',
        'admin': 'Администратор'
    };
    return roles[role] || role;
}