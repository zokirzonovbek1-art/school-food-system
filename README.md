# school-food-system

# School Food System (Flask + SQLite)

В исходном проекте вся «работа с БД» была реализована на фронтенде через `localStorage`.
В этой версии логика перенесена на **Flask** (backend) + **SQLite** (реальная СУБД), а файл `school-food-system/js/database.js` стал клиентом для API.

## Как запустить

1) Перейдите в папку проекта:

```bash
cd school-food-system2
```

2) Запустите backend:

```bash
python backend/app.py
```

3) Откройте в браузере:

- `http://127.0.0.1:5000/`

> ВАЖНО: открывать страницы нужно **через Flask**, а не двойным кликом по `index.html`.

## Демо-аккаунты

После первого запуска создаётся SQLite база `backend/data/school_food.sqlite3` и демо-данные.

Пароль у всех демо-аккаунтов одинаковый: **`password`**

- Администратор: login `admin` / email `admin@school.ru`
- Повар: login `cook` / email `cook@school.ru`
- Ученик: login `student1` / email `student1@school.ru`

## Что было сделано

- Добавлен backend на Flask (`backend/app.py`).
- Добавлена SQLite БД + автосоздание схемы + сидинг (`backend/db.py`).
- Полностью переписан `school-food-system/js/database.js`: теперь он обращается к Flask API.

## API (кратко)

- `POST /api/auth/login`
- `POST /api/users`, `GET /api/users`, `PUT /api/users/<id>`, `DELETE /api/users/<id>`
- `GET /api/menu`, `POST /api/menu`, `PUT /api/menu/<id>`, `DELETE /api/menu/<id>`
- `GET /api/orders`, `POST /api/orders`, `PUT /api/orders/<id>`
- `GET /api/purchase_requests`, `POST /api/purchase_requests`, `PUT /api/purchase_requests/<id>`
- `GET /api/notifications`, `POST /api/notifications`, `POST /api/notifications/<id>/read`
- `GET /api/settings`, `PUT /api/settings`
- `GET /api/statistics`
