// script_final.js - Объединенная и исправленная версия

// ============= УТИЛИТЫ =============
const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    });

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

const formatCurrency = (amount) => {
    if (!amount) return '0';
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const formatDate = (dateString, type = 'date') => {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';

        if (type === 'time') {
            return date.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        }

        if (type === 'datetime') {
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }

        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return '-';
    }
};

const getCurrentUser = () => {
    // Приоритет: sessionStorage → localStorage → демо-пользователь
    try {
        let user = JSON.parse(sessionStorage.getItem('currentUser'));
        if (!user) {
            user = JSON.parse(localStorage.getItem('currentUser'));
        }
        
        // Если пользователь не найден, используем демо-пользователя
        if (!user) {
            user = {
                id: 'cook1',
                name: 'Петрова Анна Сергеевна',
                role: 'cook',
                login: 'cook',
                email: 'cook@school.ru',
                avatar: null
            };
            // Сохраняем демо-пользователя для будущих сессий
            sessionStorage.setItem('currentUser', JSON.stringify(user));
        }
        
        return user;
    } catch (e) {
        console.error('Error parsing user:', e);
        return null;
    }
};

const logout = () => {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
};

const confirm = (message, callback) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-question-circle"></i>
                    Подтверждение
                </h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="confirm-cancel">Отмена</button>
                <button class="btn btn-danger" id="confirm-ok">Продолжить</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#confirm-cancel').addEventListener('click', closeModal);
    modal.querySelector('#confirm-ok').addEventListener('click', () => {
        callback();
        closeModal();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
};

const openModal = (content, options = {}) => {
    const modal = document.createElement('div');
    modal.className = `modal active ${options.size ? 'modal-' + options.size : ''}`;
    modal.innerHTML = content;

    document.body.appendChild(modal);
    return modal;
};

const ModalSystem = {
    close: (modal) => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    }
};

// ============= КЛАСС ПАНЕЛИ ПОВАРА =============
class CookDashboard {
    constructor() {
        this.currentUser = getCurrentUser();
        this.currentPage = 'dashboard';
        this.initDatabase();
        this.init();
    }

    initDatabase() {
        // Инициализация Database если существует
        if (typeof Database !== 'undefined' && typeof Database.init === 'function') {
            Database.init();
        } else {
            // Создаем простую реализацию Database для демо
            this.setupDemoDatabase();
        }
        
        // Инициализация демо-данных только если нет реальных данных
        this.initDemoData();
    }

    setupDemoDatabase() {
        // Простая реализация Database для демо-целей
        window.Database = {
            init: function() {
                console.log('Demo Database initialized');
            },
            
            getOrders: function(userId = null, status = null, date = null) {
                try {
                    const orders = JSON.parse(localStorage.getItem('school_food_orders')) || [];
                    
                    let filtered = orders;
                    if (date) {
                        filtered = filtered.filter(order => order.date === date);
                    }
                    if (status) {
                        filtered = filtered.filter(order => order.status === status);
                    }
                    if (userId) {
                        filtered = filtered.filter(order => order.studentId === userId);
                    }
                    
                    return filtered;
                } catch (e) {
                    console.error('Error getting orders:', e);
                    return [];
                }
            },
            
            updateOrder: function(orderId, updates) {
                try {
                    const orders = JSON.parse(localStorage.getItem('school_food_orders')) || [];
                    const index = orders.findIndex(o => o.id === orderId);
                    
                    if (index !== -1) {
                        orders[index] = { ...orders[index], ...updates };
                        localStorage.setItem('school_food_orders', JSON.stringify(orders));
                        return true;
                    }
                    return false;
                } catch (e) {
                    console.error('Error updating order:', e);
                    return false;
                }
            },
            
            getMenu: function(date = null) {
                try {
                    return JSON.parse(localStorage.getItem('school_food_menu')) || [];
                } catch (e) {
                    console.error('Error getting menu:', e);
                    return [];
                }
            },
            
            addMenuItem: function(item) {
                try {
                    const menu = JSON.parse(localStorage.getItem('school_food_menu')) || [];
                    const newItem = {
                        id: 'dish_' + Date.now(),
                        ...item,
                        createdAt: new Date().toISOString()
                    };
                    menu.push(newItem);
                    localStorage.setItem('school_food_menu', JSON.stringify(menu));
                    return newItem;
                } catch (e) {
                    console.error('Error adding menu item:', e);
                    return null;
                }
            },
            
            deleteMenuItem: function(dishId) {
                try {
                    const menu = JSON.parse(localStorage.getItem('school_food_menu')) || [];
                    const filtered = menu.filter(dish => dish.id !== dishId);
                    localStorage.setItem('school_food_menu', JSON.stringify(filtered));
                    return true;
                } catch (e) {
                    console.error('Error deleting menu item:', e);
                    return false;
                }
            },
            
            getInventory: function(status = null, q = null) {
                try {
                    let inventory = JSON.parse(localStorage.getItem('school_food_inventory')) || [];
                    
                    if (q) {
                        inventory = inventory.filter(item => 
                            item.name.toLowerCase().includes(q.toLowerCase())
                        );
                    }
                    
                    return inventory;
                } catch (e) {
                    console.error('Error getting inventory:', e);
                    return [];
                }
            },
            
            addInventoryItem: function(item) {
                try {
                    const inventory = JSON.parse(localStorage.getItem('school_food_inventory')) || [];
                    const newItem = {
                        id: 'inv_' + Date.now(),
                        ...item,
                        currentStock: item.quantity,
                        minStock: item.minQuantity || item.quantity * 0.3
                    };
                    inventory.push(newItem);
                    localStorage.setItem('school_food_inventory', JSON.stringify(newItem));
                    return newItem;
                } catch (e) {
                    console.error('Error adding inventory item:', e);
                    return null;
                }
            },
            
            deleteInventoryItem: function(itemId) {
                try {
                    const inventory = JSON.parse(localStorage.getItem('school_food_inventory')) || [];
                    const filtered = inventory.filter(item => item.id !== itemId);
                    localStorage.setItem('school_food_inventory', JSON.stringify(filtered));
                    return true;
                } catch (e) {
                    console.error('Error deleting inventory item:', e);
                    return false;
                }
            },
            
            getNotifications: function() {
                try {
                    return JSON.parse(localStorage.getItem('school_food_notifications')) || [];
                } catch (e) {
                    console.error('Error getting notifications:', e);
                    return [];
                }
            },
            
            getPurchaseRequestsByCook: function(cookId) {
                try {
                    const requests = JSON.parse(localStorage.getItem('school_food_purchase_requests')) || [];
                    return requests.filter(req => req.cookId === cookId);
                } catch (e) {
                    console.error('Error getting purchase requests:', e);
                    return [];
                }
            },
            
            addPurchaseRequest: function(request) {
                try {
                    const requests = JSON.parse(localStorage.getItem('school_food_purchase_requests')) || [];
                    const newRequest = {
                        id: 'req_' + Date.now(),
                        ...request,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    };
                    requests.push(newRequest);
                    localStorage.setItem('school_food_purchase_requests', JSON.stringify(requests));
                    return newRequest;
                } catch (e) {
                    console.error('Error adding purchase request:', e);
                    return null;
                }
            }
        };
    }

    initDemoData() {
        // Инициализируем демо-данные только если нет существующих данных
        const hasData = localStorage.getItem('school_food_menu') || 
                       localStorage.getItem('school_food_orders') ||
                       localStorage.getItem('school_food_inventory');
        
        if (!hasData) {
            console.log('Initializing demo data...');
            
            const demoMenu = [
                {
                    id: '1',
                    name: 'Омлет с овощами',
                    type: 'breakfast',
                    price: 120,
                    description: 'Свежий омлет с болгарским перцем и зеленью',
                    calories: 350,
                    allergens: ['eggs', 'milk'],
                    cookingTime: 15,
                    isAvailable: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    name: 'Каша овсяная',
                    type: 'breakfast',
                    price: 80,
                    description: 'Овсяная каша с молоком и ягодами',
                    calories: 280,
                    allergens: ['gluten', 'milk'],
                    cookingTime: 10,
                    isAvailable: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: '3',
                    name: 'Суп куриный',
                    type: 'lunch',
                    price: 150,
                    description: 'Наваристый куриный суп с лапшой',
                    calories: 200,
                    allergens: ['gluten'],
                    cookingTime: 25,
                    isAvailable: true,
                    createdAt: new Date().toISOString()
                }
            ];
            localStorage.setItem('school_food_menu', JSON.stringify(demoMenu));

            const today = new Date().toISOString().split('T')[0];
            const demoOrders = [
                {
                    id: '1',
                    studentId: 'student1',
                    dishId: '1',
                    dishName: 'Омлет с овощами',
                    type: 'breakfast',
                    className: '10А',
                    studentName: 'Иванов Иван',
                    status: 'preparing',
                    price: 120,
                    createdAt: new Date().toISOString(),
                    date: today
                },
                {
                    id: '2',
                    studentId: 'student2',
                    dishId: '2',
                    dishName: 'Каша овсяная',
                    type: 'breakfast',
                    className: '7Б',
                    studentName: 'Петрова Мария',
                    status: 'paid',
                    price: 80,
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    date: today
                },
                {
                    id: '3',
                    studentId: 'student3',
                    dishId: '3',
                    dishName: 'Суп куриный',
                    type: 'lunch',
                    className: '11А',
                    studentName: 'Сидоров Алексей',
                    status: 'paid',
                    specialInstructions: 'Без лука',
                    price: 150,
                    createdAt: new Date(Date.now() - 7200000).toISOString(),
                    date: today
                }
            ];
            localStorage.setItem('school_food_orders', JSON.stringify(demoOrders));

            const demoInventory = [
                {
                    id: '1',
                    name: 'Куриное филе',
                    currentStock: 2.5,
                    unit: 'кг',
                    minStock: 5,
                    expiryDate: new Date(Date.now() + 7 * 24 * 3600000).toISOString().split('T')[0]
                },
                {
                    id: '2',
                    name: 'Картофель',
                    currentStock: 15,
                    unit: 'кг',
                    minStock: 10,
                    expiryDate: new Date(Date.now() + 30 * 24 * 3600000).toISOString().split('T')[0]
                },
                {
                    id: '3',
                    name: 'Яйца',
                    currentStock: 120,
                    unit: 'шт',
                    minStock: 50,
                    expiryDate: new Date(Date.now() + 14 * 24 * 3600000).toISOString().split('T')[0]
                }
            ];
            localStorage.setItem('school_food_inventory', JSON.stringify(demoInventory));

            const demoNotifications = [
                {
                    id: '1',
                    type: 'warning',
                    title: 'Заканчивается куриное филе',
                    message: 'Осталось 2.5 кг при минимальном запасе 5 кг',
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    type: 'info',
                    title: 'Новый отзыв на суп',
                    message: '5 звезд от ученика 11А класса',
                    createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
                }
            ];
            localStorage.setItem('school_food_notifications', JSON.stringify(demoNotifications));
        }
    }

    init() {
        // Проверка авторизации
        if (!this.currentUser || this.currentUser.role !== 'cook') {
            window.location.href = 'index.html';
            return;
        }

        // Устанавливаем текущую дату
        const today = new Date().toISOString().split('T')[0];
        const statsDate = document.getElementById('stats-date');
        if (statsDate && !statsDate.value) {
            statsDate.value = today;
        }

        this.initNavigation();
        this.initEventListeners();
        this.loadPage('dashboard');
    }

    initNavigation() {
        // Безопасное обновление информации пользователя
        this.updateUserInfo();
        
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = btn.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });

        // Выход
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                logout();
            });
        }

        // Загрузка аватара
        const avatarUpload = document.getElementById('avatar-upload');
        const avatarPreview = document.getElementById('avatar-preview');

        if (avatarUpload && avatarPreview) {
            avatarUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Avatar">`;
                    };
                    reader.readAsDataURL(file);
                    showNotification('Аватар успешно загружен', 'success');
                }
            });
        }
    }

    updateUserInfo() {
        if (!this.currentUser) return;
        
        const elements = {
            'user-name': this.currentUser.name,
            'profile-name': this.currentUser.name,
            'user-initials': this.getInitials(this.currentUser.name),
            'profile-initials': this.getInitials(this.currentUser.name)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    initEventListeners() {
        // Обновление статистики
        const refreshStatsBtn = document.getElementById('refresh-stats');
        if (refreshStatsBtn) {
            refreshStatsBtn.addEventListener('click', () => {
                this.loadStatistics();
                showNotification('Статистика обновлена', 'success');
            });
        }

        // Обновление заказов
        const refreshOrdersBtn = document.getElementById('refresh-orders');
        if (refreshOrdersBtn) {
            refreshOrdersBtn.addEventListener('click', () => {
                this.loadHotOrders();
                showNotification('Список заказов обновлен', 'success');
            });
        }

        // Добавление блюда
        const addDishBtn = document.getElementById('add-dish-btn');
        if (addDishBtn) {
            addDishBtn.addEventListener('click', () => {
                this.showAddDishModal();
            });
        }

        // Фильтр заказов
        const orderFilter = document.getElementById('order-type-filter');
        if (orderFilter) {
            orderFilter.addEventListener('change', (e) => {
                this.filterOrders(e.target.value);
            });
        }

        // Новая заявка на закупку
        const newPurchaseBtn = document.getElementById('new-purchase-btn');
        if (newPurchaseBtn) {
            newPurchaseBtn.addEventListener('click', () => {
                this.showNewPurchaseModal();
            });
        }

        // Добавление на склад
        const addInventoryBtn = document.getElementById('add-inventory-btn');
        if (addInventoryBtn) {
            addInventoryBtn.addEventListener('click', () => {
                this.showAddInventoryModal();
            });
        }

        // Закрытие модальных окон
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Сохранение блюда
        const saveDishBtn = document.getElementById('save-dish-btn');
        if (saveDishBtn) {
            saveDishBtn.addEventListener('click', () => this.saveDish());
        }

        // Глобальные обработчики событий
        document.addEventListener('click', (e) => {
            // Начать приготовление заказа
            const startBtn = e.target.closest('.start-order-btn') || e.target.closest('.start-order');
            if (startBtn) {
                const row = startBtn.closest('tr');
                if (row && row.dataset && row.dataset.id) {
                    this.startOrder(row.dataset.id);
                }
            }

            // Завершить приготовление заказа
            const completeBtn = e.target.closest('.complete-order-btn') || e.target.closest('.complete-order');
            if (completeBtn) {
                const row = completeBtn.closest('tr');
                if (row && row.dataset && row.dataset.id) {
                    this.completeOrder(row.dataset.id);
                }
            }

            // Удаление позиции инвентаря
            const deleteInvBtn = e.target.closest('.delete-inventory');
            if (deleteInvBtn) {
                const row = deleteInvBtn.closest('tr');
                if (row && row.dataset && row.dataset.id) {
                    this.deleteInventoryItem(row.dataset.id);
                }
            }
        });

        // Обработчики вкладок
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = tab.dataset.tab;
                if (tabId) {
                    this.switchTab(tabId);
                }
            });
        });
    }

    switchTab(tabId) {
        // Скрываем все табы
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показываем нужный таб
        const tabContent = document.getElementById(tabId);
        const tabButton = document.querySelector(`[data-tab="${tabId}"]`);

        if (tabContent) tabContent.classList.add('active');
        if (tabButton) tabButton.classList.add('active');

        // Загружаем данные для таба
        if (tabId.includes('menu')) {
            setTimeout(() => this.loadMenu(), 100);
        } else if (tabId.includes('purchases')) {
            setTimeout(() => this.loadPurchaseRequests(), 100);
        }
    }

    navigateTo(page) {
        // Обновление активной кнопки навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === page) {
                btn.classList.add('active');
            }
        });

        // Обновление заголовка
        const titles = {
            'dashboard': 'Статистика за сегодня',
            'menu-management': 'Управление меню',
            'orders': 'Заказы на сегодня',
            'inventory': 'Склад и инвентарь',
            'purchases': 'Заявки на закупку',
            
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[page] || page;
        }

        // Скрытие всех страниц
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.remove('active');
        });

        // Показ нужной страницы
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            this.loadPage(page);
        }

        this.currentPage = page;
    }

    loadPage(page) {
        switch(page) {
            case 'dashboard':
                this.loadStatistics();
                this.loadHotOrders();
                this.loadNotifications();
                break;
            case 'menu-management':
                this.loadMenu();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'inventory':
                this.loadInventory();
                break;
            case 'purchases':
                this.loadPurchaseRequests();
                break;
            case 'schedule':
                this.loadSchedule();
                break;
        }
    }

    loadStatistics() {
        const stats = this.getStatistics();

        // Безопасное обновление элементов
        const updates = {
            'total-orders': stats.totalOrders,
            'completed-orders': stats.completedOrders,
            'pending-orders': stats.pendingOrders,
            'total-revenue': formatCurrency(stats.totalRevenue),
            'today-prepared': stats.todayPrepared
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Процент выполненных заказов
        const completedPercentEl = document.getElementById('completed-percent');
        if (completedPercentEl) {
            const percent = stats.totalOrders > 0 ? 
                Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0;
            completedPercentEl.textContent = `${percent}%`;
        }
    }

    getStatistics() {
        const orders = this.getTodayOrders();

        // Исправленные статусы: совместимость с обеими системами
        const completedStatuses = new Set(['ready', 'received', 'completed']);
        const inProgressStatuses = new Set(['paid', 'preparing', 'pending']);
        const revenueStatuses = new Set(['paid', 'preparing', 'ready', 'received', 'completed']);

        const totalOrders = orders.filter(o => o.status !== 'cancelled').length;
        const completedOrders = orders.filter(o => completedStatuses.has(o.status)).length;
        const pendingOrders = orders.filter(o => inProgressStatuses.has(o.status)).length;
        const totalRevenue = orders
            .filter(o => revenueStatuses.has(o.status))
            .reduce((sum, o) => sum + (o.price || 0), 0);

        return {
            totalOrders,
            completedOrders,
            pendingOrders,
            totalRevenue,
            todayPrepared: completedOrders
        };
    }

    loadHotOrders() {
        const orders = this.getHotOrders();
        const tbody = document.querySelector('#hot-orders-table tbody');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-utensils fa-2x"></i>
                            <p>Нет активных заказов</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders
            .map(order => this.createHotOrderRow(order))
            .join('');
    }

    // В методе loadNotifications() добавить обработку уведомлений об отклонении
    loadNotifications() {
        const container = document.getElementById('cook-notifications');
        if (!container) return;

        const notifications = Database.getNotifications() || [];
        
        // Фильтруем уведомления для текущего повара
        const cookNotifications = notifications.filter(notif => 
            notif.recipientId === this.currentUser.id || 
            !notif.recipientId
        );
        
        // Отображаем уведомления с особым оформлением для отклоненных заявок
        container.innerHTML = cookNotifications
            .slice(0, 5)
            .map(n => {
                let iconClass = 'fa-info-circle';
                let textClass = 'text-primary';
                
                if (n.type === 'purchase_rejected') {
                    iconClass = 'fa-times-circle';
                    textClass = 'text-danger';
                } else if (n.type === 'warning') {
                    iconClass = 'fa-exclamation-triangle';
                    textClass = 'text-warning';
                }
                
                return `
                    <div class="notification-item ${n.type === 'purchase_rejected' ? 'rejected-notification' : ''}">
                        <i class="fas ${iconClass} ${textClass}"></i>
                        <div>
                            <strong>${n.title || 'Уведомление'}</strong>
                            <small>${n.message || ''}</small>
                            ${n.relatedId ? `<br><small class="text-muted">Заявка #${n.relatedId}</small>` : ''}
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    createHotOrderRow(order) {
        const statusClass = this.getStatusClass(order.status);
        const statusText = this.getStatusText(order.status);

        let actionButton = '';
        // Совместимость с обеими системами статусов
        if (order.status === 'paid' || order.status === 'pending') {
            actionButton = `
                <button class="btn btn-sm btn-primary start-order-btn">
                    <i class="fas fa-play"></i> Начать
                </button>
            `;
        } else if (order.status === 'preparing') {
            actionButton = `
                <button class="btn btn-sm btn-success complete-order-btn">
                    <i class="fas fa-check"></i> Готово
                </button>
            `;
        }

        return `
            <tr data-id="${order.id}">
                <td>${formatDate(order.createdAt, 'time')}</td>
                <td>${order.dishName}</td>
                <td>${order.className}</td>
                <td>${order.studentName}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${actionButton}</td>
            </tr>
        `;
    }

    startOrder(orderId) {
        if (!orderId) return;
        
        const order = this.getOrderById(orderId);
        if (!order) return;
        
        // Совместимость с обеими системами статусов
        const canStart = order.status === 'paid' || order.status === 'pending';
        if (!canStart) return;

        const res = Database.updateOrder(orderId, { status: 'preparing' });
        if (res) {
            this.loadHotOrders();
            this.loadOrders();
            this.loadStatistics();
            showNotification(`Приготовление заказа #${orderId} начато`, 'success');
        }
    }

    completeOrder(orderId) {
        if (!orderId) return;
        
        const order = this.getOrderById(orderId);
        if (!order) return;
        
        if (order.status !== 'preparing') return;

        const res = Database.updateOrder(orderId, { status: 'ready' });
        if (res) {
            this.loadHotOrders();
            this.loadOrders();
            this.loadStatistics();
            showNotification(`Заказ #${orderId} готов к выдаче`, 'success');
        }
    }

    loadMenu() {
        const menu = this.getMenu();
        const breakfastContainer = document.getElementById('breakfast-dishes');
        const lunchContainer = document.getElementById('lunch-dishes');

        if (breakfastContainer) {
            const breakfasts = menu.filter(dish => dish.type === 'breakfast');
            if (breakfasts.length === 0) {
                breakfastContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-utensils"></i>
                        <p>Нет блюд для завтрака</p>
                    </div>
                `;
            } else {
                breakfastContainer.innerHTML = breakfasts
                    .map(dish => this.createDishCard(dish))
                    .join('');
            }
        }

        if (lunchContainer) {
            const lunches = menu.filter(dish => dish.type === 'lunch');
            if (lunches.length === 0) {
                lunchContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-utensils"></i>
                        <p>Нет блюд для обеда</p>
                    </div>
                `;
            } else {
                lunchContainer.innerHTML = lunches
                    .map(dish => this.createDishCard(dish))
                    .join('');
            }
        }

        // Добавление обработчиков для действий с блюдами
        this.initDishActions();
    }

    createDishCard(dish) {
        return `
            <div class="food-card">
                <div class="food-card-image">
                    <div class="food-card-badge">
                        ${dish.type === 'breakfast' ? 'Завтрак' : 'Обед'}
                    </div>
                </div>
                <div class="food-card-content">
                    <h3 class="food-card-title">${dish.name}</h3>
                    <p class="food-card-description">${dish.description || 'Без описания'}</p>
                    <div class="food-card-details">
                        <div class="food-card-price">${formatCurrency(dish.price)} ₽</div>
                        <div class="food-card-calories">
                            <i class="fas fa-fire"></i>
                            ${dish.calories || 0} ккал
                        </div>
                    </div>
                    ${dish.allergens && dish.allergens.length > 0 ? `
                        <div class="food-card-allergens">
                            ${dish.allergens.map(a => `<span class="allergen-tag">${a}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="food-card-footer">
                        <button class="btn btn-outline edit-dish" data-id="${dish.id}">
                            <i class="fas fa-edit"></i> Изменить
                        </button>
                        <button class="btn btn-danger delete-dish" data-id="${dish.id}">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    initDishActions() {
        // Редактирование блюда
        document.querySelectorAll('.edit-dish').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dishId = btn.dataset.id;
                this.editDish(dishId);
            });
        });

        // Удаление блюда
        document.querySelectorAll('.delete-dish').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dishId = btn.dataset.id;
                this.deleteDish(dishId);
            });
        });
    }

    showAddDishModal() {
        const modal = document.getElementById('add-dish-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    saveDish() {
        const name = document.getElementById('dish-name')?.value.trim();
        const type = document.getElementById('dish-type')?.value;
        const priceRaw = document.getElementById('dish-price')?.value;
        const description = document.getElementById('dish-description')?.value.trim();
        const calories = parseInt(document.getElementById('dish-calories')?.value, 10) || 0;

        if (!name || !type || !priceRaw) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }

        const price = Number(priceRaw);
        if (Number.isNaN(price) || price <= 0) {
            showNotification('Цена должна быть числом больше 0', 'error');
            return;
        }

        const allergensSelect = document.getElementById('allergens-select');
        const allergens = allergensSelect ? 
            Array.from(allergensSelect.selectedOptions).map(opt => opt.value) : [];

        const dish = Database.addMenuItem({
            name,
            type,
            price,
            description,
            calories,
            allergens,
            isAvailable: true
        });

        if (!dish) {
            showNotification('Не удалось добавить блюдо', 'error');
            return;
        }

        // Закрываем модалку
        const modal = document.getElementById('add-dish-modal');
        if (modal) {
            modal.classList.remove('active');
        }

        // Сброс полей формы
        const form = document.getElementById('dish-form');
        if (form) {
            form.reset();
        }

        showNotification('Блюдо успешно добавлено', 'success');
        this.loadMenu();
    }

    editDish(dishId) {
        showNotification('Функция редактирования в разработке', 'info');
    }

    deleteDish(dishId) {
        confirm(
            'Удалить это блюдо из меню?',
            () => {
                const ok = Database.deleteMenuItem(dishId);
                if (!ok) {
                    showNotification('Не удалось удалить блюдо', 'error');
                    return;
                }
                showNotification('Блюдо удалено', 'success');
                this.loadMenu();
            }
        );
    }

    loadOrders() {
        const orders = this.getTodayOrders();
        const tbody = document.querySelector('#today-orders-table tbody');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-receipt"></i>
                            <p>Заказов на сегодня нет</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders
            .map(order => this.createOrderRow(order))
            .join('');

        // Обновление сводки
        this.updateOrdersSummary(orders);
    }

    createOrderRow(order) {
        const statusClass = this.getStatusClass(order.status);
        const statusText = this.getStatusText(order.status);

        let actionButton = '';
        if (order.status === 'paid' || order.status === 'pending') {
            actionButton = `
                <button class="btn btn-sm btn-primary start-order" data-id="${order.id}">
                    Начать
                </button>
            `;
        } else if (order.status === 'preparing') {
            actionButton = `
                <button class="btn btn-sm btn-success complete-order" data-id="${order.id}">
                    Готово
                </button>
            `;
        }

        return `
            <tr data-id="${order.id}">
                <td>${order.id}</td>
                <td>${order.dishName}</td>
                <td>${order.type === 'breakfast' ? 'Завтрак' : 'Обед'}</td>
                <td>${order.className}</td>
                <td>${order.specialInstructions || '-'}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${actionButton}</td>
            </tr>
        `;
    }

    updateOrdersSummary(orders) {
        const updates = {
            'total-breakfast': orders.filter(o => o.type === 'breakfast').length,
            'total-lunch': orders.filter(o => o.type === 'lunch').length,
            'special-orders': orders.filter(o => o.specialInstructions).length
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    filterOrders(type) {
        const rows = document.querySelectorAll('#today-orders-table tbody tr');

        rows.forEach(row => {
            if (type === 'all') {
                row.style.display = '';
            } else {
                const orderType = row.cells[2].textContent.toLowerCase();
                row.style.display = orderType.includes(type) ? '' : 'none';
            }
        });
    }

    loadInventory() {
        const inventory = this.getInventory();
        const tbody = document.querySelector('#inventory-table tbody');

        if (!tbody) return;

        if (inventory.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-boxes"></i>
                            <p>Инвентарь пустой</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = inventory
            .map(item => this.createInventoryRow(item))
            .join('');

        // Обновление статистики
        this.updateInventoryStats(inventory);
    }

    createInventoryRow(item) {
        const statusClass = this.getStockStatusClass(item);
        const statusText = this.getStockStatusText(item);
        const expiryDate = item.expiryDate ? formatDate(item.expiryDate) : '-';

        return `
            <tr data-id="${item.id}">
                <td>${item.name}</td>
                <td>${item.currentStock}</td>
                <td>${item.unit}</td>
                <td>${item.minStock}</td>
                <td>${expiryDate}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary edit-inventory" data-id="${item.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-inventory" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    updateInventoryStats(inventory) {
        const total = inventory.length;
        const lowStock = inventory.filter(item =>
            item.currentStock <= item.minStock * 1.5
        ).length;
        const outOfStock = inventory.filter(item =>
            item.currentStock <= item.minStock * 0.5
        ).length;

        const updates = {
            'total-items': total,
            'low-stock': lowStock,
            'out-of-stock': outOfStock
        };

        Object.entries(updates).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    deleteInventoryItem(itemId) {
        if (!itemId) return;
        
        confirm(
            'Вы уверены, что хотите удалить позицию со склада?',
            () => {
                const ok = Database.deleteInventoryItem(itemId);
                if (ok) {
                    this.loadInventory();
                    showNotification('Позиция удалена', 'success');
                } else {
                    showNotification('Не удалось удалить позицию', 'error');
                }
            }
        );
    }

    showAddInventoryModal() {
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-plus"></i>
                        Добавить на склад
                    </h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="add-inventory-form">
                        <div class="form-group">
                            <label class="form-label">Название продукта</label>
                            <input type="text" class="form-control" id="inventory-name" required>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Количество</label>
                                    <input type="number" class="form-control" id="inventory-quantity" step="0.01" required>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Единица измерения</label>
                                    <select class="form-control" id="inventory-unit">
                                        <option value="кг">кг</option>
                                        <option value="г">г</option>
                                        <option value="л">л</option>
                                        <option value="шт">шт</option>
                                        <option value="уп">уп</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Минимальный запас</label>
                                    <input type="number" class="form-control" id="inventory-min" step="0.01">
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Срок годности</label>
                                    <input type="date" class="form-control" id="inventory-expiry">
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Отмена</button>
                    <button class="btn btn-primary" id="save-inventory">Сохранить</button>
                </div>
            </div>
        `;

        const modal = openModal(content);

        modal.querySelector('#save-inventory').addEventListener('click', () => {
            this.saveInventoryItem(modal);
        });
    }

    saveInventoryItem(modal) {
        const name = modal.querySelector('#inventory-name')?.value.trim();
        const quantity = parseFloat(modal.querySelector('#inventory-quantity')?.value);
        const unit = modal.querySelector('#inventory-unit')?.value;
        const minStockRaw = modal.querySelector('#inventory-min')?.value;
        const minStock = minStockRaw ? parseFloat(minStockRaw) : quantity * 0.3;
        const expiryDate = modal.querySelector('#inventory-expiry')?.value;

        if (!name || Number.isNaN(quantity)) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }

        const item = Database.addInventoryItem({
            productName: name,
            quantity: quantity,
            unit: unit,
            minQuantity: Number.isFinite(minStock) ? minStock : quantity * 0.3,
            expirationDate: expiryDate || null
        });

        if (item) {
            ModalSystem.close(modal);
            showNotification('Продукт добавлен на склад', 'success');
            this.loadInventory();
        } else {
            showNotification('Не удалось добавить продукт', 'error');
        }
    }

    getStockStatusClass(item) {
        if (item.currentStock <= (item.minStock || 0) * 0.5) {
            return 'badge-danger';
        } else if (item.currentStock <= (item.minStock || 0) * 1.5) {
            return 'badge-warning';
        } else {
            return 'badge-success';
        }
    }

    getStockStatusText(item) {
        if (item.currentStock <= (item.minStock || 0) * 0.5) {
            return 'Мало';
        } else if (item.currentStock <= (item.minStock || 0) * 1.5) {
            return 'Низкий';
        } else {
            return 'Норма';
        }
    }

    loadPurchaseRequests() {
        const requests = this.getPurchaseRequests();
        const container = document.getElementById('pending-requests');

        if (!container) return;

        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Нет заявок на закупку</p>
                </div>
            `;
            return;
        }

        container.innerHTML = requests
            .map(request => this.createPurchaseRequestCard(request))
            .join('');
    }

    createPurchaseRequestCard(request) {
        const statusClass = this.getRequestStatusClass(request.status);
        const statusText = this.getRequestStatusText(request.status);

        return `
            <div class="request-card" data-id="${request.id}">
                <div class="request-header">
                    <div>
                        <h4 class="request-title">${request.productName}</h4>
                        <div class="request-meta">
                            <span class="request-date">${formatDate(request.createdAt)}</span>
                            <span class="request-status badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="request-quantity">
                        <span class="quantity">${request.quantity} ${request.unit}</span>
                    </div>
                </div>
                <div class="request-body">
                    <p><strong>Причина:</strong> ${request.reason}</p>
                    ${request.adminNotes ? `<p><strong>Комментарий:</strong> ${request.adminNotes}</p>` : ''}
                </div>
            </div>
        `;
    }

    showNewPurchaseModal() {
        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-shopping-cart"></i>
                        Новая заявка на закупку
                    </h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="new-purchase-form">
                        <div class="form-group">
                            <label class="form-label">Название продукта</label>
                            <input type="text" class="form-control" id="purchase-name" required>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Количество</label>
                                    <input type="number" class="form-control" id="purchase-quantity" step="0.01" required>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="form-group">
                                    <label class="form-label">Единица измерения</label>
                                    <select class="form-control" id="purchase-unit">
                                        <option value="кг">кг</option>
                                        <option value="г">г</option>
                                        <option value="л">л</option>
                                        <option value="шт">шт</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Приоритет</label>
                            <select class="form-control" id="purchase-priority">
                                <option value="normal">Обычный</option>
                                <option value="high">Высокий</option>
                                <option value="urgent">Срочный</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Причина закупки</label>
                            <textarea class="form-control" id="purchase-reason" rows="3" required></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Отмена</button>
                    <button class="btn btn-primary" id="submit-purchase">Отправить</button>
                </div>
            </div>
        `;

        const modal = openModal(content);

        modal.querySelector('#submit-purchase').addEventListener('click', () => {
            this.savePurchaseRequest(modal);
        });
    }

    savePurchaseRequest(modal) {
        const productName = modal.querySelector('#purchase-name')?.value;
        const quantity = parseFloat(modal.querySelector('#purchase-quantity')?.value);
        const unit = modal.querySelector('#purchase-unit')?.value;
        const priority = modal.querySelector('#purchase-priority')?.value;
        const reason = modal.querySelector('#purchase-reason')?.value;

        if (!productName || !quantity || !reason) {
            showNotification('Заполните обязательные поля', 'error');
            return;
        }

        if (!this.currentUser || !this.currentUser.id) {
            showNotification('Не удалось определить пользователя', 'error');
            return;
        }

        const priorityToUrgency = {
            normal: 'medium',
            high: 'high',
            urgent: 'high'
        };

        const request = Database.addPurchaseRequest({
            cookId: this.currentUser.id,
            productName,
            quantity,
            unit,
            urgency: priorityToUrgency[priority] || 'medium',
            reason
        });

        if (!request) {
            showNotification('Не удалось отправить заявку', 'error');
            return;
        }

        ModalSystem.close(modal);
        showNotification('Заявка отправлена на согласование', 'success');
        this.loadPurchaseRequests();
    }

    loadSchedule() {
        const pageContent = document.getElementById('schedule-page');
        if (pageContent) {
            pageContent.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-calendar-alt"></i>
                            График работы
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-center">Функция графика работы в разработке</p>
                    </div>
                </div>
            `;
        }
    }

    // Вспомогательные методы доступа к данным
    getTodayOrders() {
        const today = new Date().toISOString().split('T')[0];
        return Database.getOrders(null, null, today) || [];
    }

    getHotOrders() {
        const todayOrders = this.getTodayOrders();
        return todayOrders
            .filter(order => order.status === 'paid' || order.status === 'pending' || order.status === 'preparing')
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    getOrders() {
        return Database.getOrders() || [];
    }

    getOrderById(id) {
        const orders = this.getOrders();
        return orders.find(order => String(order.id) === String(id));
    }

    getMenu() {
        return Database.getMenu() || [];
    }

    getInventory() {
        return Database.getInventory() || [];
    }

    getPurchaseRequests() {
        if (!this.currentUser || !this.currentUser.id) return [];
        return Database.getPurchaseRequestsByCook(this.currentUser.id) || [];
    }

    getInitials(name) {
        if (!name) return 'ПА';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'badge-secondary',
            'paid': 'badge-warning',
            'preparing': 'badge-primary',
            'ready': 'badge-success',
            'received': 'badge-success',
            'completed': 'badge-success',
            'cancelled': 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    }

    getStatusText(status) {
        const texts = {
            'pending': 'Ожидает оплаты',
            'paid': 'В очереди',
            'preparing': 'Готовится',
            'ready': 'Готов',
            'received': 'Выдан',
            'completed': 'Выполнен',
            'cancelled': 'Отменён'
        };
        return texts[status] || 'Неизвестно';
    }

    getRequestStatusText(status) {
        const texts = {
            'pending': 'Ожидает',
            'approved': 'Одобрено',
            'rejected': 'Отклонено', // Добавлен статус "Отклонено"
            'ordered': 'Заказано',
            'completed': 'Выполнено'
        };
        return texts[status] || status;
    }
    getRequestStatusClass(status) {
        const classes = {
            'pending': 'badge-warning',
            'approved': 'badge-success',
            'rejected': 'badge-danger', // Красный цвет для отклоненных
            'ordered': 'badge-primary',
            'completed': 'badge-secondary'
        };
        return classes[status] || 'badge-secondary';
    }

}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    try {
        new CookDashboard();
    } catch (error) {
        console.error('Error initializing CookDashboard:', error);
        showNotification('Ошибка инициализации приложения', 'error');
    }
});
