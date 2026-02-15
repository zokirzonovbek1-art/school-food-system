"""SQLite DB helpers for the School Food System Flask backend.

This project originally stored data in LocalStorage (front-end only). The goal of
this backend is to move all data operations to a real DB managed by Flask.

Design goals:
- No extra dependencies beyond Flask/Werkzeug + Python stdlib.
- SQLite out-of-the-box, so the project runs locally without installing MySQL.
- Schema is created automatically on first run.

Note: The DB uses snake_case columns; the front-end expects camelCase fields.
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, date
from typing import Any, Optional


def utcnow_iso() -> str:
    """UTC timestamp in ISO-8601 format without microseconds."""
    return datetime.utcnow().replace(microsecond=0).isoformat()


def today_str() -> str:
    return date.today().isoformat()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


SCHEMA_SQL = r"""
-- Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','cook','admin')),
    class TEXT,
    allergies TEXT,
    preferences TEXT,
    balance REAL DEFAULT 0.0,
    specialization TEXT,
    position TEXT,
    permission_level TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

-- Menu
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- YYYY-MM-DD
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch')),
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    calories INTEGER,
    allergens TEXT,
    is_available INTEGER DEFAULT 1,
    image_url TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_date ON menu_items(date);
CREATE INDEX IF NOT EXISTS idx_menu_meal_type ON menu_items(meal_type);
CREATE INDEX IF NOT EXISTS idx_menu_available ON menu_items(is_available);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch')),
    quantity INTEGER DEFAULT 1,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','preparing','ready','received','cancelled')),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('one_time','subscription')),
    subscription_id INTEGER,
    special_instructions TEXT,
    received_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('breakfast','lunch','full')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
    payment_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_student ON subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_menu_item ON reviews(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_student ON reviews(student_id);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    category TEXT,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    min_quantity REAL NOT NULL,
    expiration_date TEXT,
    supplier TEXT,
    last_restocked TEXT,
    status TEXT DEFAULT 'in_stock' CHECK (status IN ('in_stock','low_stock','out_of_stock')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- Purchase requests
CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cook_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    reason TEXT,
    urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low','medium','high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
    admin_id INTEGER,
    admin_notes TEXT,
    approved_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (cook_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_cook ON purchase_requests(cook_id);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('card','sbp','cash','transfer')),
    transaction_id TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
    description TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('order','payment','system','warning','info')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    link TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    school_name TEXT DEFAULT '',
    work_start TEXT DEFAULT '',
    work_end TEXT DEFAULT '',
    min_balance INTEGER DEFAULT 50,
    notifications_enabled INTEGER DEFAULT 1,
    email_notifications INTEGER DEFAULT 1,
    order_notifications INTEGER DEFAULT 1,
    low_stock_notifications INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL
);

-- Statistics (optional)
CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    total_students INTEGER DEFAULT 0,
    active_orders INTEGER DEFAULT 0,
    meals_served INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0.0,
    avg_rating REAL DEFAULT 0.0,
    created_at TEXT NOT NULL
);
"""


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)


def parse_json_list(value: Optional[str]) -> list[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return [str(x) for x in data]
        return []
    except Exception:
        # Backward compatibility: if stored as comma-separated string
        return [s.strip() for s in str(value).split(',') if s.strip()]


def dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def seed_data(conn: sqlite3.Connection) -> None:
    """Insert demo data if DB is empty."""

    cur = conn.execute("SELECT COUNT(1) AS c FROM users")
    if cur.fetchone()[0] > 0:
        return

    from werkzeug.security import generate_password_hash

    now = utcnow_iso()
    password_hash = generate_password_hash("password")

    # Admin
    conn.execute(
        """INSERT INTO users (email, login, password_hash, full_name, role, position, permission_level, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'admin', ?, ?, 1, ?, ?)""",
        (
            "admin@school.ru",
            "admin",
            password_hash,
            "Администратор Системы",
            "Системный администратор",
            "full",
            now,
            now,
        ),
    )

    # Cook
    conn.execute(
        """INSERT INTO users (email, login, password_hash, full_name, role, specialization, position, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'cook', ?, ?, 1, ?, ?)""",
        (
            "cook@school.ru",
            "cook",
            password_hash,
            "Иванова Мария Петровна",
            "Шеф-повар",
            "Шеф-повар",
            now,
            now,
        ),
    )

    students = [
        (
            "student1@school.ru",
            "student1",
            "Иванов Иван Иванович",
            "10А",
            ["молоко", "орехи"],
            "Не люблю рыбу",
            1500.0,
        ),
        (
            "student2@school.ru",
            "student2",
            "Петрова Анна Сергеевна",
            "9Б",
            ["глютен"],
            "Вегетарианское питание",
            800.0,
        ),
        (
            "student3@school.ru",
            "student3",
            "Сидоров Алексей Петрович",
            "11В",
            [],
            "",
            1200.0,
        ),
    ]

    for email, login, full_name, class_, allergies, preferences, balance in students:
        conn.execute(
            """INSERT INTO users (email, login, password_hash, full_name, role, class, allergies, preferences, balance, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?, 1, ?, ?)""",
            (
                email,
                login,
                password_hash,
                full_name,
                class_,
                dump_json(allergies),
                preferences or None,
                balance,
                now,
                now,
            ),
        )

    # Важно: по требованию проекта заготовленными остаются только аккаунты.
    # Остальные сущности (меню, склад, заявки, статистика) заполняются пользователями через интерфейс.

    conn.commit()


def initialize_database(db_path: str) -> None:
    """Create schema + seed data if DB file does not exist."""

    ensure_dir(os.path.dirname(db_path))

    conn = connect(db_path)
    try:
        create_schema(conn)
        seed_data(conn)
    finally:
        conn.close()
