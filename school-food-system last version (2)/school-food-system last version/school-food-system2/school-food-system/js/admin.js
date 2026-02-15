// admin.js
// Все данные подтягиваются только из БД через Database (см. js/database.js).
// Никаких заготовленных данных в коде, кроме готовых аккаунтов в DB seed.

// Алиас для совместимости: saveSettings -> updateSettings
if (typeof Database !== 'undefined') {
    if (typeof Database.saveSettings !== 'function' && typeof Database.updateSettings === 'function') {
        Database.saveSettings = function (settings) {
            return Database.updateSettings(settings);
        };
    }
}

function saveSettings() {
    try {
        const schoolName = document.getElementById('school-name')?.value || '';
        const workStart = document.getElementById('work-start')?.value || '';
        const workEnd = document.getElementById('work-end')?.value || '';
        const minBalanceRaw = document.getElementById('min-balance')?.value;

        const settings = {
            schoolName: schoolName,
            workStart: workStart,
            workEnd: workEnd,
            minBalance: (minBalanceRaw === '' || minBalanceRaw === null || minBalanceRaw === undefined)
                ? null
                : parseInt(minBalanceRaw, 10),
            emailNotifications: !!document.getElementById('email-notifications')?.checked,
            orderNotifications: !!document.getElementById('order-notifications')?.checked,
            lowStockNotifications: !!document.getElementById('low-stock-notifications')?.checked,
            updatedAt: new Date().toISOString()
        };

        Database.updateSettings(settings);
        showNotification('Настройки сохранены', 'success');

    } catch (error) {
        console.error('Ошибка при сохранении настроек:', error);
        showNotification('Ошибка сохранения настроек: ' + (error.message || error), 'error');
    }
}

// Загрузка настроек только из БД
function loadSettings() {
    try {
        const settings = Database.getSettings() || {};

        const schoolNameEl = document.getElementById('school-name');
        const workStartEl = document.getElementById('work-start');
        const workEndEl = document.getElementById('work-end');
        const minBalanceEl = document.getElementById('min-balance');

        if (schoolNameEl) schoolNameEl.value = settings.schoolName || '';
        if (workStartEl) workStartEl.value = settings.workStart || '';
        if (workEndEl) workEndEl.value = settings.workEnd || '';
        if (minBalanceEl) minBalanceEl.value = (settings.minBalance !== undefined && settings.minBalance !== null)
            ? settings.minBalance
            : '';

        const emailCb = document.getElementById('email-notifications');
        const orderCb = document.getElementById('order-notifications');
        const lowStockCb = document.getElementById('low-stock-notifications');

        if (emailCb) emailCb.checked = settings.emailNotifications === true;
        if (orderCb) orderCb.checked = settings.orderNotifications === true;
        if (lowStockCb) lowStockCb.checked = settings.lowStockNotifications === true;

    } catch (error) {
        console.error('Ошибка при загрузке настроек:', error);
    }
}

// Обновленная функция saveNewUser для использования Database.addUser
function saveNewUser() {
    try {
        const role = document.getElementById('new-user-role').value;
        const name = document.getElementById('new-user-name').value;
        const email = document.getElementById('new-user-email').value;
        const login = document.getElementById('new-user-login').value;
        const password = document.getElementById('new-user-password').value;
        
        if (!role || !name || !email || !login || !password) {
            showNotification('Заполните все обязательные поля', 'warning');
            return;
        }
        
        const userData = {
            name,
            email,
            login,
            password,
            role,
            isActive: true
        };
        
        if (role === 'student') {
            userData.class = document.getElementById('new-user-class').value || 'Не указан';
            userData.balance = parseInt(document.getElementById('new-user-balance').value) || 0;
        } else if (role === 'cook') {
            userData.specialization = document.getElementById('new-user-specialization').value || 'Повар';
            userData.position = userData.specialization;
        } else if (role === 'admin') {
            userData.permissionLevel = 'full';
        }
        
        const newUser = Database.addUser(userData);
        
        document.getElementById('add-user-modal').style.display = 'none';
        document.getElementById('add-user-form').reset();
        
        loadUsers();
        showNotification(`Пользователь ${name} успешно добавлен`, 'success');
        
    } catch (error) {
        console.error('Ошибка при добавлении пользователя:', error);
        showNotification('Ошибка добавления пользователя: ' + error.message, 'error');
    }
}

// Обновленная функция editUser для использования Database.updateUser
function editUser(userId) {
    try {
        const user = Database.getUser(userId);
        if (!user) {
            showNotification('Пользователь не найден', 'error');
            return;
        }
        
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-user-name').value = user.name || '';
        document.getElementById('edit-user-email').value = user.email || '';
        
        // Показываем/скрываем поля в зависимости от роли
        if (user.role === 'student') {
            document.getElementById('edit-user-class-group').style.display = 'block';
            document.getElementById('edit-user-balance-group').style.display = 'block';
            document.getElementById('edit-user-class').value = user.class || '';
            document.getElementById('edit-user-balance').value = user.balance || 0;
        } else {
            document.getElementById('edit-user-class-group').style.display = 'none';
            document.getElementById('edit-user-balance-group').style.display = 'none';
        }
        
        // Для поваров добавляем поле специализации
        if (user.role === 'cook') {
            if (!document.getElementById('edit-user-specialization-group')) {
                const form = document.getElementById('edit-user-form');
                const balanceGroup = document.getElementById('edit-user-balance-group');
                const specializationGroup = document.createElement('div');
                specializationGroup.className = 'form-group';
                specializationGroup.id = 'edit-user-specialization-group';
                specializationGroup.innerHTML = `
                    <label class="form-label">Специализация/Должность</label>
                    <input type="text" class="form-control" id="edit-user-specialization">
                `;
                form.insertBefore(specializationGroup, balanceGroup);
            }
            document.getElementById('edit-user-specialization-group').style.display = 'block';
            document.getElementById('edit-user-specialization').value = user.specialization || user.position || '';
        } else {
            const specGroup = document.getElementById('edit-user-specialization-group');
            if (specGroup) specGroup.style.display = 'none';
        }
        
        // Для администраторов добавляем поле уровня доступа
        if (user.role === 'admin') {
            if (!document.getElementById('edit-user-permission-group')) {
                const form = document.getElementById('edit-user-form');
                const statusGroup = document.querySelector('#edit-user-form .form-group:last-child');
                const permissionGroup = document.createElement('div');
                permissionGroup.className = 'form-group';
                permissionGroup.id = 'edit-user-permission-group';
                permissionGroup.innerHTML = `
                    <label class="form-label">Уровень доступа</label>
                    <select class="form-control" id="edit-user-permission">
                        <option value="full">Полный доступ</option>
                        <option value="limited">Ограниченный доступ</option>
                        <option value="view">Только просмотр</option>
                    </select>
                `;
                form.insertBefore(permissionGroup, statusGroup);
            }
            document.getElementById('edit-user-permission-group').style.display = 'block';
            document.getElementById('edit-user-permission').value = user.permissionLevel || 'full';
        } else {
            const permGroup = document.getElementById('edit-user-permission-group');
            if (permGroup) permGroup.style.display = 'none';
        }
        
        document.getElementById('edit-user-status').value = user.isActive ? 'active' : 'inactive';
        
        const modal = document.getElementById('edit-user-modal');
        modal.style.display = 'block';
        
        // Обработчик сохранения изменений
        document.getElementById('update-user-btn').onclick = function() {
            try {
                const updates = {
                    name: document.getElementById('edit-user-name').value,
                    email: document.getElementById('edit-user-email').value,
                    isActive: document.getElementById('edit-user-status').value === 'active'
                };
                
                if (user.role === 'student') {
                    updates.class = document.getElementById('edit-user-class').value;
                    updates.balance = parseInt(document.getElementById('edit-user-balance').value) || 0;
                } else if (user.role === 'cook') {
                    updates.specialization = document.getElementById('edit-user-specialization').value;
                    updates.position = updates.specialization;
                } else if (user.role === 'admin') {
                    updates.permissionLevel = document.getElementById('edit-user-permission').value;
                }
                
                Database.updateUser(user.id, updates);
                modal.style.display = 'none';
                loadUsers();
                showNotification('Данные пользователя обновлены', 'success');
                
            } catch (error) {
                console.error('Ошибка при обновлении пользователя:', error);
                showNotification('Ошибка обновления: ' + error.message, 'error');
            }
        };
        
    } catch (error) {
        console.error('Ошибка при редактировании пользователя:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Обновленная функция deleteUser
function deleteUser(userId, role) {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        
        // Проверяем, не пытается ли пользователь удалить самого себя
        if (currentUser && currentUser.id === userId) {
            showNotification('Вы не можете удалить свой собственный аккаунт!', 'error');
            return;
        }
        
        // Для администраторов дополнительная проверка
        if (role === 'admin') {
            const allAdmins = Database.getUsers('admin');
            if (allAdmins.length <= 1) {
                showNotification('Нельзя удалить последнего администратора системы!', 'error');
                return;
            }
        }
        
        if (confirm('Вы уверены, что хотите удалить пользователя? Это действие нельзя отменить.')) {
            Database.deleteUser(userId);
            loadUsers();
            showNotification('Пользователь удален', 'success');
        }
        
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        showNotification('Ошибка удаления: ' + error.message, 'error');
    }
}

// Обновленная функция resetUserPassword
function resetUserPassword(userId) {
    try {
        if (confirm('Сбросить пароль пользователя? Новый пароль будет сгенерирован автоматически.')) {
            const newPassword = Math.random().toString(36).slice(-8);
            Database.resetPassword(userId, newPassword);
            showNotification(`Пароль сброшен. Новый пароль: ${newPassword}`, 'info');
        }
    } catch (error) {
        console.error('Ошибка при сбросе пароля:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Обновленная функция toggleUserStatus
function toggleUserStatus(userId, active) {
    try {
        const action = active ? 'активировать' : 'деактивировать';
        if (confirm(`Вы уверены, что хотите ${action} пользователя?`)) {
            Database.toggleUserActive(userId, active);
            loadUsers();
            showNotification(`Пользователь ${active ? 'активирован' : 'деактивирован'}`, 'success');
        }
    } catch (error) {
        console.error('Ошибка при изменении статуса пользователя:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Обновленная функция generateReport
function generateReport() {
    try {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        
        if (!startDate || !endDate) {
            showNotification('Выберите период для отчета', 'warning');
            return;
        }
        
        const report = Database.generateReport(startDate, endDate);
        showReportPreview(report);
        
    } catch (error) {
        console.error('Ошибка при генерации отчета:', error);
        showNotification('Ошибка генерации отчета: ' + error.message, 'error');
    }
}

// Обновленная функция viewReport
function viewReport(reportType) {
    try {
        const startDate = document.getElementById('report-start-date').value || 
                         new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = document.getElementById('report-end-date').value || 
                        new Date().toISOString().split('T')[0];
        
        const report = Database.getReport(reportType, startDate, endDate);
        showReportPreview(report);
        
    } catch (error) {
        console.error('Ошибка при загрузке отчета:', error);
        showNotification('Ошибка загрузки отчета: ' + error.message, 'error');
    }
}

// Обновленная функция searchUsers
function searchUsers() {
    try {
        const searchTerm = document.getElementById('user-search').value.toLowerCase();
        const activeTab = document.querySelector('.tab.active');
        let role = null;
        
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            if (tabId === 'students-tab') role = 'student';
            else if (tabId === 'cooks-tab') role = 'cook';
            else if (tabId === 'admins-tab') role = 'admin';
        }
        
        const users = Database.searchUsers(searchTerm, role);
        
        if (role === 'student') {
            renderUsersTable(users, 'students-table', 'student');
        } else if (role === 'cook') {
            renderUsersTable(users, 'cooks-table', 'cook');
        } else if (role === 'admin') {
            renderUsersTable(users, 'admins-table', 'admin');
        }
        
    } catch (error) {
        console.error('Ошибка при поиске пользователей:', error);
        showNotification('Ошибка поиска: ' + error.message, 'error');
    }
}

// Обновленная функция loadUsers
function loadUsers() {
    try {
        console.log('Загрузка пользователей начата...');
        
        // Получаем всех пользователей
        const users = Database.getUsers();
        console.log('Всего пользователей из базы:', users.length);
        
        // Определяем активную вкладку
        const activeTab = document.querySelector('.tab.active');
        let tabId = 'students-tab'; // Значение по умолчанию
        
        if (activeTab) {
            tabId = activeTab.getAttribute('data-tab');
            console.log('Активная вкладка:', tabId);
        }
        
        // Фильтруем пользователей по роли в зависимости от вкладки
        let role = 'student';
        if (tabId === 'cooks-tab') role = 'cook';
        else if (tabId === 'admins-tab') role = 'admin';
        
        const filteredUsers = users.filter(user => user.role === role);
        console.log('Отфильтровано пользователей для роли', role + ':', filteredUsers.length);
        
        // Отображаем таблицу в зависимости от активной вкладки
        if (tabId === 'students-tab') {
            renderUsersTable(filteredUsers, 'students-table', 'student');
        } else if (tabId === 'cooks-tab') {
            renderUsersTable(filteredUsers, 'cooks-table', 'cook');
        } else if (tabId === 'admins-tab') {
            renderUsersTable(filteredUsers, 'admins-table', 'admin');
        }
        
        // Обновляем статистику
        updateUserStats(users);
        
        console.log('Загрузка пользователей завершена успешно');
        
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        showNotification('Ошибка загрузки пользователей: ' + error.message, 'error');
    }
}

// Обновленная функция loadNotifications
function loadNotifications() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!currentUser) return;
        
        const notifications = Database.getNotifications(currentUser.id, true);
        const container = document.getElementById('admin-notifications');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!notifications || notifications.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">Нет уведомлений</div>';
            return;
        }
        
        // Показываем только последние 5 уведомлений
        const recentNotifications = notifications.slice(0, 5);
        
        recentNotifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.isRead ? '' : 'unread'}`;
            
            const date = new Date(notification.createdAt || Date.now());
            const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            let icon = 'fa-bell';
            let color = '#007bff';
            
            switch(notification.type) {
                case 'payment': icon = 'fa-credit-card'; color = '#28a745'; break;
                case 'order': icon = 'fa-shopping-cart'; color = '#17a2b8'; break;
                case 'warning': icon = 'fa-exclamation-triangle'; color = '#ffc107'; break;
                case 'system': icon = 'fa-exclamation-circle'; color = '#dc3545'; break;
            }
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icon}" style="color: ${color};"></i>
                    <div style="flex: 1;">
                        <strong>${notification.title || 'Уведомление'}</strong>
                        <div style="font-size: 12px; color: #666;">${notification.message || ''}</div>
                    </div>
                    <div style="font-size: 12px; color: #999;">${timeString}</div>
                </div>
            `;
            
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Ошибка при загрузке уведомлений:', error);
    }
}
// 1. Вспомогательные функции
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification-alert alert-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: white;
        border-radius: 5px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 300px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon} fa-lg"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Добавляем стили для анимации
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

function safeNotification(message, type = 'info') {
    try {
        // Пытаемся использовать showNotification
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            // Fallback на console и alert
            console[type === 'error' ? 'error' : 'log'](message);
            if (type === 'error') {
                alert('Ошибка: ' + message);
            }
        }
    } catch (e) {
        console.error('Ошибка в safeNotification:', e);
        console.log(message);
    }
}

function getInitials(name) {
    if (!name) return 'АС';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function getRoleText(role) {
    const roles = {
        'student': 'Ученик',
        'cook': 'Повар',
        'admin': 'Администратор'
    };
    return roles[role] || role;
}

function getPermissionLevelText(level) {
    const levels = {
        'full': 'Полный доступ',
        'limited': 'Ограниченный доступ',
        'view': 'Только просмотр'
    };
    return levels[level] || level;
}

function getUrgencyText(urgency) {
    const texts = {
        'high': 'Высокая',
        'medium': 'Средняя',
        'low': 'Низкая'
    };
    return texts[urgency] || 'Не указана';
}

function getUrgencyClass(urgency) {
    switch(urgency) {
        case 'high': return 'badge-danger';
        case 'medium': return 'badge-warning';
        case 'low': return 'badge-info';
        default: return 'badge-secondary';
    }
}

function getPriorityText(priority) {
    const texts = {
        'high': 'Высокий',
        'medium': 'Средний',
        'low': 'Низкий'
    };
    return texts[priority] || 'Не указан';
}

function getEventTypeText(type) {
    const texts = {
        'payment': 'Оплата',
        'order': 'Заказ',
        'system': 'Система',
        'user': 'Пользователь',
        'purchase': 'Закупка',
        'low_stock': 'Низкий запас'
    };
    return texts[type] || type;
}

function getRecipientGroupName(group) {
    const names = {
        'all': 'Все пользователи',
        'students': 'Все ученики',
        'cooks': 'Все повара',
        'admins': 'Все администраторы'
    };
    return names[group] || group;
}

function getPageTitle(page) {
    const titles = {
        'dashboard': 'Общая статистика',
        'users': 'Управление пользователями',
        'purchases': 'Заявки на закупку',
        'reports': 'Отчеты',
        'settings': 'Настройки системы',
        'menu-editor': 'Редактор меню',
        'notifications': 'Управление уведомлениями'
    };
    return titles[page] || page;
}

// 2. Функции статистики пользователей
function updateUserStats(users) {
    try {
        // Общее количество пользователей
        const totalUsers = users.length;
        
        // Активные пользователи (по умолчанию все активные, если не указано иное)
        const activeUsers = users.filter(u => u.isActive !== false).length;
        
        // Статистика по ролям
        const students = users.filter(u => u.role === 'student');
        const cooks = users.filter(u => u.role === 'cook');
        const admins = users.filter(u => u.role === 'admin');
        
        // Находим все карточки статистики по их содержимому (тексту в h5)
        const statCards = document.querySelectorAll('.stat-card');
        
        statCards.forEach(card => {
            const titleElement = card.querySelector('h5');
            if (!titleElement) return;
            
            const title = titleElement.textContent.trim();
            const valueElement = card.querySelector('.stat-value');
            
            if (!valueElement) return;
            
            // Определяем какое значение подставить в зависимости от заголовка карточки
            switch(title) {
                case 'Всего пользователей':
                    valueElement.textContent = totalUsers;
                    break;
                case 'Активные пользователи':
                    valueElement.textContent = activeUsers;
                    break;
                case 'Студенты':
                    valueElement.textContent = students.length;
                    break;
                case 'Повара':
                    valueElement.textContent = cooks.length;
                    break;
                case 'Администраторы':
                    valueElement.textContent = admins.length;
                    break;
                case 'Активность':
                    if (totalUsers > 0) {
                        const percentage = Math.round((activeUsers / totalUsers) * 100);
                        valueElement.textContent = `${percentage}%`;
                    } else {
                        valueElement.textContent = '0%';
                    }
                    break;
                default:
                    // Если заголовок не совпадает ни с одним из ожидаемых, ничего не делаем
                    break;
            }
        });
        
        // Обновляем бейджи на вкладках (если вкладки имеют класс .nav-link с data-role)
        document.querySelectorAll('.nav-link[data-role]').forEach(tab => {
            const role = tab.getAttribute('data-role');
            let count = 0;
            
            if (role === 'student') count = students.length;
            else if (role === 'cook') count = cooks.length;
            else if (role === 'admin') count = admins.length;
            
            // Ищем или создаем бейдж
            let badge = tab.querySelector('.badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'badge bg-secondary ms-2';
                tab.appendChild(badge);
            }
            badge.textContent = count;
        });
        
        console.log('Статистика пользователей обновлена:', {
            total: totalUsers,
            active: activeUsers,
            students: students.length,
            cooks: cooks.length,
            admins: admins.length
        });
        
    } catch (error) {
        console.error('Ошибка при обновлении статистики:', error);
    }
}

// 3. Функции для работы с пользователями
function renderUsersTable(users, tableId, role) {
    try {
        console.log('renderUsersTable вызвана:', { tableId, role, usersCount: users.length });
        
        const table = document.getElementById(tableId);
        if (!table) {
            console.error('Таблица не найдена:', tableId);
            return;
        }
        
        const tbody = table.querySelector('tbody');
        if (!tbody) {
            console.error('tbody не найден в таблице:', tableId);
            return;
        }
        
        // Очищаем таблицу
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="8" class="text-center">Нет пользователей</td>`;
            tbody.appendChild(row);
            console.log('Нет пользователей для отображения');
            return;
        }
        
        // Для каждой роли свой формат строки
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            row.setAttribute('data-user-id', user.id);
            
            if (role === 'student') {
                row.innerHTML = `
                    <td>${user.id || (index + 1)}</td>
                    <td>${user.name || 'Не указано'}</td>
                    <td>${user.class || 'Не указан'}</td>
                    <td>${user.email || 'Не указан'}</td>
                    <td>${user.balance || 0} руб.</td>
                    <td>
                        <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                            ${user.isActive !== false ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-icon" onclick="viewUser(${user.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="editUser(${user.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            } else if (role === 'cook') {
                row.innerHTML = `
                    <td>${user.id || (index + 1)}</td>
                    <td>${user.name || 'Не указано'}</td>
                    <td>${user.position || 'Повар'}</td>
                    <td>${user.email || 'Не указан'}</td>
                    <td>${user.phone || 'Не указан'}</td>
                    <td>${user.hireDate || 'Не указана'}</td>
                    <td>
                        <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                            ${user.isActive !== false ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-icon" onclick="viewUser(${user.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="editUser(${user.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            } else if (role === 'admin') {
                row.innerHTML = `
                    <td>${user.id || (index + 1)}</td>
                    <td>${user.name || 'Не указано'}</td>
                    <td>${user.role || 'Администратор'}</td>
                    <td>${user.email || 'Не указан'}</td>
                    <td>${user.phone || 'Не указан'}</td>
                    <td>${user.permissionLevel || 'Администратор'}</td>
                    <td>
                        <span class="status-badge ${user.isActive !== false ? 'active' : 'inactive'}">
                            ${user.isActive !== false ? 'Активен' : 'Неактивен'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-icon" onclick="viewUser(${user.id})" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="editUser(${user.id})" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-icon btn-danger" onclick="deleteUser(${user.id})" title="Удалить">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            }
            
            tbody.appendChild(row);
        });
        
        console.log('Таблица успешно отрендерена:', tableId);
        
    } catch (error) {
        console.error('Ошибка при рендеринге таблицы:', error);
        const table = document.getElementById(tableId);
        if (table) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Ошибка загрузки данных</td></tr>`;
            }
        }
    }
}

function loadUsers() {
    try {
        console.log('Загрузка пользователей начата...');
        
        // Проверяем существование Database
        if (typeof Database === 'undefined') {
            console.error('Database не определен');
            safeNotification('Database не загружен', 'error');
            return;
        }
        
        // Проверяем существование метода getUsers
        if (typeof Database.getUsers !== 'function') {
            console.error('Database.getUsers не является функцией');
            safeNotification('Ошибка доступа к данным', 'error');
            return;
        }
        
        // Получаем всех пользователей
        const users = Database.getUsers();
        console.log('Всего пользователей из базы:', users);
        
        if (!users) {
            console.error('getUsers вернул undefined/null');
            safeNotification('Нет данных пользователей', 'error');
            return;
        }
        
        if (!Array.isArray(users)) {
            console.error('getUsers вернул не массив:', typeof users);
            safeNotification('Некорректные данные пользователей', 'error');
            return;
        }
        
        // Определяем активную вкладку
        const activeTab = document.querySelector('.tab.active');
        let tabId = 'students-tab'; // Значение по умолчанию
        
        if (activeTab) {
            tabId = activeTab.getAttribute('data-tab');
            console.log('Активная вкладка:', tabId);
        }
        
        // Фильтруем пользователей по роли в зависимости от вкладки
        let role = 'student';
        if (tabId === 'cooks-tab') role = 'cook';
        else if (tabId === 'admins-tab') role = 'admin';
        
        const filteredUsers = users.filter(user => user.role === role);
        console.log('Отфильтровано пользователей для роли', role + ':', filteredUsers.length);
        
        // Отображаем таблицу в зависимости от активной вкладки
        if (tabId === 'students-tab') {
            renderUsersTable(filteredUsers, 'students-table', 'student');
        } else if (tabId === 'cooks-tab') {
            renderUsersTable(filteredUsers, 'cooks-table', 'cook');
        } else if (tabId === 'admins-tab') {
            renderUsersTable(filteredUsers, 'admins-table', 'admin');
        }
        
        // Обновляем статистику
        updateUserStats(users);
        
        console.log('Загрузка пользователей завершена успешно');
        
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        // Используем безопасный вызов
        safeNotification('Ошибка загрузки пользователей: ' + error.message, 'error');
    }
}

// 4. Инициализация и навигация
function initTabs() {
    console.log('Инициализация вкладок...');
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            
            const tabId = this.getAttribute('data-tab');
            console.log('Клик по вкладке:', tabId);
            
            // Убираем active у всех вкладок
            document.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('active');
            });
            
            // Добавляем active текущей вкладке
            this.classList.add('active');
            
            // Скрываем все tab-content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Показываем соответствующий tab-content
            const content = document.getElementById(tabId);
            if (content) {
                content.classList.add('active');
                console.log('Показан контент вкладки:', tabId);
                
                // Загружаем пользователей для этой вкладки
                setTimeout(() => {
                    loadUsers();
                }, 100);
            } else {
                console.error('Контент вкладки не найден:', tabId);
            }
        });
    });
    
    console.log('Вкладки инициализированы');
}

function initNavigation() {
    console.log('Инициализация навигации...');
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const page = this.getAttribute('data-page');
            console.log('Переход на страницу:', page);
            
            // Убираем active у всех кнопок навигации
            document.querySelectorAll('.nav-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // Добавляем active текущей кнопке
            this.classList.add('active');
            
            // Скрываем все страницы
            document.querySelectorAll('.page-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Показываем выбранную страницу
            const pageElement = document.getElementById(page + '-page');
            if (pageElement) {
                pageElement.classList.add('active');
                document.getElementById('page-title').textContent = this.textContent.trim();
                
                // Если перешли на страницу пользователей, загружаем их
                if (page === 'users') {
                    setTimeout(() => {
                        loadUsers();
                    }, 100);
                }
            } else {
                console.error('Страница не найдена:', page);
            }
        });
    });
    
    console.log('Навигация инициализирована');
}

// 5. Основные функции администратора (без дубликатов)
function checkAuth() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function updateAdminInfo() {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    
    document.getElementById('admin-name').textContent = user.name || 'Администратор';
    document.getElementById('admin-fullname').textContent = user.name || 'Администратор Системы';
    
    const initials = getInitials(user.name || 'Администратор');
    document.getElementById('admin-avatar').innerHTML = `<div class="avatar-initials">${initials}</div>`;
    document.getElementById('admin-avatar-preview').innerHTML = `<div class="avatar-initials">${initials}</div>`;
}

function navigateToPage(page) {
    // Обновляем активные кнопки
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    // Показываем нужную страницу
    document.querySelectorAll('.page-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
        document.getElementById('page-title').textContent = getPageTitle(page);
        
        // Загружаем данные для страницы
        loadPageData(page);
    }
}

function loadPageData(page) {
    switch(page) {
        case 'dashboard':
            loadDashboardStats();
            loadCriticalEvents();
            break;
        case 'users':
            loadUsers();
            break;
        case 'purchases':
            loadPurchaseRequests('pending');
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'menu-editor':
            loadMenuEditor();
            break;
        case 'notifications':
            loadFullNotifications();
            loadNotificationsStats();
            break;
    }
}

function loadDashboardStats() {
    const stats = Database.getStatistics();
    const date = document.getElementById('stats-date').value || new Date().toISOString().split('T')[0];
    
    // Обновляем элементы статистики
    document.getElementById('stat-total-students').textContent = stats.totalStudents || 0;
    document.getElementById('stat-today-orders').textContent = stats.todayOrders || 0;
    document.getElementById('stat-pending-purchases').textContent = stats.pendingPurchases || 0;
    document.getElementById('stat-total-revenue').textContent = (stats.totalRevenue || 0).toLocaleString();
    
    // Общая информация
    const users = Database.getUsers();
    document.getElementById('total-users').textContent = users.length || 0;
    document.getElementById('total-revenue').textContent = (stats.totalRevenue || 0).toLocaleString();
    
    // Расчет процентов и изменений
    const lastMonthStudents = Math.floor(stats.totalStudents * 0.95);
    const changePercent = stats.totalStudents > 0 ? 
        Math.round(((stats.totalStudents - lastMonthStudents) / lastMonthStudents) * 100) : 0;
    
    document.getElementById('student-change').innerHTML = changePercent >= 0 ?
        `<i class="fas fa-arrow-up"></i> ${changePercent}% за месяц` :
        `<i class="fas fa-arrow-down"></i> ${Math.abs(changePercent)}% за месяц`;
    
    document.getElementById('student-change').className = `stat-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
    
    // Процент заказов
    const ordersPercentage = stats.totalStudents > 0 ? 
        Math.round((stats.todayOrders / stats.totalStudents) * 100) : 0;
    document.getElementById('orders-percentage').textContent = `${ordersPercentage}% от учеников`;
    
    // Обновляем графики
    updateCharts();
}
function showAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.style.display = 'block';
        // Сбросить форму
        const form = document.getElementById('add-user-form');
        if (form) form.reset();
        // Скрыть специфические поля
        document.querySelectorAll('.student-fields, .cook-fields').forEach(field => {
            field.style.display = 'none';
        });
        console.log('Модальное окно добавления пользователя открыто');
    }
}

function saveNewUser() {
    const role = document.getElementById('new-user-role')?.value;
    const name = document.getElementById('new-user-name')?.value;
    const email = document.getElementById('new-user-email')?.value;
    const login = document.getElementById('new-user-login')?.value;
    const password = document.getElementById('new-user-password')?.value;
    
    if (!role || !name || !email || !login || !password) {
        showNotification('Заполните все обязательные поля', 'warning');
        return;
    }
    
    const userData = {
        id: Date.now(),
        name,
        email,
        login,
        password,
        role,
        active: true,
        createdAt: new Date().toISOString()
    };
    
    if (role === 'student') {
        userData.class = document.getElementById('new-user-class')?.value || 'Не указан';
        userData.balance = parseInt(document.getElementById('new-user-balance')?.value) || 0;
    } else if (role === 'cook') {
        userData.specialization = document.getElementById('new-user-specialization')?.value || 'Повар';
    }
    
    // Проверяем, существует ли Database.addUser
    if (typeof Database !== 'undefined' && typeof Database.addUser === 'function') {
        Database.addUser(userData);
    } else {
        // Заглушка
        console.log('Добавление пользователя:', userData);
    }
    
    const modal = document.getElementById('add-user-modal');
    if (modal) modal.style.display = 'none';
    
    loadUsers();
    showNotification('Пользователь успешно добавлен', 'success');
}

function generateReport() {
    showNotification('Генерация отчета...', 'info');
    console.log('Генерация отчета');
    // Заглушка для генерации отчета
}

function viewReport(reportType) {
    showNotification('Просмотр отчета: ' + reportType, 'info');
    console.log('Просмотр отчета типа:', reportType);
    // Заглушка для просмотра отчета
}

function showSendNotificationModal() {
    const modal = document.getElementById('send-notification-modal');
    if (modal) {
        modal.style.display = 'block';
        console.log('Модальное окно отправки уведомления открыто');
    }
}

function sendNotification() {
    const type = document.getElementById('notification-type')?.value;
    const recipientsSelect = document.getElementById('notification-recipients');
    const recipients = recipientsSelect ? Array.from(recipientsSelect.selectedOptions).map(option => option.value) : [];
    const title = document.getElementById('notification-title')?.value;
    const message = document.getElementById('notification-message')?.value;
    
    if (!title || !message) {
        showNotification('Заполните заголовок и сообщение', 'warning');
        return;
    }
    
    if (recipients.length === 0) {
        showNotification('Выберите хотя бы одного получателя', 'warning');
        return;
    }
    
    const modal = document.getElementById('send-notification-modal');
    if (modal) modal.style.display = 'none';
    
    showNotification('Уведомление отправлено', 'success');
    console.log('Уведомление отправлено:', { type, recipients, title, message });
}

// Также нужно добавить функцию filterNotifications, если её нет
function filterNotifications(filter) {
    console.log('Фильтрация уведомлений по:', filter);
    // Заглушка для фильтрации уведомлений
}
function setupEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            navigateToPage(page);
        });
    });
    
    // Выход из системы
    document.getElementById('logout-btn').addEventListener('click', function() {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
    
    // Обновление статистики
    document.getElementById('refresh-stats').addEventListener('click', loadDashboardStats);
    
    // Добавление пользователя
    document.getElementById('add-user-btn').addEventListener('click', showAddUserModal);
    document.getElementById('save-user-btn').addEventListener('click', saveNewUser);
    
    // Изменение роли в форме добавления пользователя
    document.getElementById('new-user-role').addEventListener('change', function() {
        const role = this.value;
        document.querySelectorAll('.student-fields').forEach(field => {
            field.style.display = role === 'student' ? 'block' : 'none';
        });
        document.querySelectorAll('.cook-fields').forEach(field => {
            field.style.display = role === 'cook' ? 'block' : 'none';
        });
    });
    
    // Сохранение настроек
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
    
    // Отчеты
    document.getElementById('generate-report-btn').addEventListener('click', generateReport);
    document.querySelectorAll('.view-report-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const reportType = this.getAttribute('data-report');
            viewReport(reportType);
        });
    });
    
    // Поиск заявок
    document.getElementById('search-purchases').addEventListener('click', searchPurchases);
    document.getElementById('purchase-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchPurchases();
    });
    
    // Модальные окна
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Отправка уведомлений
    document.getElementById('send-notification-btn').addEventListener('click', showSendNotificationModal);
    document.getElementById('send-notification-confirm').addEventListener('click', sendNotification);
    
    // Фильтры уведомлений
    document.querySelectorAll('.notification-filters .btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.notification-filters .btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterNotifications(this.textContent.trim());
        });
    });
    
    // Поиск пользователей
    document.getElementById('search-users').addEventListener('click', searchUsers);
    document.getElementById('user-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchUsers();
    });
    
    // Добавляем обработчики для фильтров пользователей
    document.querySelectorAll('.user-filters .btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.user-filters .btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.getAttribute('data-filter');
            filterUsers(filter);
        });
    });
}

// 6. Загрузка и управление заявками на закупку
function loadPurchaseRequests(status = 'pending') {
    const requests = Database.getPurchaseRequests(status);
    const tableId = `${status}-purchases-table`;
    const tbody = document.querySelector(`#${tableId} tbody`);
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">Нет заявок</td>
            </tr>
        `;
        return;
    }
    
    requests.forEach(request => {
        const row = document.createElement('tr');
        const date = new Date(request.date || request.createdAt || Date.now());
        const formattedDate = date.toLocaleDateString('ru-RU');
        
        let urgencyClass = 'badge-secondary';
        switch(request.priority || request.urgency) {
            case 'high': urgencyClass = 'badge-danger'; break;
            case 'medium': urgencyClass = 'badge-warning'; break;
            case 'low': urgencyClass = 'badge-info'; break;
        }
        
        const urgencyText = getUrgencyText(request.priority || request.urgency);
        
        let actions = '';
        if (status === 'pending') {
            actions = `
                <div class="btn-group">
                    <button class="btn btn-sm btn-success approve-btn" data-id="${request.id}" title="Одобрить">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger reject-btn" data-id="${request.id}" title="Отклонить">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="btn btn-sm btn-primary view-btn" data-id="${request.id}" title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            `;
        } else {
            actions = `
                <button class="btn btn-sm btn-primary view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            `;
        }
        
        row.innerHTML = `
            <td>${request.id}</td>
            <td>${request.product || request.name || '-'}</td>
            <td>${request.quantity || 0} ${request.unit || 'шт.'}</td>
            <td>${request.cookName || request.requestedBy || '-'}</td>
            <td>${request.reason || '-'}</td>
            <td><span class="badge ${urgencyClass}">${urgencyText}</span></td>
            <td>${formattedDate}</td>
            <td>${actions}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Добавляем обработчики для кнопок
    addPurchaseRequestHandlers();
    // В функции loadPurchaseRequests добавить вкладку для отклоненных
    if (status === 'rejected') {
        // Специальное оформление для отклоненных заявок
        row.innerHTML = `
            <td>${request.id}</td>
            <td><strong>${request.product}</strong></td>
            <td>${request.quantity} ${request.unit}</td>
            <td>${request.cookName}</td>
            <td>${request.rejectionReason || 'Не указана'}</td>
            <td><span class="badge badge-danger">Отклонено</span></td>
            <td>${formattedDate}</td>
            <td>
                <button class="btn btn-sm btn-primary view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
    }
}
function loadMenuEditor() {
    // Выводим сообщение в консоль для отладки
    console.log('Загрузка редактора меню...');

    // Пример: получение данных меню из базы данных
    const menuData = Database.getMenu(); // Предполагается, что есть функция для получения данных

    // Проверяем, есть ли элементы меню
    if (!menuData || menuData.length === 0) {
        console.log('Меню пустое или не найдено.');
        return; // Завершаем выполнение функции, если данных нет
    }

    // Предполагается, что у вас есть элемент для отображения меню
    const menuContainer = document.getElementById('menu-editor-container');
    menuContainer.innerHTML = ''; // Очистить текущее содержимое контейнера

    // Заполняем контейнер меню данными
    menuData.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuContainer.appendChild(menuItem);
    });

    // Вызов функции для инициализации дополнительных функций, если нужно
    initMenuEditorEvents();
}

// Пример функции для редактирования элемента меню
function editMenuItem(itemId) {
    // Загрузка и отображение данных для редактирования
    console.log('Редактирование элемента меню с ID:', itemId);
    // Здесь вы можете добавить логику для загрузки и редактирования элемента меню
}

// Пример функции для удаления элемента меню
function deleteMenuItem(itemId) {
    console.log('Удаление элемента меню с ID:', itemId);
    // Здесь вы можете добавить логику для удаления элемента меню
}

// Пример инициализации дополнительных событий
function initMenuEditorEvents() {
    console.log('Инициализация событий редактора меню...');
    // Здесь можно добавить слушатели событий или другую логику
}
function addPurchaseRequestHandlers() {
    // Одобрение заявки
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const requestId = parseInt(this.getAttribute('data-id'));
            showApproveModal(requestId);
        });
    });
    
    // Отклонение заявки
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const requestId = parseInt(this.getAttribute('data-id'));
            showRejectModal(requestId);
        });
    });
    
    // Просмотр заявки
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const requestId = parseInt(this.getAttribute('data-id'));
            viewPurchaseRequest(requestId);
        });
    });
}

// 7. Уведомления
function loadNotifications() {
    const notifications = Database.getNotifications('admin');
    const container = document.getElementById('admin-notifications');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">Нет уведомлений</div>';
        return;
    }
    
    // Показываем только последние 5 уведомлений
    const recentNotifications = notifications.slice(0, 5);
    
    recentNotifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.read ? '' : 'unread'}`;
        
        const date = new Date(notification.date || Date.now());
        const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        let icon = 'fa-bell';
        let color = '#007bff';
        
        switch(notification.type) {
            case 'payment': icon = 'fa-credit-card'; color = '#28a745'; break;
            case 'order': icon = 'fa-shopping-cart'; color = '#17a2b8'; break;
            case 'warning': icon = 'fa-exclamation-triangle'; color = '#ffc107'; break;
            case 'alert': icon = 'fa-exclamation-circle'; color = '#dc3545'; break;
        }
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas ${icon}" style="color: ${color};"></i>
                <div style="flex: 1;">
                    <strong>${notification.title || 'Уведомление'}</strong>
                    <div style="font-size: 12px; color: #666;">${notification.message || ''}</div>
                </div>
                <div style="font-size: 12px; color: #999;">${timeString}</div>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function loadFullNotifications() {
    const notifications = Database.getNotifications('admin');
    const container = document.getElementById('notifications-list-full');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">Нет уведомлений</div>';
        return;
    }
    
    notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.read ? '' : 'unread'} mb-2`;
        
        const date = new Date(notification.date || Date.now());
        const dateString = date.toLocaleDateString('ru-RU');
        const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        let icon = 'fa-bell';
        let color = '#007bff';
        
        switch(notification.type) {
            case 'payment': icon = 'fa-credit-card'; color = '#28a745'; break;
            case 'order': icon = 'fa-shopping-cart'; color = '#17a2b8'; break;
            case 'warning': icon = 'fa-exclamation-triangle'; color = '#ffc107'; break;
            case 'alert': icon = 'fa-exclamation-circle'; color = '#dc3545'; break;
        }
        
        item.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 15px; padding: 15px;">
                <i class="fas ${icon} fa-2x" style="color: ${color}; margin-top: 5px;"></i>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>${notification.title || 'Уведомление'}</strong>
                        <div style="font-size: 12px; color: #999;">${dateString} ${timeString}</div>
                    </div>
                    <div style="color: #666; margin-bottom: 10px;">${notification.message || ''}</div>
                    <div style="font-size: 12px; color: #888;">
                        От: ${notification.sender || 'Система'} | 
                        Получатель: ${notification.recipient || 'Все'}
                    </div>
                </div>
                ${!notification.read ? '<span class="badge badge-success">Новое</span>' : ''}
            </div>
        `;
        
        container.appendChild(item);
    });
}

function loadNotificationsStats() {
    const notifications = Database.getNotifications('admin');
    const container = document.getElementById('notifications-stats');
    
    if (!container) return;
    
    const total = notifications.length;
    const unread = notifications.filter(n => !n.read).length;
    const byType = {
        info: notifications.filter(n => n.type === 'info').length,
        warning: notifications.filter(n => n.type === 'warning').length,
        alert: notifications.filter(n => n.type === 'alert').length,
        payment: notifications.filter(n => n.type === 'payment').length
    };
    
    container.innerHTML = `
        <div class="stats-summary">
            <div class="stat-row">
                <span>Всего:</span>
                <strong>${total}</strong>
            </div>
            <div class="stat-row">
                <span>Непрочитанных:</span>
                <strong class="text-warning">${unread}</strong>
            </div>
            <div class="stat-row">
                <span>Информационных:</span>
                <strong class="text-info">${byType.info}</strong>
            </div>
            <div class="stat-row">
                <span>Предупреждений:</span>
                <strong class="text-warning">${byType.warning}</strong>
            </div>
            <div class="stat-row">
                <span>Важных:</span>
                <strong class="text-danger">${byType.alert}</strong>
            </div>
            <div class="stat-row">
                <span>Платежей:</span>
                <strong class="text-success">${byType.payment}</strong>
            </div>
        </div>
    `;
}

function filterNotifications(filter) {
    const notifications = Database.getNotifications('admin');
    let filtered = notifications;
    
    switch(filter) {
        case 'Непрочитанные':
            filtered = notifications.filter(n => !n.read);
            break;
        case 'Системные':
            filtered = notifications.filter(n => n.sender === 'Система');
            break;
        case 'Оплаты':
            filtered = notifications.filter(n => n.type === 'payment');
            break;
    }
    
    const container = document.getElementById('notifications-list-full');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">Нет уведомлений</div>';
        return;
    }
    
    filtered.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.read ? '' : 'unread'} mb-2`;
        
        const date = new Date(notification.date || Date.now());
        const dateString = date.toLocaleDateString('ru-RU');
        const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        let icon = 'fa-bell';
        let color = '#007bff';
        
        switch(notification.type) {
            case 'payment': icon = 'fa-credit-card'; color = '#28a745'; break;
            case 'order': icon = 'fa-shopping-cart'; color = '#17a2b8'; break;
            case 'warning': icon = 'fa-exclamation-triangle'; color = '#ffc107'; break;
            case 'alert': icon = 'fa-exclamation-circle'; color = '#dc3545'; break;
        }
        
        item.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 15px; padding: 15px;">
                <i class="fas ${icon} fa-2x" style="color: ${color}; margin-top: 5px;"></i>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>${notification.title || 'Уведомление'}</strong>
                        <div style="font-size: 12px; color: #999;">${dateString} ${timeString}</div>
                    </div>
                    <div style="color: #666; margin-bottom: 10px;">${notification.message || ''}</div>
                    <div style="font-size: 12px; color: #888;">
                        От: ${notification.sender || 'Система'} | 
                        Получатель: ${notification.recipient || 'Все'}
                    </div>
                </div>
                ${!notification.read ? '<span class="badge badge-success">Новое</span>' : ''}
            </div>
        `;
        
        container.appendChild(item);
    });
}

// 8. Настройки
function loadSettings() {
    const settings = Database.getSettings() || {};

    const schoolNameEl = document.getElementById('school-name');
    if (schoolNameEl) schoolNameEl.value = settings.schoolName || '';

    const workStartEl = document.getElementById('work-start');
    if (workStartEl) workStartEl.value = settings.workStart || '';

    const workEndEl = document.getElementById('work-end');
    if (workEndEl) workEndEl.value = settings.workEnd || '';

    const minBalanceEl = document.getElementById('min-balance');
    if (minBalanceEl) minBalanceEl.value = (settings.minBalance !== undefined && settings.minBalance !== null)
        ? settings.minBalance
        : '';

    const emailNotEl = document.getElementById('email-notifications');
    if (emailNotEl) emailNotEl.checked = settings.emailNotifications === true;

    const orderNotEl = document.getElementById('order-notifications');
    if (orderNotEl) orderNotEl.checked = settings.orderNotifications === true;

    const lowStockNotEl = document.getElementById('low-stock-notifications');
    if (lowStockNotEl) lowStockNotEl.checked = settings.lowStockNotifications === true;
}

function saveSettings() {
    const minBalanceRaw = document.getElementById('min-balance')?.value;
    const minBalanceParsed = parseInt(minBalanceRaw, 10);

    const settings = {
        schoolName: document.getElementById('school-name')?.value || '',
        workStart: document.getElementById('work-start')?.value || '',
        workEnd: document.getElementById('work-end')?.value || '',
        minBalance: Number.isFinite(minBalanceParsed) ? minBalanceParsed : null,
        emailNotifications: document.getElementById('email-notifications')?.checked === true,
        orderNotifications: document.getElementById('order-notifications')?.checked === true,
        lowStockNotifications: document.getElementById('low-stock-notifications')?.checked === true,
        updatedAt: new Date().toISOString()
    };

    const ok = Database.updateSettings(settings);
    if (ok) {
        showNotification('Настройки сохранены', 'success');
    }
}

// 9. Отчеты
function loadReports() {
    // Устанавливаем даты по умолчанию для отчетов
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('report-start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('report-end-date').value = endDate.toISOString().split('T')[0];
}

function generateReport() {
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    
    if (!startDate || !endDate) {
        alert('Выберите период для отчета');
        return;
    }
    
    const report = Database.generateReport(startDate, endDate);
    showReportPreview(report);
}

function viewReport(reportType) {
    const startDate = document.getElementById('report-start-date').value || 
                     new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = document.getElementById('report-end-date').value || 
                    new Date().toISOString().split('T')[0];
    
    const report = Database.getReport(reportType, startDate, endDate);
    showReportPreview(report);
}
// Показать предпросмотр отчета
function showReportPreview(report) {
    const preview = document.getElementById('report-preview');
    const content = document.getElementById('report-content');
    
    if (!preview || !content) return;
    
    // Форматируем данные для красивого отображения
    let dataHtml = '';
    
    if (typeof report.data === 'object' && report.data !== null) {
        dataHtml = formatReportData(report.data);
    } else {
        dataHtml = `<pre>${JSON.stringify(report.data, null, 2)}</pre>`;
    }
    
    content.innerHTML = `
        <div class="report-header">
            <h5>${report.title || 'Отчет'}</h5>
            <p><strong>Период:</strong> ${report.period || 'Не указан'}</p>
            <p><strong>Сформирован:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
        </div>
        <div class="report-summary">
            ${report.summary || '<p>Нет описания отчета</p>'}
        </div>
        <div class="report-data mt-4">
            <h6>Данные отчета:</h6>
            ${dataHtml}
        </div>
    `;
    
    preview.style.display = 'block';
    
    // Обработчики для кнопок отчета
    document.getElementById('download-report').onclick = function() {
        downloadReport(report);
    };
    
    document.getElementById('print-report').onclick = function() {
        printReport(report);
    };
}

// Функция для форматирования данных отчета
function formatReportData(data, level = 0) {
    if (!data || typeof data !== 'object') {
        return `<span class="text-muted">${data || 'Нет данных'}</span>`;
    }
    
    if (Array.isArray(data)) {
        if (data.length === 0) {
            return '<p class="text-muted">Нет данных</p>';
        }
        
        let html = '<ul class="list-unstyled">';
        data.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
                html += `<li class="mb-2">
                    <strong>${index + 1}:</strong>
                    <div class="ml-3 mt-1">
                        ${formatReportData(item, level + 1)}
                    </div>
                </li>`;
            } else {
                html += `<li class="mb-1">${index + 1}: ${item}</li>`;
            }
        });
        html += '</ul>';
        return html;
    } else {
        // Это объект
        let html = '<div class="report-data-object">';
        
        // Сначала показываем простые значения
        Object.keys(data).forEach(key => {
            const value = data[key];
            
            if (typeof value !== 'object' || value === null) {
                html += `
                    <div class="data-row mb-2">
                        <div class="data-key"><strong>${key}:</strong></div>
                        <div class="data-value">${formatValue(value)}</div>
                    </div>
                `;
            }
        });
        
        // Затем показываем вложенные объекты
        Object.keys(data).forEach(key => {
            const value = data[key];
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                html += `
                    <div class="data-section mb-3">
                        <h6 class="mb-2">${key}:</h6>
                        <div class="ml-3">
                            ${formatReportData(value, level + 1)}
                        </div>
                    </div>
                `;
            } else if (Array.isArray(value)) {
                html += `
                    <div class="data-section mb-3">
                        <h6 class="mb-2">${key} (${value.length}):</h6>
                        <div class="ml-3">
                            ${formatReportData(value, level + 1)}
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        return html;
    }
}

// Функция для форматирования значений
function formatValue(value) {
    if (value === null || value === undefined) {
        return '<span class="text-muted">Не указано</span>';
    }
    
    if (typeof value === 'number') {
        // Если это деньги, добавляем руб.
        if (value >= 100 || value <= -100) {
            return `<span class="text-success">${value.toLocaleString('ru-RU')} руб.</span>`;
        }
        return value.toLocaleString('ru-RU');
    }
    
    if (typeof value === 'boolean') {
        return value ? 
            '<span class="badge badge-success">Да</span>' : 
            '<span class="badge badge-danger">Нет</span>';
    }
    
    if (typeof value === 'string') {
        // Проверяем, не является ли строка датой
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('ru-RU');
        }
        
        // Проверяем, не является ли строка процентом
        if (value.includes('%')) {
            return `<span class="text-primary">${value}</span>`;
        }
    }
    
    return value;
}

function downloadReport(report) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${report.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Отчет скачивается', 'success');
}

function printReport(report) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>${report.title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .report-info { margin-bottom: 20px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>${report.title}</h1>
            <div class="report-info">
                <p><strong>Период:</strong> ${report.period}</p>
                <p><strong>Дата формирования:</strong> ${new Date().toLocaleDateString('ru-RU')}</p>
            </div>
            <div class="summary">
                ${report.summary}
            </div>
            <h3>Данные отчета:</h3>
            <pre>${JSON.stringify(report.data, null, 2)}</pre>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// 10. Поиск и фильтрация
function searchUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const activeTab = document.querySelector('.tab.active');
    let role = null;
    
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab');
        if (tabId === 'students-tab') role = 'student';
        else if (tabId === 'cooks-tab') role = 'cook';
        else if (tabId === 'admins-tab') role = 'admin';
    }
    
    const users = Database.searchUsers(searchTerm, role);
    
    if (role === 'student') {
        renderUsersTable(users, 'students-table', 'student');
    } else if (role === 'cook') {
        renderUsersTable(users, 'cooks-table', 'cook');
    } else if (role === 'admin') {
        renderUsersTable(users, 'admins-table', 'admin');
    }
}

function filterUsers(filter) {
    const activeTab = document.querySelector('.tab.active');
    let role = null;
    
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab');
        if (tabId === 'students-tab') role = 'student';
        else if (tabId === 'cooks-tab') role = 'cook';
        else if (tabId === 'admins-tab') role = 'admin';
    }
    
    let users = Database.getUsers().filter(u => !role || u.role === role);
    
    switch(filter) {
        case 'active':
            users = users.filter(u => u.active);
            break;
        case 'inactive':
            users = users.filter(u => !u.active);
            break;
        case 'new':
            const today = new Date().toDateString();
            users = users.filter(u => {
                const created = new Date(u.createdAt).toDateString();
                return created === today;
            });
            break;
    }
    
    if (role === 'student') {
        renderUsersTable(users, 'students-table', 'student');
    } else if (role === 'cook') {
        renderUsersTable(users, 'cooks-table', 'cook');
    } else if (role === 'admin') {
        renderUsersTable(users, 'admins-table', 'admin');
    }
}

function searchPurchases() {
    const searchTerm = document.getElementById('purchase-search').value.toLowerCase();
    const allRequests = Database.getAllPurchaseRequests();
    const filteredRequests = allRequests.filter(request => 
        request.product.toLowerCase().includes(searchTerm) ||
        request.cookName.toLowerCase().includes(searchTerm) ||
        request.reason.toLowerCase().includes(searchTerm) ||
        request.id.toString().includes(searchTerm)
    );
    
    // Показываем результаты в активной вкладке
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab');
        const status = tabId.includes('pending') ? 'pending' : 
                     tabId.includes('approved') ? 'approved' : 
                     tabId.includes('rejected') ? 'rejected' : 'completed';
        
        const tableId = `${status}-purchases-table`;
        const tbody = document.querySelector(`#${tableId} tbody`);
        
        if (tbody) {
            tbody.innerHTML = '';
            
            if (filteredRequests.filter(r => r.status === status).length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center">Ничего не найдено</td>
                    </tr>
                `;
                return;
            }
            
            filteredRequests.filter(r => r.status === status).forEach(request => {
                const row = document.createElement('tr');
                const date = new Date(request.date || request.createdAt || Date.now());
                const formattedDate = date.toLocaleDateString('ru-RU');
                
                let urgencyClass = 'badge-secondary';
                switch(request.priority || request.urgency) {
                    case 'high': urgencyClass = 'badge-danger'; break;
                    case 'medium': urgencyClass = 'badge-warning'; break;
                    case 'low': urgencyClass = 'badge-info'; break;
                }
                
                const urgencyText = getUrgencyText(request.priority || request.urgency);
                
                let actions = '';
                if (status === 'pending') {
                    actions = `
                        <div class="btn-group">
                            <button class="btn btn-sm btn-success approve-btn" data-id="${request.id}" title="Одобрить">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-sm btn-danger reject-btn" data-id="${request.id}" title="Отклонить">
                                <i class="fas fa-times"></i>
                            </button>
                            <button class="btn btn-sm btn-primary view-btn" data-id="${request.id}" title="Просмотр">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    `;
                } else {
                    actions = `
                        <button class="btn btn-sm btn-primary view-btn" data-id="${request.id}" title="Просмотр">
                            <i class="fas fa-eye"></i>
                        </button>
                    `;
                }
                
                row.innerHTML = `
                    <td>${request.id}</td>
                    <td><strong>${request.product}</strong></td>
                    <td>${request.quantity} ${request.unit}</td>
                    <td>${request.cookName}</td>
                    <td>${request.reason}</td>
                    <td><span class="badge ${urgencyClass}">${urgencyText}</span></td>
                    <td>${formattedDate}</td>
                    <td>${actions}</td>
                `;
                
                tbody.appendChild(row);
            });
            
            // Добавляем обработчики для найденных заявок
            addPurchaseRequestHandlers();
        }
    }
}

// 11. Критические события (добавляем недостающую функцию)
function loadCriticalEvents() {
    // Загрузка критических событий для дашборда
    const events = Database.getCriticalEvents ? Database.getCriticalEvents() : [];
    const container = document.getElementById('critical-events');
    
    if (container) {
        container.innerHTML = '';
        
        if (events.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">Нет критических событий</div>';
            return;
        }
        
        events.slice(0, 5).forEach(event => {
            const item = document.createElement('div');
            item.className = 'event-item';
            
            const date = new Date(event.date || Date.now());
            const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            let icon = 'fa-exclamation-circle';
            let color = '#ffc107';
            
            switch(event.priority) {
                case 'high': icon = 'fa-exclamation-triangle'; color = '#dc3545'; break;
                case 'medium': icon = 'fa-exclamation-circle'; color = '#ffc107'; break;
                case 'low': icon = 'fa-info-circle'; color = '#17a2b8'; break;
            }
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icon}" style="color: ${color};"></i>
                    <div style="flex: 1;">
                        <strong>${event.description || 'Событие'}</strong>
                        <div style="font-size: 12px; color: #666;">${timeString}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary resolve-btn" data-id="${event.id}">
                        Решить
                    </button>
                </div>
            `;
            
            container.appendChild(item);
        });
    }
}

// 12. Остальные функции (добавляем недостающие)
function initializeCharts() {
    updateCharts();
}

function updateCharts() {
    // График распределения по классам
    const classCtx = document.getElementById('classDistributionChart');
    if (classCtx) {
        const users = Database.getUsers().filter(u => u.role === 'student');
        const classGroups = {};
        
        users.forEach(user => {
            const className = user.class || 'Не указан';
            classGroups[className] = (classGroups[className] || 0) + 1;
        });
        
        // Очищаем предыдущий график
        if (window.classChart) {
            window.classChart.destroy();
        }
        
        window.classChart = new Chart(classCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(classGroups),
                datasets: [{
                    data: Object.values(classGroups),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#8AC926', '#1982C4'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Распределение учеников по классам'
                    }
                }
            }
        });
    }
    
    // График динамики заказов
    const trendCtx = document.getElementById('ordersTrendChart');
    if (trendCtx) {
        const orders = Database.getOrders();
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('ru-RU', { weekday: 'short' });
        });
        
        const ordersByDay = Array(7).fill(0);
        orders.forEach(order => {
            const orderDate = new Date(order.date || order.createdAt);
            const diffDays = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                ordersByDay[6 - diffDays]++;
            }
        });
        
        // Очищаем предыдущий график
        if (window.trendChart) {
            window.trendChart.destroy();
        }
        
        window.trendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Количество заказов',
                    data: ordersByDay,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Динамика заказов за последние 7 дней'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }
}

// 13. Заглушки для функций которые используются но не определены
function viewUser(userId) {
    alert('Просмотр пользователя ID: ' + userId);
    console.log('Просмотр пользователя:', userId);
}

function editUser(userId) {
    const user = Database.getUser(userId);
    if (!user) return;
    
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-name').value = user.name || '';
    document.getElementById('edit-user-email').value = user.email || '';
    
    if (user.role === 'student') {
        document.getElementById('edit-user-class-group').style.display = 'block';
        document.getElementById('edit-user-balance-group').style.display = 'block';
        document.getElementById('edit-user-class').value = user.class || '';
        document.getElementById('edit-user-balance').value = user.balance || 0;
    } else {
        document.getElementById('edit-user-class-group').style.display = 'none';
        document.getElementById('edit-user-balance-group').style.display = 'none';
    }
    
    document.getElementById('edit-user-status').value = user.active ? 'active' : 'inactive';
    
    const modal = document.getElementById('edit-user-modal');
    modal.style.display = 'block';
    
    // Обработчик сохранения изменений
    document.getElementById('update-user-btn').onclick = function() {
        const updatedUser = {
            ...user,
            name: document.getElementById('edit-user-name').value,
            email: document.getElementById('edit-user-email').value,
            active: document.getElementById('edit-user-status').value === 'active'
        };
        
        if (user.role === 'student') {
            updatedUser.class = document.getElementById('edit-user-class').value;
            updatedUser.balance = parseInt(document.getElementById('edit-user-balance').value) || 0;
        }
        
        Database.updateUser(updatedUser);
        modal.style.display = 'none';
        loadUsers();
        showNotification('Данные пользователя обновлены', 'success');
    };
}
// Сброс пароля пользователя
function resetUserPassword(userId) {
    if (confirm('Сбросить пароль пользователя? Новый пароль будет сгенерирован автоматически.')) {
        const newPassword = Math.random().toString(36).slice(-8);
        Database.resetPassword(userId, newPassword);
        showNotification(`Пароль сброшен. Новый пароль: ${newPassword}`, 'info');
    }
}

    function deleteUser(userId) {
        if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            console.log('Удаление пользователя ID:', userId);
            if (typeof Database !== 'undefined' && typeof Database.deleteUser === 'function') {
                Database.deleteUser(userId);
                loadUsers();
                showNotification('Пользователь удален', 'success');
            } else {
                alert('Функция удаления недоступна');
            }
        }
    }
function deleteUser(userId, role) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // Проверяем, не пытается ли пользователь удалить самого себя
    if (currentUser && currentUser.id === userId) {
        alert('Вы не можете удалить свой собственный аккаунт!');
        return;
    }
    
    // Для администраторов дополнительная проверка
    if (role === 'admin') {
        const allAdmins = Database.getUsers().filter(u => u.role === 'admin');
        if (allAdmins.length <= 1) {
            alert('Нельзя удалить последнего администратора системы!');
            return;
        }
    }
    
    if (confirm('Вы уверены, что хотите удалить пользователя? Это действие нельзя отменить.')) {
        Database.deleteUser(userId);
        loadUsers();
        showNotification('Пользователь удален', 'success');
    }
}
function addUserActionsHandlers() {
    // Редактирование пользователя
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.getAttribute('data-id'));
            const role = this.getAttribute('data-role');
            editUser(userId);
        });
    });
    
    // Сброс пароля
    document.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.getAttribute('data-id'));
            resetUserPassword(userId);
        });
    });
    
    // Активация/деактивация пользователя
    document.querySelectorAll('.toggle-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.getAttribute('data-id'));
            const isActive = this.getAttribute('data-active') === 'true';
            toggleUserStatus(userId, !isActive);
        });
    });
    
    // Удаление пользователя
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = parseInt(this.getAttribute('data-id'));
            const role = this.getAttribute('data-role');
            deleteUser(userId, role);
        });
    });
}
// Показать модальное окно одобрения заявки
function showApproveModal(requestId) {
    const request = Database.getPurchaseRequest(requestId);
    if (!request) return;
    
    const modal = document.getElementById('approve-purchase-modal');
    const details = document.getElementById('purchase-details');
    
    details.innerHTML = `
        <div class="purchase-details">
            <h4>Заявка #${request.id}</h4>
            <p><strong>Продукт:</strong> ${request.product}</p>
            <p><strong>Количество:</strong> ${request.quantity} ${request.unit}</p>
            <p><strong>Повар:</strong> ${request.cookName}</p>
            <p><strong>Причина:</strong> ${request.reason}</p>
            <p><strong>Дата заявки:</strong> ${new Date(request.date || request.createdAt).toLocaleDateString('ru-RU')}</p>
            <p><strong>Срочность:</strong> <span class="badge ${getUrgencyClass(request.priority || request.urgency)}">${getUrgencyText(request.priority || request.urgency)}</span></p>
        </div>
    `;
}
// 14. Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем админку...');
    
    // Проверка авторизации
    if (!checkAuth()) return;
    
    // Инициализация Database
    if (typeof Database !== 'undefined' && Database.init) {
        Database.init();
    }
    
    // Обновление информации администратора
    updateAdminInfo();
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Инициализация вкладок
    initTabs();
    
    // Инициализация навигации
    initNavigation();
    
    // Инициализация графиков
    initializeCharts();
    
    // Установить сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stats-date').value = today;
    
    // Загрузка начальных данных
    setTimeout(() => {
        loadDashboardStats();
        loadUsers();
        loadPurchaseRequests('pending');
        loadNotifications();
        loadCriticalEvents();
    }, 500);
    
    console.log('Админка инициализирована');
});
function showRejectModal(requestId) {
    const request = Database.getPurchaseRequest(requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }
    
    const modal = document.getElementById('reject-purchase-modal');
    const details = document.getElementById('reject-purchase-details');
    
    details.innerHTML = `
        <div class="purchase-details">
            <h4>Заявка #${request.id} - Отклонение</h4>
            <p><strong>Продукт:</strong> ${request.product || request.productName}</p>
            <p><strong>Количество:</strong> ${request.quantity} ${request.unit}</p>
            <p><strong>Повар:</strong> ${request.cookName || 'Не указан'}</p>
            <p><strong>Причина заявки:</strong> ${request.reason}</p>
            <p><strong>Дата заявки:</strong> ${new Date(request.createdAt).toLocaleDateString('ru-RU')}</p>
            <p><strong>Текущий статус:</strong> <span class="badge badge-warning">${getRequestStatusText(request.status)}</span></p>
        </div>
        <div class="form-group mt-3">
            <label for="reject-reason">Причина отклонения (обязательно):</label>
            <textarea class="form-control" id="reject-reason" rows="3" placeholder="Укажите причину отклонения заявки..." required></textarea>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Сохраняем ID заявки в кнопке подтверждения
    const rejectBtn = document.getElementById('confirm-reject-btn');
    rejectBtn.dataset.requestId = requestId;
    
    // Устанавливаем обработчик
    rejectBtn.onclick = function() {
        const reason = document.getElementById('reject-reason').value.trim();
        if (!reason) {
            showNotification('Укажите причину отклонения', 'warning');
            return;
        }
        
        rejectPurchaseRequest(requestId, reason);
    };
}
function rejectPurchaseRequest(requestId, reason) {
    try {
        const request = Database.getPurchaseRequest(requestId);
        if (!request) {
            showNotification('Заявка не найдена', 'error');
            return;
        }
        
        // Обновляем статус заявки
        const updated = Database.updatePurchaseRequest(requestId, {
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: JSON.parse(sessionStorage.getItem('currentUser')).id,
            rejectionReason: reason,
            adminNotes: (request.adminNotes || '') + `\n[${new Date().toLocaleString('ru-RU')}] Отклонено. Причина: ${reason}`
        });
        
        if (updated) {
            // Закрываем модальное окно
            document.getElementById('reject-purchase-modal').style.display = 'none';
            
            // Обновляем список заявок
            loadPurchaseRequests('pending');
            
            // Показываем уведомление
            showNotification(`Заявка #${requestId} отклонена`, 'success');
            
            // Создаем уведомление для повара
            const notification = {
                type: 'purchase_rejected',
                title: 'Заявка на закупку отклонена',
                message: `Ваша заявка на ${request.product || request.productName} отклонена. Причина: ${reason}`,
                recipientId: request.cookId,
                relatedId: requestId,
                createdAt: new Date().toISOString()
            };
            
            Database.addNotification(notification);
        } else {
            showNotification('Ошибка при обновлении заявки', 'error');
        }
        
    } catch (error) {
        console.error('Ошибка при отклонении заявки:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}
// ============================================================
//  ЗАЯВКИ НА ЗАКУПКУ — ВКЛАДКИ, СОРТИРОВКА, КНОПКИ
// ============================================================

// ---------- Текущий статус вкладки ----------
let currentPurchaseStatus = 'pending';

// ---------- Инициализация вкладок заявок ----------
function initPurchaseTabs() {
    document.querySelectorAll('.purchase-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const status = this.getAttribute('data-status');
            switchPurchaseTab(status);
        });
    });
}

function switchPurchaseTab(status) {
    currentPurchaseStatus = status;

    // Визуальное переключение
    document.querySelectorAll('.purchase-tab').forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = '#666';
        t.style.fontWeight = '500';
        t.style.background = '#fff';
    });

    const activeTab = document.querySelector(`.purchase-tab[data-status="${status}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.borderBottomColor = '#007bff';
        activeTab.style.color = '#007bff';
        activeTab.style.fontWeight = '600';
        activeTab.style.background = '#f8f9ff';
    }

    // Загрузить данные
    loadPurchaseRequests(status);
}

// ---------- Получить ВСЕ заявки из любых источников ----------
function getAllRequests() {
    let all = [];

    try {
        if (typeof Database.getAllPurchaseRequests === 'function') {
            all = Database.getAllPurchaseRequests() || [];
        } else {
            // Собираем по статусам
            const statuses = ['pending', 'approved', 'rejected', 'completed'];
            statuses.forEach(s => {
                if (typeof Database.getPurchaseRequests === 'function') {
                    const items = Database.getPurchaseRequests(s) || [];
                    items.forEach(item => {
                        if (!item.status) item.status = s;
                        all.push(item);
                    });
                }
            });
        }
    } catch (e) {
        console.warn('getAllRequests fallback to localStorage:', e);
    }

    // Fallback — localStorage
    if (all.length === 0) {
        try {
            all = JSON.parse(localStorage.getItem('purchaseRequests') || '[]');
        } catch (e) { all = []; }
    }

    return all;
}

// ---------- Загрузка заявок для конкретного статуса ----------
function loadPurchaseRequests(status) {
    if (!status) status = currentPurchaseStatus || 'pending';
    currentPurchaseStatus = status;

    try {
        const allRequests = getAllRequests();

        // Фильтруем по статусу
        const filtered = allRequests.filter(r => r.status === status);

        // Сортируем: сначала новые
        filtered.sort((a, b) => {
            const dA = new Date(a.createdAt || a.date || 0);
            const dB = new Date(b.createdAt || b.date || 0);
            return dB - dA;
        });

        // Для срочности — высокая сверху (только для pending)
        if (status === 'pending') {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            filtered.sort((a, b) => {
                const pA = priorityOrder[a.priority || a.urgency] ?? 1;
                const pB = priorityOrder[b.priority || b.urgency] ?? 1;
                if (pA !== pB) return pA - pB;
                // Внутри одного приоритета — по дате (новые сверху)
                return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
            });
        }

        // Рендерим таблицу
        renderPurchaseTable(filtered, status);

        // Обновляем счётчики на всех вкладках
        updatePurchaseCounts(allRequests);

        // Обновляем сводку
        updatePurchasesSummary(allRequests);

    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        showNotification('Ошибка загрузки заявок: ' + error.message, 'error');
    }
}

// ---------- Рендер таблицы ----------
function renderPurchaseTable(requests, status) {
    const tbody = document.getElementById('purchases-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        const emptyMessages = {
            pending:   'Нет заявок, ожидающих рассмотрения',
            approved:  'Нет одобренных заявок',
            rejected:  'Нет отклонённых заявок',
            completed: 'Нет выполненных заявок'
        };
        const emptyIcons = {
            pending:   'fa-inbox',
            approved:  'fa-check-circle',
            rejected:  'fa-times-circle',
            completed: 'fa-box-open'
        };

        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:60px 20px; text-align:center; color:#aaa;">
                    <i class="fas ${emptyIcons[status] || 'fa-inbox'}" style="font-size:48px; margin-bottom:16px; display:block; opacity:0.4;"></i>
                    <div style="font-size:16px;">${emptyMessages[status] || 'Нет заявок'}</div>
                </td>
            </tr>
        `;
        return;
    }

    requests.forEach((request, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-request-id', request.id);

        // Анимация появления
        row.style.animation = `fadeInRow 0.3s ease ${index * 0.05}s both`;

        const date = new Date(request.date || request.createdAt || Date.now());
        const formattedDate = date.toLocaleDateString('ru-RU');

        const urgency = request.priority || request.urgency || 'medium';

        // Колонка «Причина / Комментарий» зависит от статуса
        let reasonCell = request.reason || '—';
        if (status === 'approved' && request.approvalComment) {
            reasonCell = `
                <div>${request.reason || '—'}</div>
                <div style="margin-top:4px; font-size:12px; color:#28a745;">
                    <i class="fas fa-comment"></i> ${request.approvalComment}
                </div>
            `;
        }
        if (status === 'rejected' && request.rejectionReason) {
            reasonCell = `
                <div style="text-decoration:line-through; color:#999;">${request.reason || '—'}</div>
                <div style="margin-top:4px; font-size:12px; color:#dc3545;">
                    <i class="fas fa-ban"></i> ${request.rejectionReason}
                </div>
            `;
        }

        // Статус-бейдж
        const statusBadge = `<span class="badge-${status}">${getRequestStatusText(status)}</span>`;

        // Кнопки действий
        const actions = buildActionButtons(request, status);

        row.innerHTML = `
            <td style="font-weight:600; color:#555;">#${request.id}</td>
            <td style="font-weight:600;">${request.product || request.productName || '—'}</td>
            <td>${request.quantity || 0} ${request.unit || 'шт.'}</td>
            <td>${request.cookName || request.requestedBy || '—'}</td>
            <td>${reasonCell}</td>
            <td><span class="badge ${getUrgencyClass(urgency)}">${getUrgencyText(urgency)}</span></td>
            <td>${formattedDate}</td>
            <td>${statusBadge}</td>
            <td style="text-align:center;">${actions}</td>
        `;

        tbody.appendChild(row);
    });

    // Навешиваем обработчики
    attachPurchaseButtonHandlers();

    // Добавляем CSS-анимацию если ещё нет
    if (!document.getElementById('purchase-animations')) {
        const style = document.createElement('style');
        style.id = 'purchase-animations';
        style.textContent = `
            @keyframes fadeInRow {
                from { opacity:0; transform:translateY(8px); }
                to   { opacity:1; transform:translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ---------- Кнопки действий в зависимости от статуса ----------
function buildActionButtons(request, status) {
    let html = '';

    switch (status) {
        case 'pending':
            html = `
                <button class="action-btn action-btn-approve approve-btn" data-id="${request.id}" title="Одобрить">
                    <i class="fas fa-check"></i>
                </button>
                <button class="action-btn action-btn-reject reject-btn" data-id="${request.id}" title="Отклонить">
                    <i class="fas fa-times"></i>
                </button>
                <button class="action-btn action-btn-view view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            `;
            break;

        case 'approved':
            html = `
                <button class="action-btn action-btn-complete complete-btn" data-id="${request.id}" title="Отметить выполненной">
                    <i class="fas fa-box-open"></i>
                </button>
                <button class="action-btn action-btn-view view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            `;
            break;

        case 'rejected':
            html = `
                <button class="action-btn action-btn-approve restore-btn" data-id="${request.id}" title="Вернуть на рассмотрение">
                    <i class="fas fa-undo"></i>
                </button>
                <button class="action-btn action-btn-view view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            `;
            break;

        case 'completed':
            html = `
                <button class="action-btn action-btn-view view-btn" data-id="${request.id}" title="Просмотр">
                    <i class="fas fa-eye"></i>
                </button>
            `;
            break;
    }

    return html;
}

// ---------- Счётчики на вкладках ----------
function updatePurchaseCounts(allRequests) {
    const counts = {
        pending:   0,
        approved:  0,
        rejected:  0,
        completed: 0
    };

    allRequests.forEach(r => {
        if (counts.hasOwnProperty(r.status)) {
            counts[r.status]++;
        }
    });

    Object.keys(counts).forEach(status => {
        const el = document.getElementById(`count-${status}`);
        if (el) {
            el.textContent = counts[status];
            // Скрываем бейдж если 0
            el.style.display = counts[status] > 0 ? 'inline-block' : 'none';
        }
    });
}

// ---------- Сводка внизу страницы ----------
function updatePurchasesSummary(allRequests) {
    const container = document.getElementById('purchases-summary');
    if (!container) return;

    const pending   = allRequests.filter(r => r.status === 'pending').length;
    const approved  = allRequests.filter(r => r.status === 'approved').length;
    const rejected  = allRequests.filter(r => r.status === 'rejected').length;
    const completed = allRequests.filter(r => r.status === 'completed').length;
    const total     = allRequests.length;

    const highPriority = allRequests.filter(r =>
        r.status === 'pending' && (r.priority === 'high' || r.urgency === 'high')
    ).length;

    container.innerHTML = `
        <div class="summary-card">
            <h4 style="color:#ffc107;">${pending}</h4>
            <p>Ожидают рассмотрения</p>
            ${highPriority > 0 ? `<small style="color:#dc3545;"><i class="fas fa-exclamation-triangle"></i> ${highPriority} срочных</small>` : ''}
        </div>
        <div class="summary-card">
            <h4 style="color:#28a745;">${approved}</h4>
            <p>Одобрено</p>
        </div>
        <div class="summary-card">
            <h4 style="color:#dc3545;">${rejected}</h4>
            <p>Отклонено</p>
        </div>
        <div class="summary-card">
            <h4 style="color:#6c757d;">${completed}</h4>
            <p>Выполнено</p>
        </div>
        <div class="summary-card">
            <h4 style="color:#007bff;">${total}</h4>
            <p>Всего заявок</p>
        </div>
    `;
}

// ============================================================
//  ОБРАБОТЧИКИ КНОПОК
// ============================================================

function attachPurchaseButtonHandlers() {
    // Защита от дублирования — клонируем кнопки
    const cloneAndBind = (selector, handler) => {
        document.querySelectorAll(selector).forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
        });
        document.querySelectorAll(selector).forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(this.getAttribute('data-id'));
                if (id) handler(id);
            });
        });
    };

    cloneAndBind('.approve-btn',  showApproveModal);
    cloneAndBind('.reject-btn',   showRejectModal);
    cloneAndBind('.view-btn',     viewPurchaseRequest);
    cloneAndBind('.complete-btn', completePurchaseRequest);
    cloneAndBind('.restore-btn',  restorePurchaseRequest);
}

// ============================================================
//  МОДАЛЬНЫЕ ОКНА
// ============================================================

function ensureModal(modalId, title, bodyHtml, footerHtml) {
    let modal = document.getElementById(modalId);

    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.cssText = `
            display:none; position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.5); z-index:10000;
            display:none; justify-content:center; align-items:flex-start;
            overflow-y:auto; padding:40px 20px;
        `;
        modal.innerHTML = `
            <div class="modal-dialog" style="
                background:#fff; border-radius:12px; max-width:580px; width:100%;
                margin:0 auto; box-shadow:0 8px 32px rgba(0,0,0,0.25);
                overflow:hidden; animation:modalSlideIn 0.3s ease;
            ">
                <div class="modal-header" style="
                    display:flex; justify-content:space-between; align-items:center;
                    padding:18px 24px; border-bottom:1px solid #e9ecef; background:#f8f9fa;
                ">
                    <h5 class="modal-title" style="margin:0; font-size:18px;">${title}</h5>
                    <button class="modal-close-x" style="
                        background:none; border:none; font-size:24px; cursor:pointer;
                        color:#666; line-height:1; padding:0 4px;
                    ">&times;</button>
                </div>
                <div class="modal-body" style="padding:24px;">${bodyHtml}</div>
                <div class="modal-footer" style="
                    display:flex; justify-content:flex-end; gap:10px;
                    padding:16px 24px; border-top:1px solid #e9ecef; background:#f8f9fa;
                ">${footerHtml}</div>
            </div>
        `;
        document.body.appendChild(modal);

        // Закрытие по крестику
        modal.querySelector('.modal-close-x').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        // Закрытие по фону
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.style.display = 'none';
        });

        // Анимация
        if (!document.getElementById('modal-animations')) {
            const st = document.createElement('style');
            st.id = 'modal-animations';
            st.textContent = `
                @keyframes modalSlideIn {
                    from { opacity:0; transform:translateY(-30px); }
                    to   { opacity:1; transform:translateY(0); }
                }
            `;
            document.head.appendChild(st);
        }
    }

    return modal;
}

function openModal(modal) {
    modal.style.display = 'flex';
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
}

// ---------- Найти заявку ----------
function findRequest(requestId) {
    let request = null;

    if (typeof Database.getPurchaseRequest === 'function') {
        request = Database.getPurchaseRequest(requestId);
    }
    if (!request) {
        const all = getAllRequests();
        request = all.find(r => r.id == requestId);
    }
    return request;
}

// ---------- Обновить заявку ----------
function updateRequest(requestId, updates) {
    let success = false;

    if (typeof Database.updatePurchaseRequest === 'function') {
        success = Database.updatePurchaseRequest(requestId, updates);
    }

    if (!success) {
        // Fallback — localStorage
        try {
            const key = 'purchaseRequests';
            const all = JSON.parse(localStorage.getItem(key) || '[]');
            const idx = all.findIndex(r => r.id == requestId);
            if (idx !== -1) {
                Object.assign(all[idx], updates);
                localStorage.setItem(key, JSON.stringify(all));
                success = true;
            }
        } catch (e) {
            console.error('Fallback update failed:', e);
        }
    }

    return success;
}

// ============================================================
//  ПРОСМОТР
// ============================================================

function viewPurchaseRequest(requestId) {
    const request = findRequest(requestId);
    if (!request) {
        showNotification('Заявка #' + requestId + ' не найдена', 'error');
        return;
    }

    const date = new Date(request.date || request.createdAt || Date.now());
    const urgency = request.priority || request.urgency || 'medium';
    const status = request.status || 'pending';

    let extraRows = '';

    if (status === 'approved') {
        extraRows = `
            <tr style="background:#d4edda;">
                <td style="padding:8px 12px;"><strong>Одобрена:</strong></td>
                <td style="padding:8px 12px;">${request.approvedAt ? new Date(request.approvedAt).toLocaleString('ru-RU') : '—'}</td>
            </tr>
            <tr>
                <td style="padding:8px 12px;"><strong>Кем одобрена:</strong></td>
                <td style="padding:8px 12px;">${request.approvedByName || '—'}</td>
            </tr>
            <tr style="background:#f8f9fa;">
                <td style="padding:8px 12px;"><strong>Комментарий:</strong></td>
                <td style="padding:8px 12px;">${request.approvalComment || '—'}</td>
            </tr>
        `;
    }
    if (status === 'rejected') {
        extraRows = `
            <tr style="background:#f8d7da;">
                <td style="padding:8px 12px;"><strong>Отклонена:</strong></td>
                <td style="padding:8px 12px;">${request.rejectedAt ? new Date(request.rejectedAt).toLocaleString('ru-RU') : '—'}</td>
            </tr>
            <tr>
                <td style="padding:8px 12px;"><strong>Кем отклонена:</strong></td>
                <td style="padding:8px 12px;">${request.rejectedByName || '—'}</td>
            </tr>
            <tr style="background:#f8f9fa;">
                <td style="padding:8px 12px;"><strong>Причина отклонения:</strong></td>
                <td style="padding:8px 12px; color:#dc3545; font-weight:600;">${request.rejectionReason || '—'}</td>
            </tr>
        `;
    }
    if (status === 'completed') {
        extraRows = `
            <tr style="background:#e2e3e5;">
                <td style="padding:8px 12px;"><strong>Выполнена:</strong></td>
                <td style="padding:8px 12px;">${request.completedAt ? new Date(request.completedAt).toLocaleString('ru-RU') : '—'}</td>
            </tr>
        `;
    }

    const bodyHtml = `
        <table style="width:100%; border-collapse:collapse;">
            <tr><td style="padding:8px 12px; width:40%;"><strong>ID:</strong></td>
                <td style="padding:8px 12px;">#${request.id}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:8px 12px;"><strong>Продукт:</strong></td>
                <td style="padding:8px 12px; font-weight:700;">${request.product || request.productName || '—'}</td></tr>
            <tr><td style="padding:8px 12px;"><strong>Количество:</strong></td>
                <td style="padding:8px 12px;">${request.quantity || 0} ${request.unit || 'шт.'}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:8px 12px;"><strong>Повар:</strong></td>
                <td style="padding:8px 12px;">${request.cookName || request.requestedBy || '—'}</td></tr>
            <tr><td style="padding:8px 12px;"><strong>Причина:</strong></td>
                <td style="padding:8px 12px;">${request.reason || '—'}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:8px 12px;"><strong>Срочность:</strong></td>
                <td style="padding:8px 12px;"><span class="badge ${getUrgencyClass(urgency)}">${getUrgencyText(urgency)}</span></td></tr>
            <tr><td style="padding:8px 12px;"><strong>Дата заявки:</strong></td>
                <td style="padding:8px 12px;">${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:8px 12px;"><strong>Статус:</strong></td>
                <td style="padding:8px 12px;"><span class="badge-${status}">${getRequestStatusText(status)}</span></td></tr>
            ${extraRows}
        </table>
    `;

    // Кнопки зависят от статуса
    let footerHtml = `
        <button onclick="closeModal('view-purchase-modal')"
                style="padding:8px 20px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">
            Закрыть
        </button>
    `;

    if (status === 'pending') {
        footerHtml = `
            <button onclick="closeModal('view-purchase-modal'); showApproveModal(${request.id})"
                    class="action-btn action-btn-approve">
                <i class="fas fa-check"></i> Одобрить
            </button>
            <button onclick="closeModal('view-purchase-modal'); showRejectModal(${request.id})"
                    class="action-btn action-btn-reject">
                <i class="fas fa-times"></i> Отклонить
            </button>
            ${footerHtml}
        `;
    }
    if (status === 'approved') {
        footerHtml = `
            <button onclick="closeModal('view-purchase-modal'); completePurchaseRequest(${request.id})"
                    class="action-btn action-btn-complete">
                <i class="fas fa-box-open"></i> Выполнена
            </button>
            ${footerHtml}
        `;
    }
    if (status === 'rejected') {
        footerHtml = `
            <button onclick="closeModal('view-purchase-modal'); restorePurchaseRequest(${request.id})"
                    class="action-btn action-btn-approve">
                <i class="fas fa-undo"></i> Вернуть
            </button>
            ${footerHtml}
        `;
    }

    const modal = ensureModal('view-purchase-modal', `Заявка #${request.id}`, bodyHtml, footerHtml);
    modal.querySelector('.modal-title').textContent = `Заявка #${request.id}`;
    modal.querySelector('.modal-body').innerHTML = bodyHtml;
    modal.querySelector('.modal-footer').innerHTML = footerHtml;
    openModal(modal);
}

// ============================================================
//  ОДОБРЕНИЕ
// ============================================================

function showApproveModal(requestId) {
    const request = findRequest(requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }

    const date = new Date(request.date || request.createdAt || Date.now());
    const urgency = request.priority || request.urgency || 'medium';

    const bodyHtml = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <tr><td style="padding:6px 10px; width:40%;"><strong>Продукт:</strong></td>
                <td style="padding:6px 10px; font-weight:700;">${request.product || request.productName}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:6px 10px;"><strong>Количество:</strong></td>
                <td style="padding:6px 10px;">${request.quantity} ${request.unit || 'шт.'}</td></tr>
            <tr><td style="padding:6px 10px;"><strong>Повар:</strong></td>
                <td style="padding:6px 10px;">${request.cookName || '—'}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:6px 10px;"><strong>Причина:</strong></td>
                <td style="padding:6px 10px;">${request.reason || '—'}</td></tr>
            <tr><td style="padding:6px 10px;"><strong>Срочность:</strong></td>
                <td style="padding:6px 10px;"><span class="badge ${getUrgencyClass(urgency)}">${getUrgencyText(urgency)}</span></td></tr>
        </table>

        <label for="approve-comment" style="display:block; margin-bottom:6px; font-weight:600;">
            Комментарий (необязательно):
        </label>
        <textarea id="approve-comment" rows="3"
            style="width:100%; padding:10px; border:1px solid #ced4da; border-radius:6px; resize:vertical;"
            placeholder="Например: закупить до пятницы"></textarea>
    `;

    const footerHtml = `
        <button id="confirm-approve-btn"
                style="padding:10px 24px; border:none; border-radius:6px;
                       background:#28a745; color:#fff; cursor:pointer; font-weight:600;">
            <i class="fas fa-check"></i> Одобрить заявку
        </button>
        <button onclick="closeModal('approve-purchase-modal')"
                style="padding:10px 24px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">
            Отмена
        </button>
    `;

    const modal = ensureModal('approve-purchase-modal', `Одобрить заявку #${request.id}`, bodyHtml, footerHtml);
    modal.querySelector('.modal-title').textContent = `Одобрить заявку #${request.id}`;
    modal.querySelector('.modal-body').innerHTML = bodyHtml;
    modal.querySelector('.modal-footer').innerHTML = footerHtml;
    openModal(modal);

    document.getElementById('confirm-approve-btn').addEventListener('click', function () {
        const comment = document.getElementById('approve-comment').value.trim();
        approvePurchaseRequest(requestId, comment);
    });
}

function approvePurchaseRequest(requestId, comment) {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {};

        const success = updateRequest(requestId, {
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.id || null,
            approvedByName: currentUser.name || 'Администратор',
            approvalComment: comment || ''
        });

        if (success) {
            closeModal('approve-purchase-modal');
            loadPurchaseRequests(currentPurchaseStatus);
            showNotification(`✓ Заявка #${requestId} одобрена`, 'success');

            // Уведомление повару
            notifyCook(requestId, 'purchase_approved',
                'Заявка одобрена', comment ? `Комментарий: ${comment}` : '');
        } else {
            showNotification('Не удалось одобрить заявку', 'error');
        }
    } catch (error) {
        console.error('Ошибка одобрения:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ============================================================
//  ОТКЛОНЕНИЕ
// ============================================================

function showRejectModal(requestId) {
    const request = findRequest(requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }

    const bodyHtml = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <tr><td style="padding:6px 10px; width:40%;"><strong>Продукт:</strong></td>
                <td style="padding:6px 10px; font-weight:700;">${request.product || request.productName}</td></tr>
            <tr style="background:#f8f9fa;"><td style="padding:6px 10px;"><strong>Количество:</strong></td>
                <td style="padding:6px 10px;">${request.quantity} ${request.unit || 'шт.'}</td></tr>
            <tr><td style="padding:6px 10px;"><strong>Повар:</strong></td>
                <td style="padding:6px 10px;">${request.cookName || '—'}</td></tr>
        </table>

        <label for="reject-reason-input" style="display:block; margin-bottom:6px; font-weight:600; color:#dc3545;">
            Причина отклонения <span style="color:#dc3545;">*</span>
        </label>
        <textarea id="reject-reason-input" rows="3" required
            style="width:100%; padding:10px; border:2px solid #dc3545; border-radius:6px; resize:vertical;"
            placeholder="Обязательно укажите причину..."></textarea>
        <small id="reject-error" style="color:#dc3545; display:none; margin-top:4px;">
            Пожалуйста, укажите причину отклонения
        </small>
    `;

    const footerHtml = `
        <button id="confirm-reject-btn"
                style="padding:10px 24px; border:none; border-radius:6px;
                       background:#dc3545; color:#fff; cursor:pointer; font-weight:600;">
            <i class="fas fa-times"></i> Отклонить заявку
        </button>
        <button onclick="closeModal('reject-purchase-modal')"
                style="padding:10px 24px; border:1px solid #ccc; border-radius:6px; background:#fff; cursor:pointer;">
            Отмена
        </button>
    `;

    const modal = ensureModal('reject-purchase-modal', `Отклонить заявку #${request.id}`, bodyHtml, footerHtml);
    modal.querySelector('.modal-title').textContent = `Отклонить заявку #${request.id}`;
    modal.querySelector('.modal-body').innerHTML = bodyHtml;
    modal.querySelector('.modal-footer').innerHTML = footerHtml;
    openModal(modal);

    document.getElementById('confirm-reject-btn').addEventListener('click', function () {
        const reason = document.getElementById('reject-reason-input').value.trim();
        if (!reason) {
            document.getElementById('reject-error').style.display = 'block';
            document.getElementById('reject-reason-input').focus();
            return;
        }
        rejectPurchaseRequest(requestId, reason);
    });
}

function rejectPurchaseRequest(requestId, reason) {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {};

        const success = updateRequest(requestId, {
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser.id || null,
            rejectedByName: currentUser.name || 'Администратор',
            rejectionReason: reason
        });

        if (success) {
            closeModal('reject-purchase-modal');
            loadPurchaseRequests(currentPurchaseStatus);
            showNotification(`✗ Заявка #${requestId} отклонена`, 'success');

            notifyCook(requestId, 'purchase_rejected',
                'Заявка отклонена', `Причина: ${reason}`);
        } else {
            showNotification('Не удалось отклонить заявку', 'error');
        }
    } catch (error) {
        console.error('Ошибка отклонения:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ============================================================
//  ВЫПОЛНЕНИЕ (одобрённая → выполненная)
// ============================================================

function completePurchaseRequest(requestId) {
    const request = findRequest(requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }

    if (!confirm(`Отметить заявку #${requestId} («${request.product || request.productName}») как выполненную?`)) {
        return;
    }

    try {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || {};

        const success = updateRequest(requestId, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: currentUser.id || null,
            completedByName: currentUser.name || 'Администратор'
        });

        if (success) {
            loadPurchaseRequests(currentPurchaseStatus);
            showNotification(`✓ Заявка #${requestId} выполнена`, 'success');

            notifyCook(requestId, 'purchase_completed',
                'Закупка выполнена', `Продукт «${request.product || request.productName}» закуплен.`);
        } else {
            showNotification('Не удалось обновить заявку', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ============================================================
//  ВОЗВРАТ (отклонённая → ожидающая)
// ============================================================

function restorePurchaseRequest(requestId) {
    const request = findRequest(requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }

    if (!confirm(`Вернуть заявку #${requestId} («${request.product || request.productName}») на рассмотрение?`)) {
        return;
    }

    try {
        const success = updateRequest(requestId, {
            status: 'pending',
            rejectedAt: null,
            rejectedBy: null,
            rejectedByName: null,
            rejectionReason: null,
            restoredAt: new Date().toISOString()
        });

        if (success) {
            loadPurchaseRequests(currentPurchaseStatus);
            showNotification(`↩ Заявка #${requestId} возвращена на рассмотрение`, 'success');

            notifyCook(requestId, 'purchase_restored',
                'Заявка возвращена', 'Ваша заявка снова на рассмотрении.');
        } else {
            showNotification('Не удалось обновить заявку', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ============================================================
//  ПОИСК ЗАЯВОК
// ============================================================

function searchPurchases() {
    const term = (document.getElementById('purchase-search')?.value || '').toLowerCase().trim();

    if (!term) {
        loadPurchaseRequests(currentPurchaseStatus);
        return;
    }

    const all = getAllRequests();
    const filtered = all.filter(r => {
        const product = (r.product || r.productName || '').toLowerCase();
        const cook    = (r.cookName || r.requestedBy || '').toLowerCase();
        const reason  = (r.reason || '').toLowerCase();
        const id      = String(r.id);
        return product.includes(term) || cook.includes(term) || reason.includes(term) || id.includes(term);
    });

    // Показываем результаты с текущим фильтром статуса
    const byStatus = filtered.filter(r => r.status === currentPurchaseStatus);

    renderPurchaseTable(byStatus, currentPurchaseStatus);
    updatePurchaseCounts(filtered); // Считаем только найденные

    if (byStatus.length === 0 && filtered.length > 0) {
        showNotification(
            `По запросу «${term}» найдено ${filtered.length} заявок, но не в текущей вкладке. Попробуйте другую вкладку.`,
            'info'
        );
    }
}

// ============================================================
//  УВЕДОМЛЕНИЕ ПОВАРУ
// ============================================================

function notifyCook(requestId, type, title, extraMessage) {
    try {
        const request = findRequest(requestId);
        if (!request) return;

        if (typeof Database.addNotification === 'function') {
            Database.addNotification({
                type: type,
                title: title,
                message: `Заявка на «${request.product || request.productName}». ${extraMessage || ''}`,
                recipientId: request.cookId,
                relatedId: requestId,
                createdAt: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn('Не удалось отправить уведомление повару:', e);
    }
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function getRequestStatusText(status) {
    return {
        pending:   'Ожидает',
        approved:  'Одобрена',
        rejected:  'Отклонена',
        completed: 'Выполнена'
    }[status] || status || 'Неизвестно';
}

function getUrgencyText(urgency) {
    return { high: 'Высокая', medium: 'Средняя', low: 'Низкая' }[urgency] || 'Средняя';
}

function getUrgencyClass(urgency) {
    return { high: 'badge-danger', medium: 'badge-warning', low: 'badge-info' }[urgency] || 'badge-warning';
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

// Добавьте в ваш DOMContentLoaded:
document.addEventListener('DOMContentLoaded', function () {
    // ... ваш существующий код ...

    // Инициализация вкладок заявок
    initPurchaseTabs();

    // Поиск
    const searchBtn = document.getElementById('search-purchases');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchPurchases);
    }
    const searchInput = document.getElementById('purchase-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchPurchases();
        });
        // Сброс при очистке поля
        searchInput.addEventListener('input', function () {
            if (this.value === '') loadPurchaseRequests(currentPurchaseStatus);
        });
    }

    // Первая загрузка
    loadPurchaseRequests('pending');
});