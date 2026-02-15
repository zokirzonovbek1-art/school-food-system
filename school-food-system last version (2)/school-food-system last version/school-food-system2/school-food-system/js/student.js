// student.js — Личный кабинет ученика
// Полная версия: меню + заказы + аллергены + отзывы + АБОНЕМЕНТЫ

// =====================================================================
// ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ АБОНЕМЕНТОВ ========================
// =====================================================================
var subCart = [];
var subSelectedDays = {};
var subCurrentFilter = 'all';

// =====================================================================
// ========== КАТАЛОГ АБОНЕМЕНТОВ (данные от администратора) ============
// =====================================================================
var SUB_CATALOG = [
    {
        id: 'bf1',
        name: 'Завтрак «Доброе утро»',
        icon: '🌅',
        type: 'breakfast',
        cssType: 't-breakfast',
        desc: 'Сбалансированный завтрак для энергичного начала учебного дня',
        features: [
            'Каша или омлет на выбор',
            'Напиток (чай, какао, сок)',
            'Выпечка или фрукт',
            'Порции по нормам СанПиН'
        ],
        pricePerDay: 110,
        popular: false,
        badge: null,
        daysOptions: [5, 10, 15, 20],
        discounts: { '15': 5, '20': 10 }
    },
    {
        id: 'ln1',
        name: 'Обед стандартный',
        icon: '🍲',
        type: 'lunch',
        cssType: 't-lunch',
        desc: 'Классический школьный обед из трёх блюд с салатом',
        features: [
            'Суп дня',
            'Второе блюдо с гарниром',
            'Напиток и хлеб',
            'Салат из свежих овощей'
        ],
        pricePerDay: 160,
        popular: false,
        badge: null,
        daysOptions: [5, 10, 15, 20],
        discounts: { '15': 5, '20': 12 }
    },
    {
        id: 'cx1',
        name: 'Комплекс «Полный день»',
        icon: '⭐',
        type: 'complex',
        cssType: 't-complex',
        desc: 'Завтрак + обед + полдник — полноценное питание на весь день',
        features: [
            'Завтрак (каша, напиток, выпечка)',
            'Обед из трёх блюд',
            'Максимальная экономия — до 20%'
        ],
        pricePerDay: 250,
        popular: true,
        badge: 'Хит продаж',
        daysOptions: [5, 10, 15, 20],
        discounts: { '10': 5, '15': 10, '20': 20 }
    },
];

// =====================================================================
// ========== ИНИЦИАЛИЗАЦИЯ ============================================
// =====================================================================
document.addEventListener('DOMContentLoaded', function () {

    Database.init();

    var currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'student') {
        window.location.href = 'index.html';
        return;
    }

    var menuDateInput = document.getElementById('menu-date');
    if (menuDateInput && !menuDateInput.value) {
        menuDateInput.value = new Date().toISOString().split('T')[0];
    }

    updateUserInfo();

    // ── Навигация ──
    var navButtons = document.querySelectorAll('.nav-btn[data-page]');
    navButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var page = this.getAttribute('data-page');
            if (!page) return;
            document.querySelectorAll('.nav-btn').forEach(function (b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            document.querySelectorAll('.page-content').forEach(function (content) {
                content.classList.remove('active');
            });
            var pageElement = document.getElementById(page + '-page');
            if (pageElement) {
                pageElement.classList.add('active');
                document.getElementById('page-title').textContent = getPageTitle(page);
                loadPageData(page);
            }
        });
    });

    // ── Выход ──
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            sessionStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }

    // ── Пополнение баланса ──
    var addBalanceBtn = document.getElementById('add-balance-btn');
    if (addBalanceBtn) {
        addBalanceBtn.addEventListener('click', function () {
            showPaymentModal();
        });
    }

    // ── Аллергии ──
    var editAllergiesBtn = document.getElementById('edit-allergies-btn');
    if (editAllergiesBtn) {
        editAllergiesBtn.addEventListener('click', function () {
            toggleAllergiesSection();
        });
    }

    var addAllergyBtn = document.getElementById('add-allergy-btn');
    if (addAllergyBtn) {
        addAllergyBtn.addEventListener('click', function () {
            var input = document.getElementById('new-allergy');
            if (input && addAllergy(input.value)) {
                input.value = '';
            }
            if (input) input.focus();
        });
    }

    var newAllergyInput = document.getElementById('new-allergy');
    if (newAllergyInput) {
        newAllergyInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var btn = document.getElementById('add-allergy-btn');
                if (btn) btn.click();
            }
        });
    }

    initCommonAllergies();

    // ── Профиль ──
    var saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function () {
            saveProfile();
        });
    }

    // ── Меню ──
    loadMenu();

    document.querySelectorAll('.btn-filter').forEach(function (filter) {
        filter.addEventListener('click', function () {
            document.querySelectorAll('.btn-filter').forEach(function (f) {
                f.classList.remove('active');
            });
            this.classList.add('active');
            var type = this.getAttribute('data-type');
            filterMenu(type);
        });
    });

    var menuDateEl = document.getElementById('menu-date');
    if (menuDateEl) {
        menuDateEl.addEventListener('change', function () {
            loadMenu(this.value);
        });
    }

    var todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', function () {
            var today = new Date().toISOString().split('T')[0];
            var dateEl = document.getElementById('menu-date');
            if (dateEl) dateEl.value = today;
            loadMenu(today);
        });
    }

    // ── Стили абонементов ──
    injectSubscriptionStyles();

    // ── Загрузка начальных данных ──
    loadPageData('menu');
});


// =========================================================================
// ====================== СУЩЕСТВУЮЩИЕ ФУНКЦИИ =============================
// =========================================================================


// =====================================================================
// ========== ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ ================================
// =====================================================================

function updateUserInfo() {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var freshUser = Database.getUser(user.id);
    if (freshUser) {
        user = freshUser;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
    var userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = user.name;
    var userRoleEl = document.getElementById('user-role');
    if (userRoleEl) {
        userRoleEl.textContent = user.class ? 'Ученик ' + user.class + ' класса' : 'Ученик';
    }
    var profileNameEl = document.getElementById('profile-name');
    if (profileNameEl) profileNameEl.textContent = user.name;
    var profileAvatarEl = document.getElementById('profile-avatar');
    if (profileAvatarEl) profileAvatarEl.textContent = getInitials(user.name);
    var userAvatarEl = document.getElementById('user-avatar');
    if (userAvatarEl) userAvatarEl.textContent = getInitials(user.name);
    var profileClassEl = document.getElementById('profile-class');
    if (profileClassEl) profileClassEl.textContent = user.class || 'Не указан';
    var profileBalanceEl = document.getElementById('profile-balance');
    if (profileBalanceEl) profileBalanceEl.textContent = user.balance || 0;
    var fullnameEl = document.getElementById('profile-fullname');
    if (fullnameEl) fullnameEl.value = user.name;
    var emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.value = user.email;
    var classInputEl = document.getElementById('profile-class-input');
    if (classInputEl) classInputEl.value = user.class || '';
    var preferencesEl = document.getElementById('profile-preferences');
    if (preferencesEl) preferencesEl.value = user.preferences || '';
    updateAllergiesList(user.allergies || []);

    // Обновляем баланс на странице абонементов (если она открыта)
    var subBalEl = document.getElementById('sub-balance-display');
    if (subBalEl) {
        subBalEl.textContent = subFormatPrice(user.balance || 0);
    }
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(function (word) {
        return word[0];
    }).join('').toUpperCase();
}


// =====================================================================
// ========== РАБОТА С АЛЛЕРГИЯМИ ======================================
// =====================================================================

function updateAllergiesList(allergies) {
    var sidePanel = document.getElementById('allergies-list');
    if (sidePanel) {
        sidePanel.innerHTML = '';
        if (allergies.length === 0) {
            sidePanel.innerHTML = '<span style="font-size:12px; opacity:0.6;">Не указаны</span>';
        } else {
            allergies.forEach(function (allergy) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-warning';
                badge.style.marginRight = '4px';
                badge.style.marginBottom = '4px';
                badge.textContent = allergy;
                sidePanel.appendChild(badge);
            });
        }
    }
    var selectedContainer = document.getElementById('selected-allergies');
    if (selectedContainer) {
        selectedContainer.innerHTML = '';
        if (allergies.length === 0) {
            selectedContainer.innerHTML = '<p style="color:#999; font-size:13px;">Аллергии не добавлены</p>';
        } else {
            allergies.forEach(function (allergy) {
                var badge = document.createElement('span');
                badge.className = 'badge badge-warning';
                badge.style.cursor = 'pointer';
                badge.style.marginRight = '4px';
                badge.style.marginBottom = '4px';
                badge.textContent = allergy + ' ';
                var removeIcon = document.createElement('i');
                removeIcon.className = 'fas fa-times';
                removeIcon.style.marginLeft = '4px';
                removeIcon.style.fontSize = '10px';
                badge.appendChild(removeIcon);
                badge.addEventListener('click', function (e) {
                    e.stopPropagation();
                    removeAllergy(allergy);
                });
                selectedContainer.appendChild(badge);
            });
        }
    }
}

function removeAllergy(allergy) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var allergies = user.allergies || [];
    var updatedAllergies = allergies.filter(function (a) { return a !== allergy; });
    Database.updateUser(user.id, { allergies: updatedAllergies });
    user.allergies = updatedAllergies;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    updateAllergiesList(updatedAllergies);
    showNotification('Аллергия "' + allergy + '" удалена', 'info');
    var dateInput = document.getElementById('menu-date');
    var currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    loadMenu(currentDate);
}

function addAllergy(allergy) {
    if (!allergy || allergy.trim() === '') {
        showNotification('Введите название аллергена', 'error');
        return false;
    }
    allergy = allergy.trim().toLowerCase();
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return false;
    var allergies = user.allergies || [];
    if (allergies.indexOf(allergy) !== -1) {
        showNotification('Эта аллергия уже добавлена', 'warning');
        return false;
    }
    var updatedAllergies = allergies.slice();
    updatedAllergies.push(allergy);
    Database.updateUser(user.id, { allergies: updatedAllergies });
    user.allergies = updatedAllergies;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    updateAllergiesList(updatedAllergies);
    showNotification('Аллергия "' + allergy + '" добавлена', 'success');
    var dateInput = document.getElementById('menu-date');
    var currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    loadMenu(currentDate);
    return true;
}

function initCommonAllergies() {
    var commonAllergies = document.querySelectorAll('.allergy-option');
    commonAllergies.forEach(function (allergyElement) {
        var newEl = allergyElement.cloneNode(true);
        allergyElement.parentNode.replaceChild(newEl, allergyElement);
        newEl.addEventListener('click', function () {
            var allergyName = this.textContent.trim();
            addAllergy(allergyName);
        });
    });
}

function toggleAllergiesSection() {
    var profileBtn = document.querySelector('[data-page="profile"]');
    if (profileBtn) profileBtn.click();
    setTimeout(function () {
        var allergiesSection = document.querySelector('.allergies-edit');
        if (allergiesSection) allergiesSection.scrollIntoView({ behavior: 'smooth' });
    }, 150);
}


// =====================================================================
// ========== МЕНЮ (с учётом аллергенов) ===============================
// =====================================================================

function loadMenu(date) {
    var menuDate = date || new Date().toISOString().split('T')[0];
    var dateInput = document.getElementById('menu-date');
    if (dateInput) dateInput.value = menuDate;
    var menu = Database.getMenu(menuDate);
    var breakfasts = menu.filter(function (item) { return item.type === 'breakfast'; });
    var lunches    = menu.filter(function (item) { return item.type === 'lunch'; });
    var breakfastContainer = document.getElementById('breakfast-menu');
    if (breakfastContainer) {
        breakfastContainer.innerHTML = '';
        if (breakfasts.length === 0) {
            breakfastContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Завтраков на выбранную дату нет</p>';
        } else {
            breakfasts.forEach(function (item) {
                breakfastContainer.appendChild(createMenuItem(item));
            });
        }
    }
    var lunchContainer = document.getElementById('lunch-menu');
    if (lunchContainer) {
        lunchContainer.innerHTML = '';
        if (lunches.length === 0) {
            lunchContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">Обедов на выбранную дату нет</p>';
        } else {
            lunches.forEach(function (item) {
                lunchContainer.appendChild(createMenuItem(item));
            });
        }
    }
    var activeFilter = document.querySelector('.btn-filter.active');
    if (activeFilter) {
        var type = activeFilter.getAttribute('data-type');
        filterMenu(type);
    }
}

function filterMenu(type) {
    var allItems = document.querySelectorAll('.menu-item');
    allItems.forEach(function (item) {
        if (type === 'all') {
            item.style.display = 'block';
        } else {
            item.style.display = (item.getAttribute('data-type') === type) ? 'block' : 'none';
        }
    });
}

function createMenuItem(menuItem) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    var userAllergies = user ? (user.allergies || []) : [];
    var menuAllergens = menuItem.allergens || [];
    var matchedAllergens = [];
    var hasAllergy = userAllergies.some(function (allergy) {
        return menuAllergens.some(function (menuAllergy) {
            var match = menuAllergy.toLowerCase().indexOf(allergy.toLowerCase()) !== -1 ||
                        allergy.toLowerCase().indexOf(menuAllergy.toLowerCase()) !== -1;
            if (match && matchedAllergens.indexOf(menuAllergy) === -1) {
                matchedAllergens.push(menuAllergy);
            }
            return match;
        });
    });
    var div = document.createElement('div');
    div.className = 'menu-item' + (hasAllergy ? ' has-allergy' : '');
    div.setAttribute('data-type', menuItem.type);
    div.setAttribute('data-id', menuItem.id);
    var allergensHtml = '';
    if (menuAllergens.length > 0) {
        allergensHtml = '<div class="menu-item-allergens"><i class="fas fa-exclamation-circle"></i> Аллергены: ' + menuAllergens.join(', ') + '</div>';
    } else {
        allergensHtml = '<div class="menu-item-allergens text-success"><i class="fas fa-check"></i> Без аллергенов</div>';
    }
    var allergyWarning = '';
    if (hasAllergy) {
        allergyWarning = '<div class="alert alert-warning mt-2"><i class="fas fa-exclamation-triangle"></i> Содержит ваши аллергены: <strong>' + matchedAllergens.join(', ') + '</strong></div>';
    }
    div.innerHTML =
        '<div class="menu-item-header">' +
            '<div class="menu-item-title">' + menuItem.name + '</div>' +
            '<div class="menu-item-price">' + menuItem.price + ' руб.</div>' +
        '</div>' +
        '<div class="menu-item-description">' + menuItem.description + '</div>' +
        '<div class="menu-item-calories mb-2"><i class="fas fa-fire"></i> ' + menuItem.calories + ' ккал</div>' +
        allergensHtml + allergyWarning +
        '<div class="menu-item-footer mt-3">' +
            '<button class="btn btn-sm btn-primary order-btn" data-id="' + menuItem.id + '"><i class="fas fa-shopping-cart"></i> Заказать</button>' +
            '<button class="btn btn-sm btn-secondary info-btn" data-id="' + menuItem.id + '"><i class="fas fa-info-circle"></i> Подробнее</button>' +
        '</div>';
    div.querySelector('.order-btn').addEventListener('click', function () { orderMenuItem(menuItem.id); });
    div.querySelector('.info-btn').addEventListener('click', function () { showMenuItemInfo(menuItem.id); });
    return div;
}


// =====================================================================
// ========== ЗАКАЗ БЛЮДА ==============================================
// =====================================================================

function orderMenuItem(menuId) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var allMenu = Database.getMenu();
    var menuItem = allMenu.find(function (item) { return item.id === menuId; });
    if (!menuItem) { showNotification('Блюдо не найдено', 'error'); return; }
    if (user.balance < menuItem.price) {
        showNotification('Недостаточно средств на балансе', 'error');
        showPaymentModal();
        return;
    }
    var userAllergies = user.allergies || [];
    var menuAllergens = menuItem.allergens || [];
    var hasAllergy = userAllergies.some(function (allergy) {
        return menuAllergens.some(function (ma) {
            return ma.toLowerCase().indexOf(allergy.toLowerCase()) !== -1 ||
                   allergy.toLowerCase().indexOf(ma.toLowerCase()) !== -1;
        });
    });
    if (hasAllergy) {
        if (!confirm('⚠️ Внимание!\n\nБлюдо "' + menuItem.name + '" содержит ваши аллергены!\n\nВы уверены, что хотите заказать его?')) return;
    }
    Database.addOrder({
        studentId: user.id,
        studentName: user.name,
        menuId: menuId,
        menuName: menuItem.name,
        type: menuItem.type,
        price: menuItem.price,
        paymentType: 'one_time'
    });
    var newBalance = user.balance - menuItem.price;
    Database.updateUser(user.id, { balance: newBalance });
    user.balance = newBalance;
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    updateUserInfo();
    showNotification('Заказ на "' + menuItem.name + '" оформлен успешно!', 'success');
    var ordersPage = document.getElementById('orders-page');
    if (ordersPage && ordersPage.classList.contains('active')) {
        loadUserOrders(user.id);
    }
}


// =====================================================================
// ========== ЗАГРУЗКА ДАННЫХ ДЛЯ СТРАНИЦ =============================
// =====================================================================

function loadPageData(page) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    switch (page) {
        case 'menu':
            break;
        case 'orders':
            loadUserOrders(user.id);
            break;
        case 'reviews':
            loadUserReviews(user.id);
            break;
        case 'profile':
            loadUserProfile(user.id);
            break;
        case 'subscriptions':
            loadUserSubscriptions(user.id);
            break;
    }
}


// =====================================================================
// ========== ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ ======================================
// =====================================================================

function loadUserOrders(userId) {
    var orders = Database.getUserOrders(userId);
    var menu   = Database.getMenu();
    var tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:30px;">У вас ещё нет заказов</td></tr>';
        return;
    }
    orders.forEach(function (order) {
        var menuItem = menu.find(function (item) { return item.id === order.menuId; });
        var row = document.createElement('tr');
        var date = new Date(order.date);
        var formattedDate = date.toLocaleDateString('ru-RU');
        var statusClass = '', statusText = '';
        switch (order.status) {
            case 'pending':   statusClass = 'status-pending';   statusText = 'Ожидает оплаты'; break;
            case 'paid':      statusClass = 'status-paid';      statusText = 'Оплачен'; break;
            case 'received':  statusClass = 'status-received';  statusText = 'Получен'; break;
            case 'cancelled': statusClass = 'status-cancelled'; statusText = 'Отменён'; break;
        }
        var actions = '';
        if (order.status === 'pending') {
            actions = '<button class="btn btn-sm btn-success pay-order-btn" data-id="' + order.id + '"><i class="fas fa-credit-card"></i> Оплатить</button>' +
                      '<button class="btn btn-sm btn-danger cancel-order-btn" data-id="' + order.id + '"><i class="fas fa-times"></i> Отменить</button>';
        } else if (order.status === 'paid') {
            actions = '<button class="btn btn-sm btn-success receive-order-btn" data-id="' + order.id + '"><i class="fas fa-check"></i> Получить</button>';
        }
        row.innerHTML =
            '<td>' + formattedDate + '</td>' +
            '<td>' + (menuItem ? menuItem.name : 'Блюдо не найдено') + '</td>' +
            '<td>' + (order.type === 'breakfast' ? 'Завтрак' : 'Обед') + '</td>' +
            '<td>' + order.price + ' руб.</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
            '<td>' + actions + '</td>';
        tbody.appendChild(row);
    });
    document.querySelectorAll('.pay-order-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { payOrder(parseInt(this.getAttribute('data-id'))); });
    });
    document.querySelectorAll('.cancel-order-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { cancelOrder(parseInt(this.getAttribute('data-id'))); });
    });
    document.querySelectorAll('.receive-order-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { receiveOrder(parseInt(this.getAttribute('data-id'))); });
    });
}

function payOrder(orderId) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var order = Database.updateOrder(orderId, { status: 'paid' });
    if (order) {
        var newBalance = user.balance - order.price;
        Database.updateUser(user.id, { balance: newBalance });
        user.balance = newBalance;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        updateUserInfo();
        loadUserOrders(user.id);
        showNotification('Заказ успешно оплачен!', 'success');
    }
}

function receiveOrder(orderId) {
    var order = Database.updateOrder(orderId, { status: 'received', receivedAt: new Date().toISOString() });
    if (order) {
        loadUserOrders(order.studentId);
        showNotification('Заказ отмечен как полученный!', 'success');
    }
}

function cancelOrder(orderId) {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var order = Database.updateOrder(orderId, { status: 'cancelled' });
    if (order) {
        if (order.status === 'paid') {
            var newBalance = user.balance + order.price;
            Database.updateUser(user.id, { balance: newBalance });
            user.balance = newBalance;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            updateUserInfo();
        }
        loadUserOrders(user.id);
        showNotification('Заказ отменён', 'warning');
    }
}


// =====================================================================
// ========== СОХРАНЕНИЕ ПРОФИЛЯ =======================================
// =====================================================================

function saveProfile() {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var fullnameEl    = document.getElementById('profile-fullname');
    var emailEl       = document.getElementById('profile-email');
    var classInputEl  = document.getElementById('profile-class-input');
    var preferencesEl = document.getElementById('profile-preferences');
    var updatedData = {
        name:        fullnameEl ? fullnameEl.value : user.name,
        email:       emailEl ? emailEl.value : user.email,
        class:       classInputEl ? classInputEl.value : user.class,
        preferences: preferencesEl ? preferencesEl.value : user.preferences
    };
    Database.updateUser(user.id, updatedData);
    Object.assign(user, updatedData);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    updateUserInfo();
    showNotification('Профиль успешно сохранён', 'success');
}


// =====================================================================
// ========== МОДАЛЬНОЕ ОКНО ОПЛАТЫ ====================================
// =====================================================================

function showPaymentModal() {
    var modal = document.getElementById('payment-modal');
    if (!modal) return;
    var paymentAmount = document.getElementById('payment-amount');
    if (paymentAmount) paymentAmount.value = '100';
    var paymentTotal = document.getElementById('payment-total');
    if (paymentTotal) paymentTotal.textContent = '100';
    var oldConfirmButton = document.getElementById('confirm-payment');
    if (oldConfirmButton) {
        var newConfirmButton = oldConfirmButton.cloneNode(true);
        oldConfirmButton.parentNode.replaceChild(newConfirmButton, oldConfirmButton);
    }
    modal.classList.add('active');
    modal.querySelectorAll('.modal-close').forEach(function (btn) {
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function () { modal.classList.remove('active'); });
    });
    if (paymentAmount) {
        paymentAmount.addEventListener('input', function () {
            var numValue = parseInt(this.value) || 0;
            var totalEl = document.getElementById('payment-total');
            if (totalEl) totalEl.textContent = numValue;
        });
    }
    var confirmBtn = document.getElementById('confirm-payment');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            var amountEl = document.getElementById('payment-amount');
            var amount = amountEl ? (parseInt(amountEl.value) || 0) : 0;
            if (amount < 100) {
                showNotification('Минимальная сумма пополнения — 100 руб.', 'error');
                return;
            }
            var user = JSON.parse(sessionStorage.getItem('currentUser'));
            if (!user) return;
            var newBalance = (parseFloat(user.balance) || 0) + amount;
            Database.updateUser(user.id, { balance: newBalance });
            user.balance = newBalance;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            updateUserInfo();
            modal.classList.remove('active');
            showNotification('Баланс успешно пополнен на ' + amount + ' руб.', 'success');
        });
    }
}


// =====================================================================
// ========== ИНФОРМАЦИЯ О БЛЮДЕ =======================================
// =====================================================================

function showMenuItemInfo(menuId) {
    var allMenu  = Database.getMenu();
    var menuItem = allMenu.find(function (item) { return item.id === menuId; });
    if (!menuItem) return;
    var modal   = document.getElementById('menu-info-modal');
    var title   = document.getElementById('info-modal-title');
    var content = document.getElementById('info-modal-content');
    if (!modal || !title || !content) return;
    title.textContent = menuItem.name;
    var allergensList = '';
    if (menuItem.allergens && menuItem.allergens.length > 0) {
        allergensList = menuItem.allergens.map(function (a) {
            return '<span class="badge badge-warning" style="margin-right:4px;">' + a + '</span>';
        }).join('');
    } else {
        allergensList = '<span class="badge badge-success">Без аллергенов</span>';
    }
    content.innerHTML =
        '<p style="color:#666; margin-bottom:15px;">' + menuItem.description + '</p>' +
        '<div class="info-grid">' +
            '<div class="info-item"><div class="label">Тип</div><div class="value">' + (menuItem.type === 'breakfast' ? '🌅 Завтрак' : '🍽️ Обед') + '</div></div>' +
            '<div class="info-item"><div class="label">Цена</div><div class="value">' + menuItem.price + ' руб.</div></div>' +
            '<div class="info-item"><div class="label">Калории</div><div class="value">' + menuItem.calories + ' ккал</div></div>' +
            '<div class="info-item"><div class="label">Дата</div><div class="value">' + (menuItem.date || '—') + '</div></div>' +
        '</div>' +
        '<div style="margin-top:15px;"><div style="font-size:13px; color:#666; margin-bottom:6px;">Аллергены:</div>' + allergensList + '</div>' +
        '<button class="btn btn-primary" id="modal-order-btn" style="width:100%; margin-top:20px;"><i class="fas fa-shopping-cart"></i> Заказать за ' + menuItem.price + ' руб.</button>';
    document.getElementById('modal-order-btn').addEventListener('click', function () {
        modal.classList.remove('active');
        orderMenuItem(menuItem.id);
    });
    modal.classList.add('active');
    modal.querySelectorAll('.modal-close').forEach(function (btn) {
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function () { modal.classList.remove('active'); });
    });
}


// =====================================================================
// ========== ОТЗЫВЫ — ХРАНИЛИЩЕ =======================================
// =====================================================================

function getStoredReviews() {
    if (typeof Database !== 'undefined' && typeof Database.getReviews === 'function') {
        return Database.getReviews() || [];
    }
    try { return JSON.parse(localStorage.getItem('student_reviews')) || []; }
    catch (e) { return []; }
}

function storeReview(review) {
    review.id = Date.now();
    review.date = new Date().toISOString();
    if (typeof Database !== 'undefined' && typeof Database.addReview === 'function') {
        Database.addReview(review);
        return review;
    }
    var reviews = getStoredReviews();
    reviews.push(review);
    localStorage.setItem('student_reviews', JSON.stringify(reviews));
    return review;
}

function deleteStoredReview(reviewId) {
    if (typeof Database !== 'undefined' && typeof Database.deleteReview === 'function') {
        Database.deleteReview(reviewId);
        return;
    }
    var reviews = getStoredReviews();
    reviews = reviews.filter(function (r) { return r.id !== reviewId; });
    localStorage.setItem('student_reviews', JSON.stringify(reviews));
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}


// =====================================================================
// ========== ОТЗЫВЫ — ЗАГРУЗКА ========================================
// =====================================================================

function loadUserReviews(userId) {
    var container = document.getElementById('reviews-page');
    if (!container) return;
    injectReviewModalStyles();
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var allReviews  = getStoredReviews();
    var userReviews = allReviews.filter(function (r) { return r.userId === userId; });
    var html = '';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">';
    html += '  <div><h3 style="margin:0 0 2px; font-size:18px; font-weight:700; color:#1e293b;">Мои отзывы</h3>';
    html += '  <p style="margin:0; font-size:13px; color:#94a3b8;">Всего отзывов: ' + userReviews.length + '</p></div>';
    html += '  <button class="btn btn-primary" id="add-review-btn"><i class="fas fa-plus"></i> Оставить отзыв</button>';
    html += '</div>';
    if (userReviews.length === 0) {
        html += '<div style="text-align:center; padding:60px 20px;">';
        html += '  <div style="font-size:56px; margin-bottom:16px; opacity:0.25;">📝</div>';
        html += '  <p style="font-size:16px; color:#64748b;">У вас ещё нет отзывов</p>';
        html += '  <p style="font-size:13px; color:#94a3b8;">Нажмите «Оставить отзыв», чтобы поделиться мнением</p>';
        html += '</div>';
    } else {
        html += '<div class="reviews-list-container">';
        userReviews.slice().reverse().forEach(function (review) {
            var starsHtml = '';
            for (var i = 1; i <= 5; i++) {
                starsHtml += '<span style="color:' + (i <= review.rating ? '#f59e0b' : '#d1d5db') + '; font-size:16px;">★</span>';
            }
            var date = new Date(review.date);
            var formattedDate = date.toLocaleDateString('ru-RU') + ' в ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            html += '<div class="review-card" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; margin-bottom:12px;">';
            html += '  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">';
            html += '    <div style="flex:1;"><div style="font-weight:600; font-size:15px; color:#1e293b;">' + escapeHtml(review.dishName) + '</div>';
            html += '    <div style="margin-top:4px; line-height:1;">' + starsHtml + '</div></div>';
            html += '    <button class="delete-review-btn" data-review-id="' + review.id + '" style="background:none; border:1px solid #fecaca; border-radius:6px; color:#ef4444; cursor:pointer; padding:4px 8px; font-size:12px;"><i class="fas fa-trash-alt"></i></button>';
            html += '  </div>';
            html += '  <p style="color:#475569; font-size:14px; margin:12px 0 0; line-height:1.6;">' + escapeHtml(review.text) + '</p>';
            html += '  <div style="font-size:12px; color:#94a3b8; margin-top:12px;"><i class="fas fa-clock" style="margin-right:4px;"></i>' + formattedDate + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }
    container.innerHTML = html;
    var addBtn = document.getElementById('add-review-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function () { showReviewModal(userId); });
    }
    container.querySelectorAll('.delete-review-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var reviewId = parseInt(this.getAttribute('data-review-id'));
            if (confirm('Удалить этот отзыв?')) {
                deleteStoredReview(reviewId);
                showNotification('Отзыв удалён', 'info');
                loadUserReviews(userId);
            }
        });
    });
}


// =====================================================================
// ========== ОТЗЫВЫ — МОДАЛЬНОЕ ОКНО ==================================
// =====================================================================

function showReviewModal(userId) {
    if (document.querySelector('.review-modal-overlay')) return;
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;
    var menu = [];
    try { menu = Database.getMenu() || []; } catch (e) {}
    var uniqueDishes = [], addedNames = [];
    menu.forEach(function (item) {
        if (addedNames.indexOf(item.name) === -1) {
            uniqueDishes.push(item);
            addedNames.push(item.name);
        }
    });
    var overlay = document.createElement('div');
    overlay.className = 'review-modal-overlay';
    var modal = document.createElement('div');
    modal.className = 'review-modal-box';
    var header = document.createElement('div');
    header.className = 'review-modal-header';
    header.innerHTML = '<h3 style="margin:0; font-size:18px; font-weight:700; color:#1e293b;"><i class="fas fa-star" style="color:#f59e0b; margin-right:8px;"></i>Новый отзыв</h3><button class="review-modal-close-btn" title="Закрыть">&times;</button>';
    var body = document.createElement('div');
    body.style.cssText = 'padding:24px;';
    var dishGroup = document.createElement('div');
    dishGroup.style.marginBottom = '20px';
    dishGroup.innerHTML = '<label class="review-label">Блюдо</label>';
    var select = document.createElement('select');
    select.id = 'review-dish-select';
    select.className = 'review-input';
    var placeholderOpt = document.createElement('option');
    placeholderOpt.value = ''; placeholderOpt.disabled = true; placeholderOpt.selected = true;
    placeholderOpt.textContent = 'Выберите блюдо…';
    select.appendChild(placeholderOpt);
    uniqueDishes.forEach(function (dish) {
        var opt = document.createElement('option');
        opt.value = dish.id; opt.textContent = dish.name;
        select.appendChild(opt);
    });
    dishGroup.appendChild(select);
    var ratingGroup = document.createElement('div');
    ratingGroup.style.marginBottom = '20px';
    ratingGroup.innerHTML = '<label class="review-label">Оценка</label>';
    var starsContainer = document.createElement('div');
    starsContainer.style.cssText = 'display:flex; gap:6px;';
    var ratingValue = 0;
    for (var s = 1; s <= 5; s++) {
        var starSpan = document.createElement('span');
        starSpan.className = 'review-star-btn';
        starSpan.setAttribute('data-value', s);
        starSpan.textContent = '★';
        starsContainer.appendChild(starSpan);
    }
    ratingGroup.appendChild(starsContainer);
    var textGroup = document.createElement('div');
    textGroup.style.marginBottom = '20px';
    textGroup.innerHTML = '<label class="review-label">Ваш отзыв</label>';
    var textarea = document.createElement('textarea');
    textarea.id = 'review-text-input'; textarea.className = 'review-input';
    textarea.rows = 4; textarea.placeholder = 'Напишите, что думаете о блюде…';
    textarea.style.resize = 'vertical'; textarea.style.fontFamily = 'inherit';
    textGroup.appendChild(textarea);
    var errorDiv = document.createElement('div');
    errorDiv.id = 'review-form-error'; errorDiv.className = 'review-form-error';
    body.appendChild(dishGroup); body.appendChild(ratingGroup);
    body.appendChild(textGroup); body.appendChild(errorDiv);
    var footer = document.createElement('div');
    footer.className = 'review-modal-footer';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'review-btn-cancel'; cancelBtn.textContent = 'Отмена';
    var submitBtn = document.createElement('button');
    submitBtn.className = 'review-btn-submit';
    submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px;"></i>Отправить';
    footer.appendChild(cancelBtn); footer.appendChild(submitBtn);
    modal.appendChild(header); modal.appendChild(body); modal.appendChild(footer);
    overlay.appendChild(modal); document.body.appendChild(overlay);
    function closeModal() {
        overlay.style.opacity = '0'; overlay.style.transition = 'opacity .15s ease';
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 150);
        document.removeEventListener('keydown', escHandler);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    header.querySelector('.review-modal-close-btn').addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    function escHandler(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', escHandler);
    var starBtns = starsContainer.querySelectorAll('.review-star-btn');
    function highlightStars(count) {
        starBtns.forEach(function (star) {
            var v = parseInt(star.getAttribute('data-value'));
            star.style.color = v <= count ? '#f59e0b' : '#d1d5db';
            star.style.transform = v <= count ? 'scale(1.15)' : 'scale(1)';
        });
    }
    starBtns.forEach(function (star) {
        star.addEventListener('mouseenter', function () { highlightStars(parseInt(this.getAttribute('data-value'))); });
        star.addEventListener('mouseleave', function () { highlightStars(ratingValue); });
        star.addEventListener('click', function () { ratingValue = parseInt(this.getAttribute('data-value')); highlightStars(ratingValue); });
    });
    submitBtn.addEventListener('click', function () {
        var dishId = select.value, text = textarea.value.trim();
        if (!dishId) { showFormError('Выберите блюдо'); return; }
        if (ratingValue === 0) { showFormError('Поставьте оценку'); return; }
        if (!text || text.length < 3) { showFormError('Напишите отзыв (минимум 3 символа)'); return; }
        var selectedDish = uniqueDishes.find(function (d) { return d.id == dishId; });
        var dishName = selectedDish ? selectedDish.name : 'Неизвестное блюдо';
        storeReview({ userId: userId, userName: user.name, dishId: parseInt(dishId), dishName: dishName, rating: ratingValue, text: text });
        closeModal();
        showNotification('Отзыв на «' + dishName + '» сохранён!', 'success');
        loadUserReviews(userId);
    });
    function showFormError(msg) {
        errorDiv.textContent = msg; errorDiv.style.display = 'block';
        setTimeout(function () { errorDiv.style.display = 'none'; }, 3500);
    }
}


// =====================================================================
// ========== ОТЗЫВЫ — CSS =============================================
// =====================================================================

function injectReviewModalStyles() {
    if (document.getElementById('review-modal-injected-styles')) return;
    var style = document.createElement('style');
    style.id = 'review-modal-injected-styles';
    style.textContent =
        '@keyframes rvFadeIn{from{opacity:0}to{opacity:1}}' +
        '@keyframes rvSlideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}' +
        '.review-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10000;animation:rvFadeIn .2s ease}' +
        '.review-modal-box{background:#fff;border-radius:16px;width:95%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:rvSlideUp .25s ease}' +
        '.review-modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e2e8f0}' +
        '.review-modal-close-btn{background:none;border:none;font-size:28px;color:#94a3b8;cursor:pointer;padding:0;line-height:1;transition:color .2s}' +
        '.review-modal-close-btn:hover{color:#334155}' +
        '.review-modal-footer{padding:16px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:12px}' +
        '.review-label{display:block;font-size:14px;font-weight:600;color:#475569;margin-bottom:6px}' +
        '.review-input{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;color:#1e293b;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box}' +
        '.review-input:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(129,140,248,.25)}' +
        '.review-star-btn{font-size:32px;color:#d1d5db;cursor:pointer;transition:color .15s,transform .15s;user-select:none}' +
        '.review-star-btn:hover{transform:scale(1.2)!important}' +
        '.review-form-error{display:none;color:#dc2626;font-size:13px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px}' +
        '.review-btn-cancel{padding:10px 20px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;font-size:14px;cursor:pointer;transition:all .2s}' +
        '.review-btn-cancel:hover{background:#f1f5f9}' +
        '.review-btn-submit{padding:10px 24px;border:none;border-radius:8px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}' +
        '.review-btn-submit:hover{background:#4338ca}' +
        '.review-btn-submit:active{transform:scale(.97)}';
    document.head.appendChild(style);
}


// =====================================================================
// ========== ПРОФИЛЬ ==================================================
// =====================================================================

function loadUserProfile(userId) {
    // Профиль подгружается через updateUserInfo()
}


// =========================================================================
// =========================================================================
//
//     █████╗ ██████╗  ██████╗ ███╗   ██╗██████╗ ███╗   ███╗███████╗███╗   ██╗████████╗██╗   ██╗
//    ██╔══██╗██╔══██╗██╔═══██╗████╗  ██║██╔══██╗████╗ ████║██╔════╝████╗  ██║╚══██╔══╝╚██╗ ██╔╝
//    ███████║██████╔╝██║   ██║██╔██╗ ██║██████╔╝██╔████╔██║█████╗  ██╔██╗ ██║   ██║    ╚████╔╝
//    ██╔══██║██╔══██╗██║   ██║██║╚██╗██║██╔══██╗██║╚██╔╝██║██╔══╝  ██║╚██╗██║   ██║     ╚██╔╝
//    ██║  ██║██████╔╝╚██████╔╝██║ ╚████║██████╔╝██║ ╚═╝ ██║███████╗██║ ╚████║   ██║      ██║
//    ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝      ╚═╝
//
//    МОДУЛЬ АБОНЕМЕНТОВ — Полная реализация
//
// =========================================================================
// =========================================================================


// =====================================================================
// ========== АБОНЕМЕНТЫ — ХРАНИЛИЩЕ (localStorage) ====================
// =====================================================================

function subGetActive(userId) {
    try {
        return JSON.parse(localStorage.getItem('sub_active_' + userId)) || [];
    } catch (e) { return []; }
}

function subSaveActive(userId, data) {
    try {
        localStorage.setItem('sub_active_' + userId, JSON.stringify(data));
    } catch (e) {}
}

function subGetHistory(userId) {
    try {
        return JSON.parse(localStorage.getItem('sub_history_' + userId)) || [];
    } catch (e) { return []; }
}

function subSaveHistory(userId, data) {
    try {
        localStorage.setItem('sub_history_' + userId, JSON.stringify(data));
    } catch (e) {}
}

function subAddHistoryEntry(userId, entry) {
    var history = subGetHistory(userId);
    entry.id = Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    entry.date = new Date().toISOString();
    history.unshift(entry);
    subSaveHistory(userId, history);
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — УТИЛИТЫ =====================================
// =====================================================================

function subFormatPrice(n) {
    if (n === undefined || n === null) n = 0;
    return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function subFormatDate(dateStr) {
    var d = new Date(dateStr);
    return ('0' + d.getDate()).slice(-2) + '.' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '.' +
           d.getFullYear();
}

function subDateStr(d) {
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
}

function subGetDiscount(sub, days) {
    var disc = 0;
    if (!sub.discounts) return 0;
    var keys = Object.keys(sub.discounts);
    for (var i = 0; i < keys.length; i++) {
        if (days >= parseInt(keys[i], 10)) {
            disc = sub.discounts[keys[i]];
        }
    }
    return disc;
}

function subFindCatalogItem(id) {
    for (var i = 0; i < SUB_CATALOG.length; i++) {
        if (SUB_CATALOG[i].id === id) return SUB_CATALOG[i];
    }
    return null;
}

function subUid() {
    return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ГЛАВНАЯ ФУНКЦИЯ ЗАГРУЗКИ ====================
// =====================================================================

function loadUserSubscriptions(userId) {
    var container = document.getElementById('subscriptions-page');
    if (!container) return;

    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;

    var balance      = parseFloat(user.balance) || 0;
    var activeSubs   = subGetActive(userId);
    var history      = subGetHistory(userId);

    // ── Собираем весь HTML страницы ──
    var html = '';

    // ═══════ ВЕРХНЯЯ ПАНЕЛЬ: БАЛАНС + КОРЗИНА ═══════
    html += '<div class="sub-top-panel">';
    html += '  <div class="sub-balance-block">';
    html += '    <div class="sub-balance-icon-wrap">💰</div>';
    html += '    <div class="sub-balance-data">';
    html += '      <span class="sub-balance-label"></span>';
    html += '      <span class="sub-balance-sum" id="sub-balance-display">' + subFormatPrice(balance) + '</span>';
    html += '    </div>';
    html += '    <button class="sub-btn sub-btn-glass sub-btn-sm" onclick="showPaymentModal()">+ Пополнить</button>';
    html += '  </div>';
    html += '  <button class="sub-btn sub-btn-cart" onclick="subToggleCartModal()">';
    html += '    🛒 Корзина';
    html += '    <span class="sub-cart-count ' + (subCart.length === 0 ? 'hidden' : '') + '" id="sub-cart-count">' + subCart.length + '</span>';
    html += '  </button>';
    html += '</div>';

    // ═══════ БЛОК 1: КАТАЛОГ АБОНЕМЕНТОВ ═══════
    html += '<div class="card sub-section">';
    html += '  <div class="card-header sub-section-header">';
    html += '    <h3 class="card-title sub-section-title">🎫 Абонементы на питание</h3>';
    html += '  </div>';

    // Баннер
    html += '  <div class="sub-banner">';
    html += '    <div class="sub-banner-glow"></div>';
    html += '    <span class="sub-banner-icon">⭐</span>';
    html += '    <div class="sub-banner-body">';
    html += '      <strong>Экономьте до 20% с абонементами!</strong>';
    html += '      <span>Чем больше дней — тем выше скидка. Абонементы действуют в течение календарного месяца.</span>';
    html += '    </div>';
    html += '  </div>';

    // Фильтры
    html += '  <div class="sub-filters" id="sub-filters">';
    var filters = [
        { key: 'all',       label: 'Все',         icon: '📋' },
        { key: 'breakfast', label: 'Завтраки',    icon: '🌅' },
        { key: 'lunch',     label: 'Обеды',       icon: '🍲' },
        { key: 'complex',   label: 'Комплексные', icon: '⭐' },
        { key: 'snack',     label: 'Полдники',    icon: '🍎' }
    ];
    for (var fi = 0; fi < filters.length; fi++) {
        var f = filters[fi];
        var fActive = f.key === subCurrentFilter ? ' active' : '';
        html += '<button class="sub-chip' + fActive + '" data-filter="' + f.key + '" onclick="subSetFilter(\'' + f.key + '\')">' + f.icon + ' ' + f.label + '</button>';
    }
    html += '  </div>';

    // Каталог
    html += '  <div class="subscription-plans" id="subscription-plans">';
    html += subBuildCatalogHtml();
    html += '  </div>';
    html += '</div>';

    // ═══════ БЛОК 2: АКТИВНЫЕ АБОНЕМЕНТЫ ═══════
    html += '<div class="card sub-section">';
    html += '  <div class="card-header sub-section-header">';
    html += '    <h3 class="card-title sub-section-title">✅ Мои активные абонементы</h3>';
    html += '  </div>';
    html += '  <div id="sub-active-cards" style="padding:16px 20px 6px;">';
    html += subBuildActiveCardsHtml(activeSubs);
    html += '  </div>';

    // Таблица активных
    html += '  <div class="table-responsive" style="padding:0 20px 20px;">';
    html += '    <table class="table" id="subscriptions-table">';
    html += '      <thead><tr>';
    html += '        <th>Тип</th><th>Дата начала</th><th>Дата окончания</th><th>Осталось</th><th>Прогресс</th><th>Статус</th>';
    html += '      </tr></thead>';
    html += '      <tbody id="sub-table-body">';
    html += subBuildActiveTableHtml(activeSubs);
    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '</div>';

    // ═══════ БЛОК 3: ИСТОРИЯ ═══════
    html += '<div class="card sub-section">';
    html += '  <div class="card-header sub-section-header">';
    html += '    <h3 class="card-title sub-section-title">📋 История операций</h3>';
    html += '  </div>';
    html += '  <div class="table-responsive" style="padding:0 20px 20px;">';
    html += '    <table class="table">';
    html += '      <thead><tr><th>Дата</th><th>Операция</th><th>Сумма</th><th>Статус</th></tr></thead>';
    html += '      <tbody id="sub-history-body">';
    html += subBuildHistoryHtml(history);
    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '</div>';

    container.innerHTML = html;
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — СБОРКА HTML КАТАЛОГА ========================
// =====================================================================

function subBuildCatalogHtml() {
    var items = subCurrentFilter === 'all'
        ? SUB_CATALOG
        : SUB_CATALOG.filter(function (s) { return s.type === subCurrentFilter; });

    if (items.length === 0) {
        return '<div class="sub-empty-state" style="grid-column:1/-1">' +
               '  <div style="font-size:56px; margin-bottom:12px; opacity:0.3;">🔍</div>' +
               '  <h4>Абонементы не найдены</h4>' +
               '  <p>В этой категории пока нет доступных абонементов</p>' +
               '</div>';
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
        html += subBuildCardHtml(items[i]);
    }
    return html;
}

function subBuildCardHtml(sub) {
    var days = subSelectedDays[sub.id] || sub.daysOptions[0];
    var disc = subGetDiscount(sub, days);
    var orig = sub.pricePerDay * days;
    var final_ = Math.round(orig * (1 - disc / 100));

    var badge = sub.badge
        ? '<div class="sub-card-badge">' + sub.badge + '</div>'
        : '';

    var feats = '';
    for (var i = 0; i < sub.features.length; i++) {
        feats += '<li><span style="color:#7C3AED; font-weight:700; margin-right:6px;">✓</span>' + sub.features[i] + '</li>';
    }

    var daysHtml = '';
    for (var j = 0; j < sub.daysOptions.length; j++) {
        var d = sub.daysOptions[j];
        var dDisc = subGetDiscount(sub, d);
        var sel = d === days ? ' picked' : '';
        var discLabel = dDisc > 0 ? '<span class="sub-day-disc">−' + dDisc + '%</span>' : '';
        daysHtml += '<button class="sub-day-btn' + sel + '" onclick="subPickDays(\'' + sub.id + '\',' + d + ')">' +
                    d + ' дн.' + discLabel + '</button>';
    }

    var oldHtml = disc > 0 ? '<span class="sub-price-old">' + subFormatPrice(orig) + '</span>' : '';

    return '<div class="sub-card' + (sub.popular ? ' is-popular' : '') + '" id="sc-' + sub.id + '">' +
        badge +
        '<div class="sub-card-top">' +
            '<div class="sub-card-emoji ' + sub.cssType + '">' + sub.icon + '</div>' +
            '<div>' +
                '<div class="sub-card-name">' + sub.name + '</div>' +
                '<div class="sub-card-desc">' + sub.desc + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="sub-card-mid">' +
            '<ul class="sub-card-feats">' + feats + '</ul>' +
            '<span class="sub-days-title">📅 Количество дней</span>' +
            '<div class="sub-days-wrap">' + daysHtml + '</div>' +
        '</div>' +
        '<div class="sub-card-bot">' +
            '<div class="sub-price-col">' +
                '<span class="sub-price-lbl">Стоимость</span>' +
                oldHtml +
                '<span class="sub-price-cur">' + subFormatPrice(final_) + '</span>' +
            '</div>' +
            '<button class="sub-btn sub-btn-primary" id="ab-' + sub.id + '" onclick="subAddToCart(\'' + sub.id + '\')">' +
                '🛒 В корзину' +
            '</button>' +
        '</div>' +
    '</div>';
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — АКТИВНЫЕ КАРТОЧКИ ===========================
// =====================================================================

function subBuildActiveCardsHtml(activeSubs) {
    if (activeSubs.length === 0) {
        return '<div class="sub-empty-state">' +
               '  <div style="font-size:48px; margin-bottom:12px; opacity:0.3;">📭</div>' +
               '  <h4>Нет активных абонементов</h4>' +
               '  <p>Выберите и оплатите абонемент из каталога выше</p>' +
               '</div>';
    }

    var html = '';
    for (var i = 0; i < activeSubs.length; i++) {
        var s = activeSubs[i];
        var pct = Math.round((s.usedDays / s.totalDays) * 100);
        var left = s.totalDays - s.usedDays;
        var isExpiring = left <= 3;
        var tagCls = isExpiring ? 'sub-tag-warn' : 'sub-tag-ok';
        var tagTxt = isExpiring ? '⚠ Заканчивается' : '✓ Активен';

        html += '<div class="sub-active-row">' +
            '<div class="sub-active-ava">' + s.icon + '</div>' +
            '<div class="sub-active-meta">' +
                '<div class="sub-active-name">' + s.name + '</div>' +
                '<div class="sub-active-range">' + subFormatDate(s.startDate) + ' — ' + subFormatDate(s.endDate) + '</div>' +
            '</div>' +
            '<div class="sub-active-bar-wrap">' +
                '<div class="sub-bar-track"><div class="sub-bar-fill" style="width:' + pct + '%"></div></div>' +
                '<div class="sub-bar-text">Использовано ' + s.usedDays + ' из ' + s.totalDays + ' · осталось ' + left + '</div>' +
            '</div>' +
            '<span class="sub-tag ' + tagCls + '">' + tagTxt + '</span>' +
        '</div>';
    }
    return html;
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ТАБЛИЦА АКТИВНЫХ ============================
// =====================================================================

function subBuildActiveTableHtml(activeSubs) {
    if (activeSubs.length === 0) {
        return '<tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">Нет активных абонементов</td></tr>';
    }

    var html = '';
    for (var i = 0; i < activeSubs.length; i++) {
        var s = activeSubs[i];
        var left = s.totalDays - s.usedDays;
        var pct = Math.round((s.usedDays / s.totalDays) * 100);
        var isExpiring = left <= 3;
        var stCls = isExpiring ? 'sub-st-end' : 'sub-st-on';
        var stTxt = isExpiring ? 'Заканчивается' : 'Активен';

        html += '<tr>' +
            '<td>' + s.icon + ' ' + s.name + '</td>' +
            '<td>' + subFormatDate(s.startDate) + '</td>' +
            '<td>' + subFormatDate(s.endDate) + '</td>' +
            '<td>' + left + ' из ' + s.totalDays + '</td>' +
            '<td><div class="sub-tprog">' +
                '<div class="sub-tprog-bar"><div class="sub-tprog-fill" style="width:' + pct + '%"></div></div>' +
                '<span class="sub-tprog-num">' + pct + '%</span>' +
            '</div></td>' +
            '<td><span class="sub-st ' + stCls + '">' + stTxt + '</span></td>' +
        '</tr>';
    }
    return html;
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ТАБЛИЦА ИСТОРИИ =============================
// =====================================================================

function subBuildHistoryHtml(history) {
    if (history.length === 0) {
        return '<tr><td colspan="4" style="text-align:center; padding:24px; color:#94a3b8;">История операций пуста</td></tr>';
    }

    var html = '';
    for (var i = 0; i < history.length; i++) {
        var h = history[i];
        var isTopup = h.type === 'topup';
        var sign = isTopup ? '+' : '−';
        var clr = isTopup ? 'color:#10B981' : 'color:#334155';
        var icon = isTopup ? '💰' : '🎫';
        var stCls = h.status === 'completed' ? 'sub-st-ok' : h.status === 'active' ? 'sub-st-on' : 'sub-st-end';
        var stTxt = h.status === 'completed' ? 'Выполнено' : h.status === 'active' ? 'Активен' : 'Истёк';

        html += '<tr>' +
            '<td>' + subFormatDate(h.date) + '</td>' +
            '<td>' + icon + ' ' + h.name + '</td>' +
            '<td style="font-weight:700;' + clr + '">' + sign + subFormatPrice(h.amount) + '</td>' +
            '<td><span class="sub-st ' + stCls + '">' + stTxt + '</span></td>' +
        '</tr>';
    }
    return html;
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ФИЛЬТРАЦИЯ ==================================
// =====================================================================

function subSetFilter(type) {
    subCurrentFilter = type;
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user) loadUserSubscriptions(user.id);
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ВЫБОР ДНЕЙ ==================================
// =====================================================================

function subPickDays(subId, days) {
    subSelectedDays[subId] = days;
    // Перерендерим только каталог
    var grid = document.getElementById('subscription-plans');
    if (grid) {
        grid.innerHTML = subBuildCatalogHtml();
    }
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — КОРЗИНА =====================================
// =====================================================================

function subAddToCart(subId) {
    var sub = subFindCatalogItem(subId);
    if (!sub) return;

    var days = subSelectedDays[subId] || sub.daysOptions[0];
    var disc = subGetDiscount(sub, days);
    var orig = sub.pricePerDay * days;
    var fin  = Math.round(orig * (1 - disc / 100));

    // Проверяем дубликат
    var existIdx = -1;
    for (var i = 0; i < subCart.length; i++) {
        if (subCart[i].subId === subId) { existIdx = i; break; }
    }

    if (existIdx !== -1) {
        subCart[existIdx].days = days;
        subCart[existIdx].price = fin;
        subCart[existIdx].discount = disc;
        showNotification('«' + sub.name + '» обновлён в корзине', 'info');
    } else {
        subCart.push({
            subId: subId,
            name: sub.name,
            icon: sub.icon,
            cssType: sub.cssType,
            type: sub.type,
            days: days,
            price: fin,
            pricePerDay: sub.pricePerDay,
            discount: disc
        });
        showNotification('«' + sub.name + '» (' + days + ' дн.) добавлен в корзину!', 'success');
    }

    // Анимация кнопки
    var btn = document.getElementById('ab-' + subId);
    if (btn) {
        var oldHtml = btn.innerHTML;
        btn.innerHTML = '✅ Добавлено!';
        btn.disabled = true;
        setTimeout(function () {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }, 1200);
    }

    subUpdateCartCount();
}

function subRemoveFromCart(index) {
    var removed = subCart.splice(index, 1)[0];
    if (removed) {
        showNotification('«' + removed.name + '» удалён из корзины', 'info');
    }
    subUpdateCartCount();
    subRenderCartModalContent();
}

function subUpdateCartCount() {
    var badge = document.getElementById('sub-cart-count');
    if (!badge) return;
    badge.textContent = subCart.length;
    if (subCart.length > 0) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — МОДАЛЬНОЕ ОКНО КОРЗИНЫ ======================
// =====================================================================

function subToggleCartModal() {
    var existing = document.querySelector('.sub-overlay');
    if (existing) {
        existing.style.opacity = '0';
        existing.style.transition = 'opacity .15s';
        setTimeout(function () { if (existing.parentNode) existing.parentNode.removeChild(existing); }, 150);
        document.body.style.overflow = '';
        return;
    }

    // Создаём модальное окно
    var overlay = document.createElement('div');
    overlay.className = 'sub-overlay open';

    var modal = document.createElement('div');
    modal.className = 'sub-modal';

    // Шапка
    modal.innerHTML =
        '<div class="sub-modal-head">' +
            '<h3>🛒 Корзина</h3>' +
            '<button class="sub-modal-x" onclick="subToggleCartModal()">✕</button>' +
        '</div>' +
        '<div class="sub-modal-content" id="sub-cart-body"></div>' +
        '<div class="sub-modal-bottom" id="sub-cart-footer" style="display:none;">' +
            '<div class="sub-cart-total-row">' +
                '<span>Итого:</span>' +
                '<span class="sub-cart-total-num" id="sub-cart-total">0 ₽</span>' +
            '</div>' +
            '<button class="sub-btn sub-btn-primary sub-btn-block" onclick="subCheckout()">💳 Оплатить с баланса</button>' +
        '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Закрытие по клику на оверлей
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) subToggleCartModal();
    });

    // Закрытие по Escape
    var escFn = function (e) {
        if (e.key === 'Escape') {
            subToggleCartModal();
            document.removeEventListener('keydown', escFn);
        }
    };
    document.addEventListener('keydown', escFn);

    subRenderCartModalContent();
}

function subRenderCartModalContent() {
    var body = document.getElementById('sub-cart-body');
    var foot = document.getElementById('sub-cart-footer');
    if (!body || !foot) return;

    if (subCart.length === 0) {
        body.innerHTML =
            '<div class="sub-cart-empty">' +
                '<div style="font-size:48px; margin-bottom:10px; opacity:0.35;">🛒</div>' +
                '<h4 style="margin:0 0 4px;">Корзина пуста</h4>' +
                '<p style="font-size:13px; color:#94a3b8;">Добавьте абонемент из каталога</p>' +
            '</div>';
        foot.style.display = 'none';
        return;
    }

    var total = 0;
    var html = '';
    for (var i = 0; i < subCart.length; i++) {
        var it = subCart[i];
        total += it.price;
        var discTxt = it.discount > 0 ? ' · скидка ' + it.discount + '%' : '';
        html += '<div class="sub-ci">' +
            '<div class="sub-ci-icon ' + it.cssType + '">' + it.icon + '</div>' +
            '<div class="sub-ci-info">' +
                '<div class="sub-ci-name">' + it.name + '</div>' +
                '<div class="sub-ci-det">' + it.days + ' дней' + discTxt + '</div>' +
            '</div>' +
            '<div class="sub-ci-price">' + subFormatPrice(it.price) + '</div>' +
            '<button class="sub-ci-del" onclick="subRemoveFromCart(' + i + ')" title="Удалить">🗑️</button>' +
        '</div>';
    }

    body.innerHTML = html;
    foot.style.display = 'block';
    document.getElementById('sub-cart-total').textContent = subFormatPrice(total);
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — ОПЛАТА ======================================
// =====================================================================

function subCheckout() {
    var user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user) return;

    if (subCart.length === 0) {
        showNotification('Корзина пуста', 'warning');
        return;
    }

    var total = 0;
    for (var i = 0; i < subCart.length; i++) {
        total += subCart[i].price;
    }

    var balance = parseFloat(user.balance) || 0;

    if (total > balance) {
        var diff = total - balance;
        showNotification('Недостаточно средств. Не хватает ' + subFormatPrice(diff), 'error');

        // Анимация «тряски» суммы
        var totalEl = document.getElementById('sub-cart-total');
        if (totalEl) {
            totalEl.parentElement.classList.add('sub-shaking');
            setTimeout(function () { totalEl.parentElement.classList.remove('sub-shaking'); }, 500);
        }
        return;
    }

    // ── Списание баланса ──
    var newBalance = balance - total;
    Database.updateUser(user.id, { balance: newBalance });
    user.balance = newBalance;
    sessionStorage.setItem('currentUser', JSON.stringify(user));

    // ── Создаём активные абонементы и историю ──
    var activeSubs = subGetActive(user.id);
    var now = new Date();
    var endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 30);
    var nowStr = subDateStr(now);
    var endStr = subDateStr(endDate);

    for (var j = 0; j < subCart.length; j++) {
        var item = subCart[j];

        // Новый активный абонемент
        activeSubs.push({
            id: subUid(),
            name: item.name,
            icon: item.icon,
            type: item.type,
            startDate: nowStr,
            endDate: endStr,
            totalDays: item.days,
            usedDays: 0,
            status: 'active'
        });

        // Запись в историю
        subAddHistoryEntry(user.id, {
            name: item.name + ' (' + item.days + ' дн.)',
            amount: item.price,
            type: 'purchase',
            status: 'active'
        });
    }

    subSaveActive(user.id, activeSubs);

    // ── Очищаем корзину ──
    subCart = [];
    subUpdateCartCount();
    updateUserInfo();

    // ── Закрываем модальное окно ──
    subToggleCartModal();

    // ── Перерисовываем страницу ──
    loadUserSubscriptions(user.id);

    showNotification('Оплата прошла успешно! Списано ' + subFormatPrice(total), 'success');
}


// =====================================================================
// ========== АБОНЕМЕНТЫ — CSS =========================================
// =====================================================================

function injectSubscriptionStyles() {
    if (document.getElementById('sub-injected-styles')) return;
    var style = document.createElement('style');
    style.id = 'sub-injected-styles';
    style.textContent =

        /* Переменные */
        ':root{' +
            '--s-purple:#7C3AED;--s-purple-dark:#6D28D9;--s-purple-deeper:#5B21B6;' +
            '--s-purple-light:#EDE9FE;--s-purple-muted:#DDD6FE;' +
            '--s-blue:#3B82F6;--s-blue-dark:#2563EB;--s-blue-light:#DBEAFE;' +
            '--s-indigo:#6366F1;' +
            '--s-green:#10B981;--s-green-light:#D1FAE5;' +
            '--s-amber:#F59E0B;--s-amber-light:#FEF3C7;' +
            '--s-red:#EF4444;--s-red-light:#FEE2E2;' +
        '}' +

        /* Секция */
        '.sub-section{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:20px;background:#fff;box-shadow:0 4px 24px rgba(99,102,241,.1)}' +
        '.sub-section-header{background:linear-gradient(135deg,var(--s-purple) 0%,var(--s-blue) 100%);padding:16px 22px!important;border-bottom:none!important}' +
        '.sub-section-title{color:#fff!important;font-size:16px!important;font-weight:700!important;display:flex!important;align-items:center!important;gap:10px!important;margin:0!important}' +

        /* Верхняя панель */
        '.sub-top-panel{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}' +
        '.sub-balance-block{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,var(--s-purple) 0%,var(--s-indigo) 50%,var(--s-blue) 100%);color:#fff;padding:16px 24px;border-radius:14px;box-shadow:0 6px 30px rgba(124,58,237,.3);flex-wrap:wrap;position:relative;overflow:hidden}' +
        '.sub-balance-block::before{content:"";position:absolute;top:-50%;right:-30%;width:200px;height:200px;background:rgba(255,255,255,.06);border-radius:50%;pointer-events:none}' +
        '.sub-balance-icon-wrap{width:44px;height:44px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}' +
        '.sub-balance-data{display:flex;flex-direction:column;position:relative;z-index:1}' +
        '.sub-balance-label{font-size:11px;opacity:.8;text-transform:uppercase;letter-spacing:.8px;font-weight:600}' +
        '.sub-balance-sum{font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-.5px}' +

        /* Кнопки */
        '.sub-btn{padding:10px 20px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;gap:8px;font-family:inherit;line-height:1.2}' +
        '.sub-btn:active{transform:scale(.96)}' +
        '.sub-btn-sm{padding:8px 14px;font-size:13px}' +
        '.sub-btn-block{width:100%;justify-content:center;padding:14px;font-size:15px}' +
        '.sub-btn-primary{background:linear-gradient(135deg,var(--s-purple),var(--s-blue));color:#fff;box-shadow:0 4px 14px rgba(124,58,237,.35)}' +
        '.sub-btn-primary:hover{box-shadow:0 6px 20px rgba(124,58,237,.5);transform:translateY(-1px)}' +
        '.sub-btn-glass{background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(6px)}' +
        '.sub-btn-glass:hover{background:rgba(255,255,255,.28)}' +
        '.sub-btn-cart{background:#fff;color:var(--s-purple);border:2px solid var(--s-purple-muted);box-shadow:0 2px 10px rgba(124,58,237,.1);position:relative;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;gap:8px;font-family:inherit}' +
        '.sub-btn-cart:hover{border-color:var(--s-purple);background:var(--s-purple-light)}' +
        '.sub-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}' +

        /* Бейдж корзины */
        '.sub-cart-count{position:absolute;top:-8px;right:-8px;background:var(--s-red);color:#fff;min-width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff}' +
        '.sub-cart-count.hidden{display:none}' +

        /* Баннер */
        '.sub-banner{background:linear-gradient(135deg,var(--s-purple-light) 0%,var(--s-blue-light) 100%);border:1px solid var(--s-purple-muted);border-radius:10px;padding:16px 20px;margin:18px 20px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden;flex-wrap:wrap}' +
        '.sub-banner-glow{position:absolute;top:-40px;left:-40px;width:120px;height:120px;background:radial-gradient(circle,rgba(124,58,237,.12),transparent);pointer-events:none}' +
        '.sub-banner-icon{font-size:28px;flex-shrink:0;position:relative;z-index:1}' +
        '.sub-banner-body{font-size:13px;color:#334155;line-height:1.5;position:relative;z-index:1}' +
        '.sub-banner-body strong{display:block;font-size:14px;color:var(--s-purple-dark);margin-bottom:2px}' +

        /* Фильтры */
        '.sub-filters{display:flex;gap:8px;padding:0 20px 18px;flex-wrap:wrap}' +
        '.sub-chip{background:#f8fafc;border:2px solid #e2e8f0;padding:8px 16px;border-radius:50px;font-size:13px;font-weight:600;cursor:pointer;transition:all .25s;font-family:inherit;color:#64748b;display:inline-flex;align-items:center;gap:6px}' +
        '.sub-chip:hover{border-color:var(--s-purple-muted);background:var(--s-purple-light);color:var(--s-purple)}' +
        '.sub-chip.active{background:var(--s-purple);border-color:var(--s-purple);color:#fff;box-shadow:0 3px 12px rgba(124,58,237,.3)}' +

        /* Каталог */
        '.subscription-plans{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:0 20px 20px}' +

        /* Карточка */
        '.sub-card{background:#fff;border:2px solid #e2e8f0;border-radius:14px;overflow:hidden;transition:all .25s;position:relative}' +
        '.sub-card:hover{border-color:var(--s-purple-muted);box-shadow:0 12px 40px rgba(99,102,241,.18);transform:translateY(-3px)}' +
        '.sub-card.is-popular{border-color:var(--s-purple);box-shadow:0 4px 20px rgba(124,58,237,.15)}' +
        '.sub-card-badge{position:absolute;top:12px;right:12px;background:linear-gradient(135deg,var(--s-purple),var(--s-blue));color:#fff;padding:4px 12px;border-radius:50px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;z-index:2;animation:subPulse 2.5s infinite}' +
        '.sub-card-top{padding:18px 18px 10px;display:flex;align-items:flex-start;gap:12px}' +
        '.sub-card-emoji{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}' +
        '.t-breakfast{background:var(--s-purple-light)}' +
        '.t-lunch{background:var(--s-blue-light)}' +
        '.t-complex{background:linear-gradient(135deg,var(--s-purple-light),var(--s-blue-light))}' +
        '.t-snack{background:var(--s-amber-light)}' +
        '.sub-card-name{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:3px}' +
        '.sub-card-desc{font-size:12px;color:#64748b;line-height:1.4}' +
        '.sub-card-mid{padding:0 18px 14px}' +
        '.sub-card-feats{list-style:none;padding:0;margin:0 0 14px}' +
        '.sub-card-feats li{font-size:12px;color:#334155;padding:3px 0;display:flex;align-items:center;gap:4px}' +

        /* Дни */
        '.sub-days-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;display:block}' +
        '.sub-days-wrap{display:flex;gap:6px;flex-wrap:wrap}' +
        '.sub-day-btn{background:#f8fafc;border:2px solid #e2e8f0;padding:7px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:all .25s;text-align:center;min-width:52px;font-family:inherit;color:#334155}' +
        '.sub-day-btn:hover{border-color:var(--s-purple-muted);background:var(--s-purple-light)}' +
        '.sub-day-btn.picked{background:linear-gradient(135deg,var(--s-purple),var(--s-blue));border-color:var(--s-purple);color:#fff;box-shadow:0 3px 10px rgba(124,58,237,.3)}' +
        '.sub-day-disc{font-size:10px;opacity:.8;display:block;margin-top:1px}' +

        /* Футер карточки */
        '.sub-card-bot{padding:14px 18px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
        '.sub-price-col{display:flex;flex-direction:column}' +
        '.sub-price-lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:600}' +
        '.sub-price-old{font-size:13px;color:#94a3b8;text-decoration:line-through}' +
        '.sub-price-cur{font-size:22px;font-weight:800;color:var(--s-purple-dark);line-height:1.1}' +

        /* Активные */
        '.sub-active-row{background:linear-gradient(135deg,var(--s-purple-light) 0%,var(--s-blue-light) 100%);border:1px solid var(--s-purple-muted);border-radius:14px;padding:16px 18px;display:flex;align-items:center;gap:14px;margin-bottom:10px;transition:all .25s;flex-wrap:wrap}' +
        '.sub-active-row:hover{box-shadow:0 4px 24px rgba(99,102,241,.1)}' +
        '.sub-active-ava{width:46px;height:46px;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.06)}' +
        '.sub-active-meta{flex:1;min-width:140px}' +
        '.sub-active-name{font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px}' +
        '.sub-active-range{font-size:12px;color:#64748b}' +
        '.sub-active-bar-wrap{flex:1;min-width:140px}' +
        '.sub-bar-track{background:rgba(255,255,255,.6);border-radius:50px;height:8px;overflow:hidden;margin-bottom:4px}' +
        '.sub-bar-fill{height:100%;background:linear-gradient(90deg,var(--s-purple),var(--s-blue));border-radius:50px;transition:width 1s ease}' +
        '.sub-bar-text{font-size:11px;color:#64748b;font-weight:600}' +
        '.sub-tag{padding:5px 14px;border-radius:50px;font-size:11px;font-weight:700;white-space:nowrap}' +
        '.sub-tag-ok{background:var(--s-green);color:#fff}' +
        '.sub-tag-warn{background:var(--s-amber);color:#fff;animation:subPulse 2s infinite}' +

        /* Статусы таблицы */
        '.sub-st{padding:4px 12px;border-radius:50px;font-size:12px;font-weight:600;display:inline-block}' +
        '.sub-st-ok{background:var(--s-green-light);color:#047857}' +
        '.sub-st-on{background:var(--s-blue-light);color:#1D4ED8}' +
        '.sub-st-end{background:var(--s-amber-light);color:#B45309}' +

        /* Прогресс */
        '.sub-tprog{display:flex;align-items:center;gap:8px}' +
        '.sub-tprog-bar{flex:1;height:6px;background:#e2e8f0;border-radius:50px;overflow:hidden;min-width:50px}' +
        '.sub-tprog-fill{height:100%;background:linear-gradient(90deg,var(--s-purple),var(--s-blue));border-radius:50px;transition:width .8s ease}' +
        '.sub-tprog-num{font-size:12px;font-weight:600;color:#64748b;white-space:nowrap}' +

        /* Пустое */
        '.sub-empty-state{text-align:center;padding:50px 20px}' +
        '.sub-empty-state h4{font-size:16px;color:#334155;margin:0 0 4px}' +
        '.sub-empty-state p{color:#94a3b8;font-size:13px;margin:0}' +

        /* Модалки */
        '.sub-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(6px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:subFade .2s ease}' +
        '.sub-modal{background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(15,23,42,.25);animation:subSlide .3s ease}' +
        '.sub-modal-head{padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#fff;z-index:2;border-radius:14px 14px 0 0}' +
        '.sub-modal-head h3{font-size:17px;margin:0;color:#0f172a}' +
        '.sub-modal-x{background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;transition:all .25s;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:18px;font-family:inherit}' +
        '.sub-modal-x:hover{background:var(--s-red);color:#fff}' +
        '.sub-modal-content{padding:16px 20px}' +
        '.sub-modal-bottom{padding:16px 20px;border-top:1px solid #e2e8f0;background:#f8fafc;border-radius:0 0 14px 14px;position:sticky;bottom:0}' +

        /* Корзина */
        '.sub-ci{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9}' +
        '.sub-ci:last-child{border-bottom:none}' +
        '.sub-ci-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}' +
        '.sub-ci-info{flex:1}' +
        '.sub-ci-name{font-weight:600;font-size:13px;color:#0f172a}' +
        '.sub-ci-det{font-size:11px;color:#94a3b8}' +
        '.sub-ci-price{font-weight:700;font-size:15px;color:var(--s-purple-dark);white-space:nowrap}' +
        '.sub-ci-del{background:none;border:none;color:var(--s-red);cursor:pointer;padding:4px;transition:all .25s;font-size:16px}' +
        '.sub-ci-del:hover{transform:scale(1.15)}' +
        '.sub-cart-empty{text-align:center;padding:36px 16px;color:#94a3b8}' +
        '.sub-cart-total-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:16px;font-weight:700;color:#334155}' +
        '.sub-cart-total-num{color:var(--s-purple-dark);font-size:22px}' +

        /* Анимации */
        '@keyframes subFade{from{opacity:0}to{opacity:1}}' +
        '@keyframes subSlide{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}' +
        '@keyframes subPulse{0%,100%{opacity:1}50%{opacity:.6}}' +
        '@keyframes subShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}' +
        '.sub-shaking{animation:subShake .4s ease}' +

        /* Адаптивность */
        '@media(max-width:768px){' +
            '.subscription-plans{grid-template-columns:1fr}' +
            '.sub-top-panel{flex-direction:column;align-items:stretch}' +
            '.sub-balance-block{justify-content:center;text-align:center}' +
            '.sub-active-row{flex-direction:column;text-align:center}' +
            '.sub-card-bot{flex-direction:column;text-align:center}' +
        '}' +
        '@media(max-width:480px){' +
            '.sub-balance-sum{font-size:22px}' +
            '.sub-price-cur{font-size:18px}' +
        '}';

    document.head.appendChild(style);
}


// =====================================================================
// ========== УВЕДОМЛЕНИЯ ==============================================
// =====================================================================

function showNotification(message, type) {
    type = type || 'info';
    var container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:99999;';
        document.body.appendChild(container);
    }
    var notification = document.createElement('div');
    notification.style.cssText =
        'padding:12px 18px; margin-bottom:10px; border-radius:10px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.15); animation:slideIn .3s ease-out;' +
        'font-size:14px; display:flex; align-items:center; gap:10px;' +
        'max-width:360px; cursor:pointer;';
    var icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error:   '<i class="fas fa-times-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info:    '<i class="fas fa-info-circle"></i>'
    };
    var colors = {
        success: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
        error:   { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
        warning: { bg: '#fff3cd', text: '#856404', border: '#ffeeba' },
        info:    { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' }
    };
    var c = colors[type] || colors.info;
    notification.style.backgroundColor = c.bg;
    notification.style.color = c.text;
    notification.style.border = '1px solid ' + c.border;
    notification.innerHTML = (icons[type] || icons.info) + ' <span>' + message + '</span>';
    notification.addEventListener('click', function () { closeNotification(notification); });
    container.appendChild(notification);
    setTimeout(function () { closeNotification(notification); }, 3500);
}

function closeNotification(el) {
    if (!el || !el.parentNode) return;
    el.style.animation = 'slideOut .3s ease-in forwards';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}


// =====================================================================
// ========== ВСПОМОГАТЕЛЬНЫЕ ==========================================
// =====================================================================

function getPageTitle(page) {
    var titles = {
        'menu':          'Меню на сегодня',
        'orders':        'Мои заказы',
        'subscriptions': 'Абонементы',
        'profile':       'Мой профиль',
        'reviews':       'Мои отзывы'
    };
    return titles[page] || 'Страница';
}