
(function (global) {
    'use strict';

    // ================================================================
    // Конфигурация
    // ================================================================

    /** @type {string} Базовый путь API */
    const API_BASE = '/api';

    // ================================================================
    // Внутренние утилиты
    // ================================================================

    /**
     * Выполняет синхронный HTTP-запрос к Flask API.
     *
     * Используется синхронный XMLHttpRequest, потому что фронтенд
     * изначально написан с расчётом на синхронные вызовы Database.
     *
     * @param {string} method  — HTTP-метод (GET, POST, PUT, DELETE)
     * @param {string} path    — путь относительно API_BASE (напр. '/users')
     * @param {*}      [body]  — тело запроса (будет сериализовано в JSON)
     * @returns {Object|null}  — распарсенный JSON-ответ или null при ошибке сети
     */
    function apiRequest(method, path, body) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, API_BASE + path, false); // синхронный запрос
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');

        try {
            xhr.send(body !== undefined ? JSON.stringify(body) : null);
        } catch (err) {
            console.error('[Database] Network error:', method, path, err);
            return null;
        }

        // Разбираем ответ
        let response = null;
        try {
            response = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch (e) {
            console.warn('[Database] Failed to parse response:', xhr.responseText);
            response = null;
        }

        // Успех (2xx)
        if (xhr.status >= 200 && xhr.status < 300) {
            return response;
        }

        // Ошибка сервера — логируем, но возвращаем ответ для обработки вызывающим кодом
        if (response && response.error) {
            console.warn('[Database] API error:', xhr.status, response.error);
        } else {
            console.warn('[Database] API error:', xhr.status, xhr.responseText);
        }
        return response;
    }

    /**
     * Возвращает текущего пользователя из sessionStorage.
     * @returns {Object|null}
     */
    function getCurrentUserSafe() {
        try {
            return JSON.parse(sessionStorage.getItem('currentUser')) || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Строит query string из объекта параметров.
     * Пропускает null/undefined значения.
     *
     * @param {Object} params — { key: value, ... }
     * @returns {string} — '' или '?key=val&key2=val2'
     */
    function buildQueryString(params) {
        const parts = [];
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined && value !== '') {
                parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
            }
        }
        return parts.length ? ('?' + parts.join('&')) : '';
    }

    /**
     * Обёртка для стандартного паттерна обработки ответа:
     * — при res.ok возвращает указанное поле
     * — при res.error бросает Error
     * — иначе возвращает fallback
     *
     * @param {Object|null} res       — ответ apiRequest
     * @param {string}      field     — имя поля для извлечения (напр. 'user')
     * @param {*}           fallback  — значение по умолчанию
     * @param {boolean}     throwOnError — бросать ли исключение при ошибке
     * @returns {*}
     */
    function handleResponse(res, field, fallback, throwOnError) {
        if (res && res.ok) {
            return field ? res[field] : res;
        }
        if (throwOnError && res && res.error) {
            throw new Error(res.error);
        }
        return fallback;
    }

    /**
     * Перевод статуса заявки на русский язык.
     * Перенесено из LocalStorage-версии.
     *
     * @param {string} status — статус (pending, approved, rejected, completed)
     * @returns {string}
     */
    function getStatusText(status) {
        const texts = {
            'pending':   'в ожидании',
            'approved':  'одобрена',
            'rejected':  'отклонена',
            'completed': 'выполнена'
        };
        return texts[status] || status;
    }

    // ================================================================
    // Объект Database — единый публичный API
    // ================================================================

    const Database = {

        // ============================================================
        // Инициализация / проверка состояния
        // ============================================================

        /**
         * Инициализирует клиент. Выполняет health-check к бэкенду.
         * Не прерывает работу приложения, если сервер недоступен.
         */
        init: function () {
            try {
                const res = apiRequest('GET', '/health');
                if (res) {
                    console.log('[Database] Backend is healthy');
                } else {
                    console.warn('[Database] Backend health check failed — server may be down');
                }
            } catch (e) {
                console.warn('[Database] Backend unreachable:', e.message);
            }
        },

        // ============================================================
        // Аутентификация / пользователи
        // ============================================================

        /**
         * Ищет пользователя по логину и паролю (аутентификация).
         *
         * @param {string}  login    — логин или email
         * @param {string}  password — пароль
         * @param {string}  [role]   — опциональная роль для фильтрации
         * @returns {Object|null} — объект пользователя или null
         */
        findUser: function (login, password, role) {
            const body = { login, password };
            if (role) body.role = role;
            const res = apiRequest('POST', '/auth/login', body);
            return (res && res.ok && res.user) ? res.user : null;
        },

        /**
         * Создаёт нового пользователя.
         *
         * @param {Object} userData — данные пользователя
         * @returns {Object} — созданный пользователь
         * @throws {Error} — при ошибке на сервере (дубликат логина и т.д.)
         */
        addUser: function (userData) {
            const res = apiRequest('POST', '/users', userData);
            if (res && res.ok && res.user) return res.user;
            if (res && res.error) throw new Error(res.error);
            throw new Error('Не удалось создать пользователя');
        },

        /**
         * Возвращает список пользователей, опционально отфильтрованных по роли.
         *
         * @param {string|null} [role=null] — роль для фильтрации (student, cook, admin)
         * @returns {Array<Object>}
         */
        getUsers: function (role) {
            if (role === undefined) role = null;
            const qs = buildQueryString({ role });
            const res = apiRequest('GET', '/users' + qs);
            return (res && res.ok && Array.isArray(res.users)) ? res.users : [];
        },

        /**
         * Возвращает пользователя по ID.
         *
         * @param {string|number} id — идентификатор пользователя
         * @returns {Object|null}
         */
        getUser: function (id) {
            const res = apiRequest('GET', '/users/' + encodeURIComponent(id));
            return (res && res.ok) ? res.user : null;
        },

        /**
         * Обновляет данные пользователя.
         *
         * @param {string|number} id      — идентификатор пользователя
         * @param {Object}        updates — обновляемые поля
         * @returns {Object|null} — обновлённый пользователь
         * @throws {Error}
         */
        updateUser: function (id, updates) {
            const res = apiRequest('PUT', '/users/' + encodeURIComponent(id), updates);
            if (res && res.ok) return res.user;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Удаляет пользователя.
         * Сервер должен проверять:
         * — нельзя удалить последнего администратора
         * — нельзя удалить самого себя (опционально)
         *
         * @param {string|number} id — идентификатор пользователя
         * @returns {boolean}
         * @throws {Error}
         */
        deleteUser: function (id) {
            const res = apiRequest('DELETE', '/users/' + encodeURIComponent(id));
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        /**
         * Сбрасывает пароль пользователя.
         *
         * @param {string|number} userId      — идентификатор
         * @param {string}        newPassword — новый пароль
         * @returns {boolean}
         * @throws {Error}
         */
        resetPassword: function (userId, newPassword) {
            const res = apiRequest('POST', '/users/' + encodeURIComponent(userId) + '/reset_password', {
                newPassword: newPassword
            });
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        /**
         * Активирует / деактивирует аккаунт пользователя.
         *
         * @param {string|number} userId — идентификатор
         * @param {boolean}       active — новое состояние
         * @returns {boolean}
         * @throws {Error}
         */
        toggleUserActive: function (userId, active) {
            const res = apiRequest('POST', '/users/' + encodeURIComponent(userId) + '/toggle_active', {
                active: !!active
            });
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        /**
         * Поиск пользователей по текстовому запросу.
         *
         * @param {string}      query    — поисковый запрос
         * @param {string|null} [role]   — фильтр по роли
         * @returns {Array<Object>}
         */
        searchUsers: function (query, role) {
            if (role === undefined) role = null;
            const qs = buildQueryString({ q: query || '', role });
            const res = apiRequest('GET', '/users/search' + qs);
            return (res && res.ok && Array.isArray(res.users)) ? res.users : [];
        },

        /**
         * Экспорт данных пользователей (без паролей).
         *
         * @param {string|null} [role] — фильтр по роли
         * @returns {Object} — { exportedAt, total, users }
         */
        exportUsersData: function (role) {
            if (role === undefined) role = null;
            const qs = buildQueryString({ role });
            const res = apiRequest('GET', '/users/export' + qs);
            if (res && res.ok) return res;
            return { exportedAt: new Date().toISOString(), total: 0, users: [] };
        },

        /**
         * Импорт пользователей из внешних данных.
         * Перенесено из LocalStorage-версии, адаптировано для Flask.
         *
         * @param {Object} data — { users: Array<Object> }
         * @returns {Object} — { imported, errors, totalAttempted }
         * @throws {Error} — при некорректном формате
         */
        importUsersData: function (data) {
            if (!data || !data.users || !Array.isArray(data.users)) {
                throw new Error('Некорректный формат данных для импорта');
            }

            // Попытка серверного импорта
            const res = apiRequest('POST', '/users/import', data);
            if (res && res.ok) {
                return {
                    imported:       res.imported       || 0,
                    errors:         res.errors         || [],
                    totalAttempted: res.totalAttempted  || data.users.length
                };
            }

            // Fallback: поштучный импорт через addUser
            const imported = [];
            const errors = [];

            data.users.forEach(function (user, index) {
                try {
                    if (!user.name || !user.role) {
                        errors.push('Пользователь ' + (index + 1) + ': отсутствуют обязательные поля (name, role)');
                        return;
                    }
                    const created = Database.addUser(user);
                    if (created) {
                        imported.push(created);
                    }
                } catch (err) {
                    errors.push('Пользователь ' + (index + 1) + ': ' + err.message);
                }
            });

            return {
                imported:       imported.length,
                errors:         errors,
                totalAttempted: data.users.length
            };
        },

        /**
         * Возвращает баланс пользователя.
         *
         * @param {string|number} userId — идентификатор
         * @returns {number}
         */
        getUserBalance: function (userId) {
            var user = this.getUser(userId);
            return user ? (parseFloat(user.balance) || 0) : 0;
        },

        /**
         * Агрегированная статистика по пользователям.
         * Перенесено из LocalStorage-версии, адаптировано для Flask.
         *
         * @returns {Object} — { total, byRole, active, inactive, newToday, newThisWeek }
         */
        getUserStats: function () {
            // Попытка серверного эндпоинта
            var res = apiRequest('GET', '/users/stats');
            if (res && res.ok && res.stats) return res.stats;

            // Fallback: вычисляем на клиенте
            var users = this.getUsers();
            var now = new Date();
            var todayStr = now.toDateString();
            var weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);

            return {
                total:    users.length,
                byRole: {
                    students: users.filter(function (u) { return u.role === 'student'; }).length,
                    cooks:    users.filter(function (u) { return u.role === 'cook'; }).length,
                    admins:   users.filter(function (u) { return u.role === 'admin'; }).length
                },
                active:   users.filter(function (u) { return u.active !== false && u.isActive !== false; }).length,
                inactive: users.filter(function (u) { return u.active === false || u.isActive === false; }).length,
                newToday: users.filter(function (u) {
                    return u.createdAt && new Date(u.createdAt).toDateString() === todayStr;
                }).length,
                newThisWeek: users.filter(function (u) {
                    return u.createdAt && new Date(u.createdAt) >= weekAgo;
                }).length
            };
        },

        // ============================================================
        // Журнал активности пользователей
        // (перенесено из LocalStorage-версии)
        // ============================================================

        /**
         * Возвращает последние действия пользователя.
         *
         * @param {string|number} userId — идентификатор
         * @returns {Array<Object>}
         */
        getUserActivity: function (userId) {
            var res = apiRequest('GET', '/users/' + encodeURIComponent(userId) + '/activity');
            if (res && res.ok && Array.isArray(res.activities)) {
                return res.activities;
            }
            // Если серверный эндпоинт не реализован — пустой массив
            return [];
        },

        /**
         * Записывает действие пользователя в журнал.
         *
         * @param {string|number} userId  — идентификатор
         * @param {string}        action  — тип действия
         * @param {Object}        [details={}] — дополнительные данные
         * @returns {Object|null}
         */
        logUserActivity: function (userId, action, details) {
            if (details === undefined) details = {};
            var res = apiRequest('POST', '/users/' + encodeURIComponent(userId) + '/activity', {
                action:    action,
                details:   details,
                timestamp: new Date().toISOString()
            });
            return (res && res.ok) ? res.activity : null;
        },

        // ============================================================
        // Меню
        // ============================================================

        /**
         * Возвращает список блюд меню.
         *
         * @param {string|null} [date] — фильтр по дате (YYYY-MM-DD)
         * @param {string|null} [type] — фильтр по типу (breakfast, lunch, etc.)
         * @returns {Array<Object>}
         */
        getMenu: function (date, type) {
            if (date === undefined) date = null;
            if (type === undefined) type = null;
            var qs = buildQueryString({ date: date, type: type });
            var res = apiRequest('GET', '/menu' + qs);
            return (res && res.ok && Array.isArray(res.menu)) ? res.menu : [];
        },

        /**
         * Добавляет новое блюдо в меню.
         *
         * @param {Object} itemData — данные блюда
         * @returns {Object|null}
         * @throws {Error}
         */
        addMenuItem: function (itemData) {
            var res = apiRequest('POST', '/menu', itemData);
            if (res && res.ok) return res.item;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Обновляет блюдо меню.
         *
         * @param {string|number} itemId  — идентификатор блюда
         * @param {Object}        updates — обновляемые поля
         * @returns {Object|null}
         * @throws {Error}
         */
        updateMenuItem: function (itemId, updates) {
            var res = apiRequest('PUT', '/menu/' + encodeURIComponent(itemId), updates);
            if (res && res.ok) return res.item;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Удаляет блюдо из меню.
         *
         * @param {string|number} itemId — идентификатор блюда
         * @returns {boolean}
         * @throws {Error}
         */
        deleteMenuItem: function (itemId) {
            var res = apiRequest('DELETE', '/menu/' + encodeURIComponent(itemId));
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        /**
         * Возвращает одно блюдо по ID.
         * Алиас, перенесённый из LocalStorage-версии (getDish).
         *
         * @param {string|number} id — идентификатор блюда
         * @returns {Object|null}
         */
        getDish: function (id) {
            var res = apiRequest('GET', '/menu/' + encodeURIComponent(id));
            if (res && res.ok) return res.item || res.dish || null;
            return null;
        },

        // ============================================================
        // Инвентарь (склад)
        // ============================================================

        /**
         * Возвращает список товаров на складе.
         *
         * @param {string|null} [status] — фильтр по статусу
         * @param {string|null} [q]      — поисковый запрос
         * @returns {Array<Object>}
         */
        getInventory: function (status, q) {
            if (status === undefined) status = null;
            if (q === undefined) q = null;
            var qs = buildQueryString({ status: status, q: q });
            var res = apiRequest('GET', '/inventory' + qs);
            return (res && res.ok && Array.isArray(res.inventory)) ? res.inventory : [];
        },

        /**
         * Добавляет новый товар на склад.
         *
         * @param {Object} itemData — данные товара
         * @returns {Object|null}
         * @throws {Error}
         */
        addInventoryItem: function (itemData) {
            var res = apiRequest('POST', '/inventory', itemData);
            if (res && res.ok) return res.item;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Обновляет товар на складе.
         *
         * @param {string|number} itemId  — идентификатор товара
         * @param {Object}        updates — обновляемые поля
         * @returns {Object|null}
         * @throws {Error}
         */
        updateInventoryItem: function (itemId, updates) {
            var res = apiRequest('PUT', '/inventory/' + encodeURIComponent(itemId), updates);
            if (res && res.ok) return res.item;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Удаляет товар со склада.
         *
         * @param {string|number} itemId — идентификатор
         * @returns {boolean}
         * @throws {Error}
         */
        deleteInventoryItem: function (itemId) {
            var res = apiRequest('DELETE', '/inventory/' + encodeURIComponent(itemId));
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        // ============================================================
        // Заказы
        // ============================================================

        /**
         * Возвращает список заказов с опциональными фильтрами.
         *
         * @param {string|number|null} [studentId] — ID ученика
         * @param {string|null}        [status]    — статус заказа
         * @param {string|null}        [date]      — дата (YYYY-MM-DD)
         * @returns {Array<Object>}
         */
        getOrders: function (studentId, status, date) {
            if (studentId === undefined) studentId = null;
            if (status === undefined) status = null;
            if (date === undefined) date = null;
            var qs = buildQueryString({ studentId: studentId, status: status, date: date });
            var res = apiRequest('GET', '/orders' + qs);
            return (res && res.ok && Array.isArray(res.orders)) ? res.orders : [];
        },

        /**
         * Алиас: получить заказы пользователя (совместимость с student.js).
         *
         * @param {string|number} userId — идентификатор пользователя
         * @returns {Array<Object>}
         */
        getUserOrders: function (userId) {
            return this.getOrders(userId);
        },

        /**
         * Алиас: получить заказы ученика.
         * Перенесено из LocalStorage-версии (getOrdersByStudent).
         *
         * @param {string|number} studentId — идентификатор ученика
         * @returns {Array<Object>}
         */
        getOrdersByStudent: function (studentId) {
            return this.getOrders(studentId);
        },

        /**
         * Создаёт новый заказ.
         *
         * @param {Object} orderData — данные заказа
         * @returns {Object|null}
         * @throws {Error}
         */
        addOrder: function (orderData) {
            var res = apiRequest('POST', '/orders', orderData);
            if (res && res.ok) return res.order;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Обновляет заказ.
         *
         * @param {string|number} orderId — идентификатор заказа
         * @param {Object}        updates — обновляемые поля
         * @returns {Object|null}
         * @throws {Error}
         */
        updateOrder: function (orderId, updates) {
            var res = apiRequest('PUT', '/orders/' + encodeURIComponent(orderId), updates);
            if (res && res.ok) return res.order;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        // ============================================================
        // Заявки на закупку
        // ============================================================

        /**
         * Возвращает заявки на закупку с фильтром по статусу.
         *
         * @param {string} [status='pending'] — статус для фильтрации
         * @returns {Array<Object>}
         */
        getPurchaseRequests: function (status) {
            if (status === undefined) status = 'pending';
            var qs = status ? buildQueryString({ status: status }) : '';
            var res = apiRequest('GET', '/purchase_requests' + qs);
            return (res && res.ok && Array.isArray(res.requests)) ? res.requests : [];
        },

        /**
         * Возвращает все заявки на закупку (без фильтра по статусу).
         *
         * @returns {Array<Object>}
         */
        getAllPurchaseRequests: function () {
            var res = apiRequest('GET', '/purchase_requests');
            return (res && res.ok && Array.isArray(res.requests)) ? res.requests : [];
        },

        /**
         * Возвращает заявки конкретного повара.
         *
         * @param {string|number} cookId — идентификатор повара
         * @returns {Array<Object>}
         */
        getPurchaseRequestsByCook: function (cookId) {
            var qs = buildQueryString({ cookId: cookId });
            var res = apiRequest('GET', '/purchase_requests' + qs);
            return (res && res.ok && Array.isArray(res.requests)) ? res.requests : [];
        },

        /**
         * Возвращает одну заявку по ID.
         * Перенесено из LocalStorage-версии.
         *
         * @param {string|number} id — идентификатор заявки
         * @returns {Object|null}
         */
        getPurchaseRequest: function (id) {
            var res = apiRequest('GET', '/purchase_requests/' + encodeURIComponent(id));
            if (res && res.ok) return res.request;
            return null;
        },

        /**
         * Создаёт новую заявку на закупку.
         *
         * @param {Object} data — данные заявки
         * @returns {Object|null}
         * @throws {Error}
         */
        addPurchaseRequest: function (data) {
            var res = apiRequest('POST', '/purchase_requests', data);
            if (res && res.ok) return res.request;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Обновляет заявку на закупку.
         *
         * @param {string|number} id      — идентификатор
         * @param {Object}        updates — обновляемые поля
         * @returns {Object|null}
         * @throws {Error}
         */
        updatePurchaseRequest: function (id, updates) {
            var res = apiRequest('PUT', '/purchase_requests/' + encodeURIComponent(id), updates);
            if (res && res.ok) return res.request;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Одобряет заявку на закупку.
         * Перенесено из LocalStorage-версии, адаптировано для Flask.
         *
         * @param {string|number} id        — идентификатор заявки
         * @param {string}        [comment] — комментарий администратора
         * @returns {Object|null}
         * @throws {Error}
         */
        approvePurchaseRequest: function (id, comment) {
            if (comment === undefined) comment = '';
            return this.updatePurchaseRequest(id, {
                status:     'approved',
                comment:    comment,
                approvedAt: new Date().toISOString()
            });
        },

        /**
         * Отклоняет заявку на закупку.
         * Перенесено из LocalStorage-версии, адаптировано для Flask.
         *
         * @param {string|number} id     — идентификатор заявки
         * @param {string}        reason — причина отклонения
         * @returns {Object|null}
         * @throws {Error}
         */
        rejectPurchaseRequest: function (id, reason, adminId) {
            const updates = {
                status: 'rejected',
                rejectionReason: reason || '',
                rejectedAt: new Date().toISOString()
            };
            
            // Если передан adminId, добавляем его в данные
            if (adminId) {
                updates.rejectedBy = adminId;
            }
            
            return this.updatePurchaseRequest(id, updates);
        },

        // ============================================================
        // Уведомления
        // ============================================================

        /**
         * Возвращает уведомления текущего пользователя.
         *
         * @param {string}  [userType='all']    — тип пользователя (для совместимости)
         * @param {boolean} [unreadOnly=false]   — только непрочитанные
         * @returns {Array<Object>}
         */
        getNotifications: function (userType, unreadOnly) {
            if (userType === undefined) userType = 'all';
            if (unreadOnly === undefined) unreadOnly = false;

            var currentUser = getCurrentUserSafe();
            if (!currentUser) return [];

            var params = { userId: currentUser.id };
            if (unreadOnly) params.unreadOnly = '1';

            var qs = buildQueryString(params);
            var res = apiRequest('GET', '/notifications' + qs);
            var notifications = (res && res.ok && Array.isArray(res.notifications))
                ? res.notifications
                : [];

            // Клиентская фильтрация непрочитанных (fallback если сервер не поддерживает)
            if (unreadOnly && notifications.length > 0) {
                notifications = notifications.filter(function (n) {
                    return !n.isRead && !n.read;
                });
            }

            return notifications;
        },

        /**
         * Создаёт уведомление.
         *
         * @param {Object} notification — данные уведомления
         * @returns {Object|null}
         */
        addNotification: function (notification) {
            var res = apiRequest('POST', '/notifications', notification);
            return (res && res.ok) ? res.notification : null;
        },

        /**
         * Отмечает уведомление как прочитанное.
         *
         * @param {string|number} notificationId — идентификатор
         * @returns {boolean}
         */
        markNotificationAsRead: function (notificationId) {
            var res = apiRequest('POST', '/notifications/' + encodeURIComponent(notificationId) + '/read');
            return !!(res && res.ok);
        },

        // ============================================================
        // Критические события
        // (перенесено из LocalStorage-версии)
        // ============================================================

        /**
         * Возвращает список критических событий.
         *
         * @returns {Array<Object>}
         */
        getCriticalEvents: function () {
            var res = apiRequest('GET', '/critical_events');
            if (res && res.ok && Array.isArray(res.events)) {
                return res.events;
            }
            return [];
        },

        /**
         * Помечает критическое событие как решённое.
         *
         * @param {string|number} id — идентификатор события
         * @returns {boolean}
         * @throws {Error}
         */
        resolveCriticalEvent: function (id) {
            var res = apiRequest('POST', '/critical_events/' + encodeURIComponent(id) + '/resolve');
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        /**
         * Помечает критическое событие как игнорируемое.
         *
         * @param {string|number} id — идентификатор события
         * @returns {boolean}
         * @throws {Error}
         */
        ignoreCriticalEvent: function (id) {
            var res = apiRequest('POST', '/critical_events/' + encodeURIComponent(id) + '/ignore');
            if (res && res.ok) return true;
            if (res && res.error) throw new Error(res.error);
            return false;
        },

        // ============================================================
        // Настройки
        // ============================================================

        /**
         * Возвращает настройки системы.
         *
         * @returns {Object|null}
         */
        getSettings: function () {
            var res = apiRequest('GET', '/settings');
            return (res && res.ok) ? res.settings : null;
        },

        /**
         * Обновляет настройки системы.
         *
         * @param {Object} settings — новые значения настроек
         * @returns {Object|null}
         * @throws {Error}
         */
        updateSettings: function (settings) {
            var res = apiRequest('PUT', '/settings', settings);
            if (res && res.ok) return res.settings;
            if (res && res.error) throw new Error(res.error);
            return null;
        },

        /**
         * Алиас для updateSettings (совместимость с admin-кодом).
         *
         * @param {Object} settings
         * @returns {Object|null}
         */
        saveSettings: function (settings) {
            return this.updateSettings(settings);
        },

        // ============================================================
        // Статистика (дашборд)
        // ============================================================

        /**
         * Возвращает агрегированную статистику для дашборда.
         *
         * @returns {Object|null}
         */
        getStatistics: function () {
            var res = apiRequest('GET', '/statistics');
            return (res && res.ok) ? res.statistics : null;
        },

        // ============================================================
        // Отчёты
        // ============================================================

        /**
         * Генерирует сводный отчёт за период.
         * Сначала пытается получить данные с сервера, при неудаче —
         * собирает клиентский отчёт из отдельных запросов.
         *
         * @param {string} startDate — начало периода (YYYY-MM-DD или Date-строка)
         * @param {string} endDate   — конец периода
         * @returns {Object} — { title, period, summary, data }
         */
        generateReport: function (startDate, endDate) {
            // Попытка серверной генерации
            var res = apiRequest('POST', '/reports/generate', {
                startDate: startDate,
                endDate:   endDate,
                type:      'summary'
            });
            if (res && res.ok && res.report) {
                return res.report;
            }

            // Fallback: клиентская генерация
            var start = new Date(startDate);
            var end   = new Date(endDate);

            var orders = this.getOrders(null, null, null).filter(function (o) {
                var d = new Date(o.createdAt || o.date);
                return d >= start && d <= end;
            });

            var purchases = this.getAllPurchaseRequests().filter(function (p) {
                var d = new Date(p.createdAt || p.date);
                return d >= start && d <= end;
            });

            var users = this.getUsers();

            var revenue = orders.reduce(function (sum, o) {
                return sum + (parseFloat(o.total) || parseFloat(o.price) || 0);
            }, 0);

            var expenses = purchases.reduce(function (sum, p) {
                return sum + (parseFloat(p.cost) || parseFloat(p.estimatedCost) || 0);
            }, 0);

            var activeUsersCount = users.filter(function (u) {
                return u.active !== false && u.isActive !== false;
            }).length;

            var periodStr = start.toLocaleDateString('ru-RU') + ' \u2014 ' + end.toLocaleDateString('ru-RU');

            return {
                title: 'Сводный отчет',
                period: periodStr,
                summary:
                    '<p><strong>Всего заказов:</strong> ' + orders.length + '</p>' +
                    '<p><strong>Общая выручка:</strong> ' + revenue + ' руб.</p>' +
                    '<p><strong>Заявок на закупку:</strong> ' + purchases.length + '</p>' +
                    '<p><strong>Затраты на закупки:</strong> ' + expenses + ' руб.</p>' +
                    '<p><strong>Прибыль:</strong> ' + (revenue - expenses) + ' руб.</p>' +
                    '<p><strong>Активных пользователей:</strong> ' + activeUsersCount + '</p>',
                data: {
                    orders:       orders,
                    purchases:    purchases,
                    revenue:      revenue,
                    expenses:     expenses,
                    profit:       revenue - expenses,
                    users:        users.length,
                    activeUsers:  activeUsersCount
                }
            };
        },

        /**
         * Генерирует типизированный отчёт.
         * Поддерживаемые типы: financial, meals, purchases, users.
         * Перенесено из LocalStorage-версии, адаптировано для Flask.
         *
         * @param {string} type      — тип отчёта
         * @param {string} startDate — начало периода
         * @param {string} endDate   — конец периода
         * @returns {Object}
         */
        getReport: function (type, startDate, endDate) {
            // Попытка серверной генерации типизированного отчёта
            var res = apiRequest('POST', '/reports/generate', {
                startDate: startDate,
                endDate:   endDate,
                type:      type
            });
            if (res && res.ok && res.report) {
                return res.report;
            }

            // Fallback: клиентская генерация
            var start = new Date(startDate);
            var end   = new Date(endDate);

            var periodStr = start.toLocaleDateString('ru-RU') + ' \u2014 ' + end.toLocaleDateString('ru-RU');

            // Общие данные для всех типов
            var allOrders = this.getOrders(null, null, null).filter(function (o) {
                var d = new Date(o.createdAt || o.date);
                return d >= start && d <= end;
            });

            var allPurchases = this.getAllPurchaseRequests().filter(function (p) {
                var d = new Date(p.createdAt || p.date);
                return d >= start && d <= end;
            });

            var allUsers = this.getUsers();

            switch (type) {
                case 'financial': {
                    var revenue = allOrders.reduce(function (sum, o) {
                        return sum + (parseFloat(o.total) || parseFloat(o.price) || 0);
                    }, 0);
                    var expenses = allPurchases.reduce(function (sum, p) {
                        return sum + (parseFloat(p.cost) || parseFloat(p.estimatedCost) || 0);
                    }, 0);
                    var profit = revenue - expenses;
                    var profitability = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
                    var avgOrder = allOrders.length > 0 ? Math.round(revenue / allOrders.length) : 0;

                    return {
                        title: 'Финансовый отчет',
                        period: periodStr,
                        summary:
                            '<p><strong>Выручка:</strong> ' + revenue + ' руб.</p>' +
                            '<p><strong>Расходы:</strong> ' + expenses + ' руб.</p>' +
                            '<p><strong>Прибыль:</strong> ' + profit + ' руб.</p>' +
                            '<p><strong>Рентабельность:</strong> ' + profitability + '%</p>',
                        data: {
                            revenue:           revenue,
                            expenses:          expenses,
                            profit:            profit,
                            ordersCount:       allOrders.length,
                            averageOrderValue: avgOrder
                        }
                    };
                }

                case 'meals': {
                    var students = allUsers.filter(function (u) { return u.role === 'student'; });
                    // Собираем уникальные ID учеников, сделавших заказы
                    var orderedMap = {};
                    allOrders.forEach(function (o) {
                        var sid = o.userId || o.studentId;
                        if (sid) orderedMap[sid] = true;
                    });
                    var orderedCount = Object.keys(orderedMap).length;
                    var coverage = students.length > 0 ? Math.round((orderedCount / students.length) * 100) : 0;
                    var avgOrders = students.length > 0 ? (allOrders.length / students.length).toFixed(1) : '0';

                    return {
                        title: 'Отчет по питанию',
                        period: periodStr,
                        summary:
                            '<p><strong>Всего учеников:</strong> ' + students.length + '</p>' +
                            '<p><strong>Заказывали питание:</strong> ' + orderedCount + '</p>' +
                            '<p><strong>Охват питанием:</strong> ' + coverage + '%</p>' +
                            '<p><strong>Среднее кол-во заказов на ученика:</strong> ' + avgOrders + '</p>',
                        data: {
                            totalStudents:          students.length,
                            studentsWithOrders:     orderedCount,
                            coveragePercentage:     coverage,
                            totalOrders:            allOrders.length,
                            averageOrdersPerStudent: avgOrders
                        }
                    };
                }

                case 'purchases': {
                    var approved = allPurchases.filter(function (p) { return p.status === 'approved'; });
                    var rejected = allPurchases.filter(function (p) { return p.status === 'rejected'; });
                    var pending  = allPurchases.filter(function (p) { return p.status === 'pending'; });
                    var totalCost = approved.reduce(function (sum, p) {
                        return sum + (parseFloat(p.cost) || parseFloat(p.estimatedCost) || 0);
                    }, 0);
                    var avgCost = approved.length > 0 ? Math.round(totalCost / approved.length) : 0;

                    return {
                        title: 'Отчет по закупкам',
                        period: periodStr,
                        summary:
                            '<p><strong>Всего заявок:</strong> ' + allPurchases.length + '</p>' +
                            '<p><strong>Одобрено:</strong> ' + approved.length + '</p>' +
                            '<p><strong>Общая стоимость:</strong> ' + totalCost + ' руб.</p>' +
                            '<p><strong>Средняя стоимость заявки:</strong> ' + avgCost + ' руб.</p>',
                        data: {
                            totalRequests:    allPurchases.length,
                            approvedRequests: approved.length,
                            rejectedRequests: rejected.length,
                            pendingRequests:  pending.length,
                            totalCost:        totalCost,
                            averageCost:      avgCost
                        }
                    };
                }

                case 'users': {
                    var activeUsers = allUsers.filter(function (u) {
                        return u.active !== false && u.isActive !== false;
                    });
                    var newUsers = allUsers.filter(function (u) {
                        var d = new Date(u.createdAt || u.date);
                        return d >= start && d <= end;
                    });

                    return {
                        title: 'Отчет по пользователям',
                        period: periodStr,
                        summary:
                            '<p><strong>Всего пользователей:</strong> ' + allUsers.length + '</p>' +
                            '<p><strong>Активных:</strong> ' + activeUsers.length + '</p>' +
                            '<p><strong>Новых за период:</strong> ' + newUsers.length + '</p>' +
                            '<p><strong>Учеников:</strong> ' + allUsers.filter(function (u) { return u.role === 'student'; }).length + '</p>' +
                            '<p><strong>Поваров:</strong> ' + allUsers.filter(function (u) { return u.role === 'cook'; }).length + '</p>' +
                            '<p><strong>Администраторов:</strong> ' + allUsers.filter(function (u) { return u.role === 'admin'; }).length + '</p>',
                        data: {
                            totalUsers:  allUsers.length,
                            activeUsers: activeUsers.length,
                            newUsers:    newUsers.length,
                            byRole: {
                                students: allUsers.filter(function (u) { return u.role === 'student'; }).length,
                                cooks:    allUsers.filter(function (u) { return u.role === 'cook'; }).length,
                                admins:   allUsers.filter(function (u) { return u.role === 'admin'; }).length
                            }
                        }
                    };
                }

                default:
                    return this.generateReport(startDate, endDate);
            }
        },

        // ============================================================
        // Утилиты
        // ============================================================

        /**
         * Переводит статус в читаемый текст на русском.
         *
         * @param {string} status
         * @returns {string}
         */
        getStatusText: function (status) {
            return getStatusText(status);
        }
    };

    // ================================================================
    // Экспорт в глобальную область видимости
    // ================================================================
    global.Database = Database;

})(window);