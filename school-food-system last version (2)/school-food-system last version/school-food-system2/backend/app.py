from __future__ import annotations

import os
import sqlite3
from typing import Any, Optional

from flask import Flask, jsonify, request, send_from_directory, g
from werkzeug.security import check_password_hash, generate_password_hash

from db import (
    initialize_database,
    connect,
    utcnow_iso,
    today_str,
    parse_json_list,
    dump_json,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "school-food-system"))
DB_PATH = os.path.join(BASE_DIR, "data", "school_food.sqlite3")


def create_app() -> Flask:
    app = Flask(__name__)
    # Ensure UTF-8 JSON output (Flask 3 uses UTF-8 by default; this keeps backward compatibility)
    app.config["JSON_AS_ASCII"] = False
    app.config["FRONTEND_DIR"] = FRONTEND_DIR
    app.config["DB_PATH"] = DB_PATH

    # Create DB + seed demo data on first run
    initialize_database(DB_PATH)

    # ---- DB connection per request ----
    def get_db() -> sqlite3.Connection:
        if "db" not in g:
            g.db = connect(app.config["DB_PATH"])
        return g.db

    @app.teardown_appcontext
    def close_db(exception: Optional[BaseException] = None):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    # ---- Helpers (row -> API dicts) ----
    def _row_optional(row: sqlite3.Row, key: str) -> Any:
        """Safe access to optional columns (for SELECTs that include JOIN aliases)."""
        try:
            return row[key] if key in row.keys() else None
        except Exception:
            return None

    def user_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["full_name"],
            "email": row["email"],
            "login": row["login"],
            "role": row["role"],
            "class": row["class"],
            "allergies": parse_json_list(row["allergies"]),
            "preferences": row["preferences"] or "",
            "balance": float(row["balance"] or 0),
            "specialization": row["specialization"],
            "position": row["position"],
            "permissionLevel": row["permission_level"],
            "isActive": bool(row["is_active"]),
            # Backward-compatible alias used in parts of the old front-end
            "active": bool(row["is_active"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def menu_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "date": row["date"],
            "type": row["meal_type"],
            "name": row["name"],
            "description": row["description"] or "",
            "price": float(row["price"]),
            "calories": row["calories"],
            "allergens": parse_json_list(row["allergens"]),
            "isAvailable": bool(row["is_available"]),
            "imageUrl": row["image_url"],
            "createdAt": row["created_at"],
        }

    def order_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        menu_name = _row_optional(row, "menu_name")
        student_name = _row_optional(row, "student_name")
        student_class = _row_optional(row, "student_class") or _row_optional(row, "class")

        return {
            "id": row["id"],
            "studentId": row["student_id"],
            "studentName": student_name,
            "studentClass": student_class,
            # Backward-compatible alias used in some old templates
            "className": student_class,
            "menuId": row["menu_item_id"],
            "menuName": menu_name,
            # Backward-compatible aliases expected by cook.js
            "dishId": row["menu_item_id"],
            "dishName": menu_name,
            "type": row["meal_type"],
            "quantity": row["quantity"],
            "price": float(row["total_price"]),
            "total": float(row["total_price"]),
            "status": row["status"],
            "paymentType": row["payment_type"],
            "subscriptionId": row["subscription_id"],
            "specialInstructions": row["special_instructions"],
            "receivedAt": row["received_at"],
            "createdAt": row["created_at"],
            "date": row["order_date"],
        }

    def purchase_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        urgency = row["urgency"]
        return {
            "id": row["id"],
            "cookId": row["cook_id"],
            "cookName": _row_optional(row, "cook_name"),
            "product": row["product_name"],
            "productName": row["product_name"],
            "quantity": float(row["quantity"]),
            "unit": row["unit"],
            "reason": row["reason"] or "",
            "urgency": urgency,
            # Backward-compatible alias used in some old pages
            "priority": urgency,
            "status": row["status"],
            "adminId": row["admin_id"],
            "adminNotes": row["admin_notes"],
            "approvedAt": row["approved_at"],
            "completedAt": row["completed_at"],
            "createdAt": row["created_at"],
        }


    def inventory_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "name": row["product_name"],
            "productName": row["product_name"],
            "category": row["category"],
            "currentStock": float(row["quantity"]),
            "quantity": float(row["quantity"]),
            "unit": row["unit"],
            "minStock": float(row["min_quantity"]),
            "minQuantity": float(row["min_quantity"]),
            "expiryDate": row["expiration_date"],
            "expirationDate": row["expiration_date"],
            "supplier": row["supplier"],
            "lastRestocked": row["last_restocked"],
            "status": row["status"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def notification_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "userId": row["user_id"],
            "type": row["type"],
            "title": row["title"],
            "message": row["message"],
            "isRead": bool(row["is_read"]),
            # Backward compatible key used by some old code
            "read": bool(row["is_read"]),
            "link": row["link"],
            "createdAt": row["created_at"],
            # Old code sometimes expects `date`
            "date": row["created_at"],
        }

    def settings_row_to_api(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "schoolName": row["school_name"],
            "workStart": row["work_start"],
            "workEnd": row["work_end"],
            "workHours": {"start": row["work_start"], "end": row["work_end"]},
            "minBalance": row["min_balance"],
            "notificationsEnabled": bool(row["notifications_enabled"]),
            "emailNotifications": bool(row["email_notifications"]),
            "orderNotifications": bool(row["order_notifications"]),
            "lowStockNotifications": bool(row["low_stock_notifications"]),
            "updatedAt": row["updated_at"],
        }

    # ---- Common error response ----
    def api_error(message: str, status: int = 400):
        return jsonify({"ok": False, "error": message}), status

    # ---- API: notifications (helper) ----
    def _create_notification(db: sqlite3.Connection, user_id: int, n_type: str, title: str, message: str, link: Optional[str]):
        now = utcnow_iso()
        db.execute(
            "INSERT INTO notifications (user_id, type, title, message, is_read, link, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
            (user_id, n_type, title, message, link, now),
        )
        db.commit()

    # ---- API: health ----
    @app.get("/api/health")
    def api_health():
        return jsonify({"ok": True, "status": "ok"})

    # ---- API: auth ----
    @app.post("/api/auth/login")
    def api_login():
        payload = request.get_json(silent=True) or {}
        login = (payload.get("login") or "").strip()
        password = payload.get("password") or ""
        role = payload.get("role")

        if not login or not password:
            return api_error("login and password required", 400)

        db = get_db()
        row = db.execute(
            "SELECT * FROM users WHERE (email = ? OR login = ?) AND is_active = 1",
            (login, login),
        ).fetchone()

        if not row or not check_password_hash(row["password_hash"], password):
            return api_error("Неверный логин или пароль", 401)

        if role and row["role"] != role:
            return api_error("Неверная роль для данного аккаунта", 403)

        return jsonify({"ok": True, "user": user_row_to_api(row)})

    @app.post("/api/auth/register")
    def api_register():
        # Optional separate endpoint; kept for completeness
        return api_create_user()

    # ---- API: users ----
    @app.get("/api/users")
    def api_get_users():
        role = request.args.get("role")
        db = get_db()

        if role:
            rows = db.execute("SELECT * FROM users WHERE role = ? ORDER BY id", (role,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM users ORDER BY id").fetchall()

        return jsonify({"ok": True, "users": [user_row_to_api(r) for r in rows]})

    @app.get("/api/users/<int:user_id>")
    def api_get_user(user_id: int):
        db = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return api_error("Пользователь не найден", 404)
        return jsonify({"ok": True, "user": user_row_to_api(row)})

    @app.get("/api/users/search")
    def api_search_users():
        q = (request.args.get("q") or "").strip().lower()
        role = request.args.get("role")

        db = get_db()
        sql = "SELECT * FROM users WHERE 1=1"
        params: list[Any] = []

        if role:
            sql += " AND role = ?"
            params.append(role)

        if q:
            sql += " AND (LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(login) LIKE ? OR LOWER(class) LIKE ? OR CAST(id AS TEXT) LIKE ?)"
            like = f"%{q}%"
            params.extend([like, like, like, like, like])

        sql += " ORDER BY id"

        rows = db.execute(sql, params).fetchall()
        return jsonify({"ok": True, "users": [user_row_to_api(r) for r in rows]})

    @app.get("/api/users/export")
    def api_export_users():
        role = request.args.get("role")
        db = get_db()

        if role:
            rows = db.execute("SELECT * FROM users WHERE role = ? ORDER BY id", (role,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM users ORDER BY id").fetchall()

        safe_users = [user_row_to_api(r) for r in rows]

        return jsonify({
            "ok": True,
            "exportedAt": utcnow_iso(),
            "total": len(safe_users),
            "users": safe_users,
        })

    @app.post("/api/users")
    def api_create_user():
        payload = request.get_json(silent=True) or {}
        name = (payload.get("name") or payload.get("full_name") or payload.get("fullName") or "").strip()
        email = (payload.get("email") or "").strip()
        login = (payload.get("login") or "").strip()
        password = payload.get("password") or ""
        role = payload.get("role") or "student"

        if not name or not email or not login or not password:
            return api_error("name, email, login, password обязательны", 400)

        if role not in ("student", "cook", "admin"):
            return api_error("Некорректная роль", 400)

        # Optional fields
        class_ = payload.get("class") or payload.get("className")
        allergies = payload.get("allergies")
        preferences = payload.get("preferences")
        balance = payload.get("balance")
        specialization = payload.get("specialization")
        position = payload.get("position")
        permission_level = payload.get("permissionLevel")
        is_active = payload.get("isActive")
        if is_active is None:
            is_active = payload.get("active")
        if is_active is None:
            is_active = True

        now = utcnow_iso()
        db = get_db()
        try:
            cur = db.execute(
                """INSERT INTO users (email, login, password_hash, full_name, role, class, allergies, preferences, balance,
                                      specialization, position, permission_level, is_active, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    email,
                    login,
                    generate_password_hash(password),
                    name,
                    role,
                    class_,
                    dump_json(allergies) if isinstance(allergies, (list, dict)) else (dump_json(parse_json_list(allergies)) if isinstance(allergies, str) and allergies else None),
                    preferences,
                    float(balance) if balance not in (None, "") else 0.0,
                    specialization,
                    position,
                    permission_level,
                    1 if bool(is_active) else 0,
                    now,
                    now,
                ),
            )
            user_id = cur.lastrowid
            db.commit()
        except sqlite3.IntegrityError:
            return api_error("Пользователь с таким email или логином уже существует", 409)

        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

        # Notify the system admin (id=1) about new registrations
        if role != "admin":
            _create_notification(
                db,
                user_id=1,
                n_type="system",
                title="Новый пользователь",
                message=f"Зарегистрирован новый пользователь: {name}",
                link="/admin.html",
            )

        return jsonify({"ok": True, "user": user_row_to_api(row)})

    @app.put("/api/users/<int:user_id>")
    def api_update_user(user_id: int):
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error("Нет данных для обновления", 400)

        allowed_map = {
            "name": "full_name",
            "full_name": "full_name",
            "fullName": "full_name",
            "email": "email",
            "login": "login",
            "role": "role",
            "class": "class",
            "allergies": "allergies",
            "preferences": "preferences",
            "balance": "balance",
            "specialization": "specialization",
            "position": "position",
            "permissionLevel": "permission_level",
            "isActive": "is_active",
            "active": "is_active",
        }

        sets: list[str] = []
        params: list[Any] = []

        for key, col in allowed_map.items():
            if key not in payload:
                continue
            val = payload.get(key)

            if col == "is_active":
                val = 1 if bool(val) else 0
            elif col == "allergies":
                if isinstance(val, (list, dict)):
                    val = dump_json(val)
                elif isinstance(val, str):
                    val = dump_json(parse_json_list(val))
            elif col == "balance":
                try:
                    val = float(val) if val not in (None, "") else 0.0
                except Exception:
                    return api_error("Некорректный balance", 400)
            elif col == "role":
                if val not in ("student", "cook", "admin"):
                    return api_error("Некорректная роль", 400)
            elif col == "full_name" and isinstance(val, str):
                val = val.strip()

            sets.append(f"{col} = ?")
            params.append(val)

        if not sets:
            return api_error("Нет поддерживаемых полей для обновления", 400)

        sets.append("updated_at = ?")
        params.append(utcnow_iso())
        params.append(user_id)

        db = get_db()
        try:
            db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params)
            db.commit()
        except sqlite3.IntegrityError:
            return api_error("Email или логин уже заняты", 409)

        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return api_error("Пользователь не найден", 404)
        return jsonify({"ok": True, "user": user_row_to_api(row)})

    @app.delete("/api/users/<int:user_id>")
    def api_delete_user(user_id: int):
        db = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return api_error("Пользователь не найден", 404)

        # Prevent deleting the last active admin
        if row["role"] == "admin" and row["is_active"]:
            admin_count = db.execute("SELECT COUNT(1) FROM users WHERE role='admin' AND is_active=1").fetchone()[0]
            if admin_count <= 1:
                return api_error("Нельзя удалить последнего активного администратора", 409)

        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        db.commit()
        return jsonify({"ok": True, "deleted": True})

    @app.post("/api/users/<int:user_id>/reset_password")
    def api_reset_password(user_id: int):
        payload = request.get_json(silent=True) or {}
        new_password = payload.get("newPassword") or payload.get("password")
        if not new_password:
            return api_error("newPassword required", 400)

        db = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return api_error("Пользователь не найден", 404)

        db.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (generate_password_hash(new_password), utcnow_iso(), user_id),
        )
        db.commit()

        _create_notification(
            db,
            user_id=user_id,
            n_type="warning",
            title="Пароль сброшен",
            message="Администратор сбросил ваш пароль.",
            link=None,
        )

        row2 = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"ok": True, "user": user_row_to_api(row2)})

    @app.post("/api/users/<int:user_id>/toggle_active")
    def api_toggle_active(user_id: int):
        payload = request.get_json(silent=True) or {}
        active = payload.get("active")
        if active is None:
            active = payload.get("isActive")
        if active is None:
            return api_error("active required", 400)

        db = get_db()
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return api_error("Пользователь не найден", 404)

        # last admin safeguard
        if row["role"] == "admin" and row["is_active"] and not bool(active):
            admin_count = db.execute("SELECT COUNT(1) FROM users WHERE role='admin' AND is_active=1").fetchone()[0]
            if admin_count <= 1:
                return api_error("Нельзя деактивировать последнего активного администратора", 409)

        db.execute(
            "UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?",
            (1 if bool(active) else 0, utcnow_iso(), user_id),
        )
        db.commit()

        _create_notification(
            db,
            user_id=user_id,
            n_type="system",
            title="Аккаунт активирован" if bool(active) else "Аккаунт деактивирован",
            message="Ваш аккаунт был активирован администратором." if bool(active) else "Ваш аккаунт был деактивирован администратором.",
            link=None,
        )

        row2 = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return jsonify({"ok": True, "user": user_row_to_api(row2)})

    # ---- API: menu ----
    @app.get("/api/menu")
    def api_get_menu():
        date_ = request.args.get("date")
        meal_type = request.args.get("type")

        db = get_db()
        sql = "SELECT * FROM menu_items WHERE 1=1"
        params: list[Any] = []

        if date_:
            sql += " AND date = ?"
            params.append(date_)

        if meal_type:
            sql += " AND meal_type = ?"
            params.append(meal_type)

        sql += " ORDER BY date DESC, id"

        rows = db.execute(sql, params).fetchall()
        return jsonify({"ok": True, "menu": [menu_row_to_api(r) for r in rows]})

    @app.post("/api/menu")
    def api_add_menu_item():
        payload = request.get_json(silent=True) or {}
        date_ = payload.get("date") or today_str()
        meal_type = payload.get("type") or payload.get("mealType")
        name = (payload.get("name") or "").strip()

        if meal_type not in ("breakfast", "lunch"):
            return api_error("type must be breakfast|lunch", 400)
        if not name:
            return api_error("name required", 400)

        description = payload.get("description")
        price = payload.get("price")
        calories = payload.get("calories")
        allergens = payload.get("allergens")
        is_available = payload.get("isAvailable")
        if is_available is None:
            is_available = True
        image_url = payload.get("imageUrl") or payload.get("image_url")

        try:
            price_f = float(price)
        except Exception:
            return api_error("price must be number", 400)

        now = utcnow_iso()
        db = get_db()
        cur = db.execute(
            """INSERT INTO menu_items (date, meal_type, name, description, price, calories, allergens, is_available, image_url, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                date_,
                meal_type,
                name,
                description,
                price_f,
                int(calories) if calories not in (None, "") else None,
                dump_json(allergens) if isinstance(allergens, (list, dict)) else (dump_json(parse_json_list(allergens)) if isinstance(allergens, str) and allergens else None),
                1 if bool(is_available) else 0,
                image_url,
                now,
            ),
        )
        db.commit()

        row = db.execute("SELECT * FROM menu_items WHERE id = ?", (cur.lastrowid,)).fetchone()
        return jsonify({"ok": True, "item": menu_row_to_api(row)})

    @app.put("/api/menu/<int:item_id>")
    def api_update_menu_item(item_id: int):
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error("Нет данных для обновления", 400)

        allowed_map = {
            "date": "date",
            "type": "meal_type",
            "mealType": "meal_type",
            "name": "name",
            "description": "description",
            "price": "price",
            "calories": "calories",
            "allergens": "allergens",
            "isAvailable": "is_available",
            "imageUrl": "image_url",
            "image_url": "image_url",
        }

        sets: list[str] = []
        params: list[Any] = []

        for key, col in allowed_map.items():
            if key not in payload:
                continue
            val = payload.get(key)

            if col == "meal_type":
                if val not in ("breakfast", "lunch"):
                    return api_error("type must be breakfast|lunch", 400)
            if col == "price":
                try:
                    val = float(val)
                except Exception:
                    return api_error("price must be number", 400)
            if col == "calories":
                val = int(val) if val not in (None, "") else None
            if col == "is_available":
                val = 1 if bool(val) else 0
            if col == "allergens":
                if isinstance(val, (list, dict)):
                    val = dump_json(val)
                elif isinstance(val, str):
                    val = dump_json(parse_json_list(val))

            sets.append(f"{col} = ?")
            params.append(val)

        if not sets:
            return api_error("Нет поддерживаемых полей", 400)

        params.append(item_id)
        db = get_db()
        db.execute(f"UPDATE menu_items SET {', '.join(sets)} WHERE id = ?", params)
        db.commit()

        row = db.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return api_error("Блюдо не найдено", 404)

        return jsonify({"ok": True, "item": menu_row_to_api(row)})

    @app.delete("/api/menu/<int:item_id>")
    def api_delete_menu_item(item_id: int):
        db = get_db()
        row = db.execute("SELECT id FROM menu_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return api_error("Блюдо не найдено", 404)
        db.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
        db.commit()
        return jsonify({"ok": True, "deleted": True})

    # ---- API: orders ----
    @app.get("/api/orders")
    def api_get_orders():
        student_id = request.args.get("studentId") or request.args.get("userId")
        status = request.args.get("status")
        date_ = request.args.get("date")

        db = get_db()
        sql = (
            "SELECT o.*, u.full_name AS student_name, u.class AS student_class, m.name AS menu_name "
            "FROM orders o "
            "JOIN users u ON u.id = o.student_id "
            "JOIN menu_items m ON m.id = o.menu_item_id "
            "WHERE 1=1"
        )
        params: list[Any] = []

        if student_id:
            sql += " AND o.student_id = ?"
            params.append(int(student_id))
        if status:
            sql += " AND o.status = ?"
            params.append(status)
        if date_:
            sql += " AND o.order_date = ?"
            params.append(date_)

        sql += " ORDER BY o.created_at DESC, o.id DESC"

        rows = db.execute(sql, params).fetchall()
        return jsonify({"ok": True, "orders": [order_row_to_api(r) for r in rows]})

    @app.post("/api/orders")
    def api_add_order():
        payload = request.get_json(silent=True) or {}
        student_id = payload.get("studentId") or payload.get("student_id")
        menu_id = payload.get("menuId") or payload.get("menu_item_id") or payload.get("dishId")
        meal_type = payload.get("type") or payload.get("mealType")
        payment_type = payload.get("paymentType") or payload.get("payment_type") or "one_time"

        if not student_id or not menu_id:
            return api_error("studentId and menuId required", 400)

        if meal_type and meal_type not in ("breakfast", "lunch"):
            return api_error("type must be breakfast|lunch", 400)

        if payment_type not in ("one_time", "subscription"):
            return api_error("paymentType must be one_time|subscription", 400)

        quantity = payload.get("quantity") or 1
        try:
            quantity_i = int(quantity)
            if quantity_i <= 0:
                raise ValueError
        except Exception:
            return api_error("quantity must be positive integer", 400)

        order_date = payload.get("date") or payload.get("orderDate") or today_str()
        special = payload.get("specialInstructions") or payload.get("special_instructions")

        db = get_db()
        menu = db.execute("SELECT * FROM menu_items WHERE id = ?", (int(menu_id),)).fetchone()
        if not menu:
            return api_error("Блюдо не найдено", 404)

        if not meal_type:
            meal_type = menu["meal_type"]

        total_price = float(menu["price"]) * quantity_i
        status = payload.get("status") or "pending"

        if status not in ("pending", "paid", "preparing", "ready", "received", "cancelled"):
            return api_error("Некорректный status", 400)

        now = utcnow_iso()
        cur = db.execute(
            """INSERT INTO orders (student_id, menu_item_id, order_date, meal_type, quantity, total_price, status, payment_type,
                                 subscription_id, special_instructions, received_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                int(student_id),
                int(menu_id),
                order_date,
                meal_type,
                quantity_i,
                total_price,
                status,
                payment_type,
                payload.get("subscriptionId"),
                special,
                payload.get("receivedAt"),
                now,
            ),
        )
        order_id = cur.lastrowid
        db.commit()

        _create_notification(
            db,
            user_id=int(student_id),
            n_type="order",
            title="Новый заказ",
            message=f"Ваш заказ '{menu['name']}' принят",
            link=f"/student.html",
        )

        row = db.execute(
            "SELECT o.*, u.full_name AS student_name, u.class AS student_class, m.name AS menu_name FROM orders o JOIN users u ON u.id=o.student_id JOIN menu_items m ON m.id=o.menu_item_id WHERE o.id = ?",
            (order_id,),
        ).fetchone()

        return jsonify({"ok": True, "order": order_row_to_api(row)})

    @app.put("/api/orders/<int:order_id>")
    def api_update_order(order_id: int):
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error("Нет данных для обновления", 400)

        allowed_map = {
            "status": "status",
            "receivedAt": "received_at",
            "specialInstructions": "special_instructions",
            "paymentType": "payment_type",
            "subscriptionId": "subscription_id",
        }

        sets: list[str] = []
        params: list[Any] = []

        for key, col in allowed_map.items():
            if key not in payload:
                continue
            val = payload.get(key)

            if col == "status":
                if val not in ("pending", "paid", "preparing", "ready", "received", "cancelled"):
                    return api_error("Некорректный status", 400)
            if col == "payment_type":
                if val not in ("one_time", "subscription"):
                    return api_error("paymentType must be one_time|subscription", 400)

            sets.append(f"{col} = ?")
            params.append(val)

        if not sets:
            return api_error("Нет поддерживаемых полей", 400)

        params.append(order_id)

        db = get_db()
        old = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        if not old:
            return api_error("Заказ не найден", 404)

        db.execute(f"UPDATE orders SET {', '.join(sets)} WHERE id = ?", params)
        db.commit()

        new = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()

        if payload.get("status") == "received" and old["status"] != "received":
            _create_notification(
                db,
                user_id=int(new["student_id"]),
                n_type="order",
                title="Заказ получен",
                message="Ваш заказ был успешно получен",
                link="/student.html",
            )

        row = db.execute(
            "SELECT o.*, u.full_name AS student_name, u.class AS student_class, m.name AS menu_name FROM orders o JOIN users u ON u.id=o.student_id JOIN menu_items m ON m.id=o.menu_item_id WHERE o.id = ?",
            (order_id,),
        ).fetchone()

        return jsonify({"ok": True, "order": order_row_to_api(row)})


    # ---- API: inventory ----
    def _compute_stock_status(quantity: float, min_quantity: float) -> str:
        if quantity <= 0:
            return 'out_of_stock'
        if min_quantity is not None and quantity <= min_quantity:
            return 'low_stock'
        return 'in_stock'

    @app.get('/api/inventory')
    def api_get_inventory():
        status = request.args.get('status')
        q = (request.args.get('q') or '').strip().lower()

        db = get_db()
        sql = 'SELECT * FROM inventory WHERE 1=1'
        params: list[Any] = []

        if status:
            sql += ' AND status = ?'
            params.append(status)

        if q:
            like = f"%{q}%"
            sql += " AND (LOWER(product_name) LIKE ? OR LOWER(COALESCE(category, '')) LIKE ? OR LOWER(COALESCE(supplier, '')) LIKE ?)"
            params.extend([like, like, like])

        sql += ' ORDER BY product_name COLLATE NOCASE, id'
        rows = db.execute(sql, params).fetchall()
        return jsonify({'ok': True, 'inventory': [inventory_row_to_api(r) for r in rows]})

    @app.post('/api/inventory')
    def api_add_inventory():
        payload = request.get_json(silent=True) or {}
        product_name = (payload.get('productName') or payload.get('name') or payload.get('product_name') or '').strip()
        if not product_name:
            return api_error('productName required', 400)

        category = payload.get('category')
        unit = payload.get('unit') or 'шт'

        qty = payload.get('quantity')
        if qty is None:
            qty = payload.get('currentStock')

        min_qty = payload.get('minQuantity')
        if min_qty is None:
            min_qty = payload.get('minStock')

        exp = payload.get('expirationDate') or payload.get('expiryDate') or payload.get('expiration_date')
        supplier = payload.get('supplier')

        try:
            qty_f = float(qty)
        except Exception:
            return api_error('quantity must be number', 400)

        try:
            min_qty_f = float(min_qty) if min_qty is not None else max(qty_f * 0.3, 0)
        except Exception:
            return api_error('minQuantity must be number', 400)

        status = payload.get('status')
        if status not in (None, '', 'in_stock', 'low_stock', 'out_of_stock'):
            return api_error('status must be in_stock|low_stock|out_of_stock', 400)
        status = status or _compute_stock_status(qty_f, min_qty_f)

        now = utcnow_iso()
        today = today_str()
        db = get_db()
        cur = db.execute(
            'INSERT INTO inventory (product_name, category, quantity, unit, min_quantity, expiration_date, supplier, last_restocked, status, created_at, updated_at) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (product_name, category, qty_f, unit, min_qty_f, exp, supplier, today, status, now, now),
        )
        db.commit()

        row = db.execute('SELECT * FROM inventory WHERE id = ?', (cur.lastrowid,)).fetchone()
        return jsonify({'ok': True, 'item': inventory_row_to_api(row)})

    @app.put('/api/inventory/<int:item_id>')
    def api_update_inventory(item_id: int):
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error('Нет данных для обновления', 400)

        db = get_db()
        old = db.execute('SELECT * FROM inventory WHERE id = ?', (item_id,)).fetchone()
        if not old:
            return api_error('Позиция не найдена', 404)

        allowed_map = {
            'productName': 'product_name',
            'name': 'product_name',
            'product_name': 'product_name',
            'category': 'category',
            'quantity': 'quantity',
            'currentStock': 'quantity',
            'unit': 'unit',
            'minQuantity': 'min_quantity',
            'minStock': 'min_quantity',
            'expirationDate': 'expiration_date',
            'expiryDate': 'expiration_date',
            'expiration_date': 'expiration_date',
            'supplier': 'supplier',
            'status': 'status',
            'lastRestocked': 'last_restocked',
            'last_restocked': 'last_restocked',
        }

        sets: list[str] = []
        params: list[Any] = []

        qty_new = None
        min_new = None
        status_provided = False

        for key, col in allowed_map.items():
            if key not in payload:
                continue
            val = payload.get(key)

            if col == 'product_name':
                val = (val or '').strip()
                if not val:
                    return api_error('productName required', 400)

            if col in ('quantity', 'min_quantity'):
                try:
                    val = float(val)
                except Exception:
                    return api_error(f"{key} must be number", 400)
                if col == 'quantity':
                    qty_new = val
                if col == 'min_quantity':
                    min_new = val

            if col == 'status':
                status_provided = True
                if val not in ('in_stock', 'low_stock', 'out_of_stock'):
                    return api_error('status must be in_stock|low_stock|out_of_stock', 400)

            sets.append(f"{col} = ?")
            params.append(val)

        if not sets:
            return api_error('Нет поддерживаемых полей', 400)

        qty_eff = float(qty_new) if qty_new is not None else float(old['quantity'])
        min_eff = float(min_new) if min_new is not None else float(old['min_quantity'])

        # Recompute status if stock-related fields changed and status wasn't explicitly set.
        if (qty_new is not None or min_new is not None) and not status_provided:
            sets.append('status = ?')
            params.append(_compute_stock_status(qty_eff, min_eff))

        if qty_new is not None and 'lastRestocked' not in payload and 'last_restocked' not in payload:
            sets.append('last_restocked = ?')
            params.append(today_str())

        sets.append('updated_at = ?')
        params.append(utcnow_iso())

        params.append(item_id)
        db.execute(f"UPDATE inventory SET {', '.join(sets)} WHERE id = ?", params)
        db.commit()

        row = db.execute('SELECT * FROM inventory WHERE id = ?', (item_id,)).fetchone()
        return jsonify({'ok': True, 'item': inventory_row_to_api(row)})

    @app.delete('/api/inventory/<int:item_id>')
    def api_delete_inventory(item_id: int):
        db = get_db()
        row = db.execute('SELECT id FROM inventory WHERE id = ?', (item_id,)).fetchone()
        if not row:
            return api_error('Позиция не найдена', 404)

        db.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
        db.commit()
        return jsonify({'ok': True, 'deleted': True})

    # ---- API: purchase requests ----
    @app.get("/api/purchase_requests")
    def api_get_purchase_requests():
        status = request.args.get("status")
        cook_id = request.args.get("cookId")

        db = get_db()
        sql = (
            "SELECT pr.*, u.full_name AS cook_name "
            "FROM purchase_requests pr "
            "JOIN users u ON u.id = pr.cook_id "
            "WHERE 1=1"
        )
        params: list[Any] = []

        if status:
            sql += " AND pr.status = ?"
            params.append(status)

        if cook_id:
            sql += " AND pr.cook_id = ?"
            params.append(int(cook_id))

        sql += " ORDER BY pr.created_at DESC, pr.id DESC"

        rows = db.execute(sql, params).fetchall()
        return jsonify({"ok": True, "requests": [purchase_row_to_api(r) for r in rows]})

    @app.post("/api/purchase_requests")
    def api_add_purchase_request():
        payload = request.get_json(silent=True) or {}
        cook_id = payload.get("cookId") or payload.get("cook_id")
        product = (payload.get("product") or payload.get("productName") or payload.get("product_name") or "").strip()
        quantity = payload.get("quantity")
        unit = payload.get("unit") or "шт"

        if not cook_id or not product or quantity is None:
            return api_error("cookId, product, quantity required", 400)

        try:
            qty_f = float(quantity)
        except Exception:
            return api_error("quantity must be number", 400)

        reason = payload.get("reason")
        urgency = payload.get("urgency") or "medium"
        if urgency not in ("low", "medium", "high"):
            return api_error("urgency must be low|medium|high", 400)

        now = utcnow_iso()
        db = get_db()

        cur = db.execute(
            """INSERT INTO purchase_requests (cook_id, product_name, quantity, unit, reason, urgency, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (int(cook_id), product, qty_f, unit, reason, urgency, now),
        )
        req_id = cur.lastrowid
        db.commit()

        admins = db.execute("SELECT id FROM users WHERE role='admin' AND is_active=1").fetchall()
        for a in admins:
            _create_notification(
                db,
                user_id=int(a["id"]),
                n_type="warning",
                title="Новая заявка на закупку",
                message=f"Повар подал заявку на {product}",
                link="/admin.html",
            )

        row = db.execute(
            "SELECT pr.*, u.full_name AS cook_name FROM purchase_requests pr JOIN users u ON u.id = pr.cook_id WHERE pr.id = ?",
            (req_id,),
        ).fetchone()
        return jsonify({"ok": True, "request": purchase_row_to_api(row)})

    @app.put("/api/purchase_requests/<int:req_id>")
    def api_update_purchase_request(req_id: int):
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error("Нет данных для обновления", 400)

        allowed_map = {
            "status": "status",
            "adminId": "admin_id",
            "adminNotes": "admin_notes",
            "approvedAt": "approved_at",
            "completedAt": "completed_at",
        }

        sets: list[str] = []
        params: list[Any] = []

        for key, col in allowed_map.items():
            if key not in payload:
                continue
            val = payload.get(key)

            if col == "status":
                if val not in ("pending", "approved", "rejected", "completed"):
                    return api_error("Некорректный status", 400)
            if col == "admin_id":
                val = int(val) if val not in (None, "") else None

            sets.append(f"{col} = ?")
            params.append(val)

        if not sets:
            return api_error("Нет поддерживаемых полей", 400)

        db = get_db()
        old = db.execute("SELECT * FROM purchase_requests WHERE id = ?", (req_id,)).fetchone()
        if not old:
            return api_error("Заявка не найдена", 404)

        params.append(req_id)
        db.execute(f"UPDATE purchase_requests SET {', '.join(sets)} WHERE id = ?", params)
        db.commit()

        new = db.execute("SELECT * FROM purchase_requests WHERE id = ?", (req_id,)).fetchone()

        if "status" in payload and payload["status"] != old["status"]:
            status_text = {
                "pending": "в ожидании",
                "approved": "одобрена",
                "rejected": "отклонена",
                "completed": "выполнена",
            }.get(payload["status"], payload["status"])

            _create_notification(
                db,
                user_id=int(new["cook_id"]),
                n_type="system",
                title="Статус заявки изменен",
                message=f"Ваша заявка на {new['product_name']} была {status_text}",
                link="/cook.html",
            )

        row = db.execute(
            "SELECT pr.*, u.full_name AS cook_name FROM purchase_requests pr JOIN users u ON u.id = pr.cook_id WHERE pr.id = ?",
            (req_id,),
        ).fetchone()

        return jsonify({"ok": True, "request": purchase_row_to_api(row)})

    # ---- API: notifications ----
    @app.get("/api/notifications")
    def api_get_notifications():
        user_id = request.args.get("userId")
        unread_only = request.args.get("unreadOnly")

        if not user_id:
            return api_error("userId required", 400)

        unread = str(unread_only).lower() in ("1", "true", "yes")

        db = get_db()
        if unread:
            rows = db.execute(
                "SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 10",
                (int(user_id),),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
                (int(user_id),),
            ).fetchall()

        return jsonify({"ok": True, "notifications": [notification_row_to_api(r) for r in rows]})

    @app.post("/api/notifications")
    def api_add_notification():
        payload = request.get_json(silent=True) or {}
        user_id = payload.get("userId")
        n_type = payload.get("type") or "info"
        title = payload.get("title")
        message = payload.get("message")
        link = payload.get("link")

        if not user_id or not title or not message:
            return api_error("userId, title, message required", 400)

        if n_type not in ("order", "payment", "system", "warning", "info"):
            n_type = "info"

        db = get_db()
        _create_notification(db, int(user_id), n_type, title, message, link)

        row = db.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1",
            (int(user_id),),
        ).fetchone()

        return jsonify({"ok": True, "notification": notification_row_to_api(row)})

    @app.post("/api/notifications/<int:notif_id>/read")
    def api_mark_notification_read(notif_id: int):
        db = get_db()
        row = db.execute("SELECT * FROM notifications WHERE id = ?", (notif_id,)).fetchone()
        if not row:
            return api_error("Уведомление не найдено", 404)
        db.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        db.commit()
        row2 = db.execute("SELECT * FROM notifications WHERE id = ?", (notif_id,)).fetchone()
        return jsonify({"ok": True, "notification": notification_row_to_api(row2)})

    # ---- API: settings ----
    @app.get("/api/settings")
    def api_get_settings():
        db = get_db()
        row = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if not row:
            now = utcnow_iso()
            db.execute("INSERT INTO settings (id, updated_at) VALUES (1, ?)", (now,))
            db.commit()
            row = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()

        return jsonify({"ok": True, "settings": settings_row_to_api(row)})

    @app.put("/api/settings")
    def api_update_settings():
        payload = request.get_json(silent=True) or {}
        if not payload:
            return api_error("Нет данных", 400)

        school_name = payload.get("schoolName") or payload.get("school_name")

        work_start = payload.get("workStart")
        work_end = payload.get("workEnd")

        if (not work_start or not work_end) and isinstance(payload.get("workHours"), dict):
            work_start = work_start or payload["workHours"].get("start")
            work_end = work_end or payload["workHours"].get("end")

        min_balance = payload.get("minBalance")
        notifications_enabled = payload.get("notificationsEnabled")
        email_notifications = payload.get("emailNotifications")
        order_notifications = payload.get("orderNotifications")
        low_stock_notifications = payload.get("lowStockNotifications")

        db = get_db()
        row = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        if not row:
            db.execute("INSERT INTO settings (id, updated_at) VALUES (1, ?)", (utcnow_iso(),))
            db.commit()

        sets = []
        params: list[Any] = []

        def set_if(key: str, value: Any):
            if value is None:
                return
            sets.append(f"{key} = ?")
            params.append(value)

        set_if("school_name", school_name)
        set_if("work_start", work_start)
        set_if("work_end", work_end)

        if min_balance is not None:
            try:
                set_if("min_balance", int(min_balance))
            except Exception:
                return api_error("minBalance must be integer", 400)

        if notifications_enabled is not None:
            set_if("notifications_enabled", 1 if bool(notifications_enabled) else 0)
        if email_notifications is not None:
            set_if("email_notifications", 1 if bool(email_notifications) else 0)
        if order_notifications is not None:
            set_if("order_notifications", 1 if bool(order_notifications) else 0)
        if low_stock_notifications is not None:
            set_if("low_stock_notifications", 1 if bool(low_stock_notifications) else 0)

        set_if("updated_at", utcnow_iso())

        if not sets:
            return api_error("Нет поддерживаемых полей", 400)

        params.append(1)
        db.execute(f"UPDATE settings SET {', '.join(sets)} WHERE id = ?", params)
        db.commit()

        row2 = db.execute("SELECT * FROM settings WHERE id = 1").fetchone()
        return jsonify({"ok": True, "settings": settings_row_to_api(row2)})

    # ---- API: statistics ----
    @app.get("/api/statistics")
    def api_statistics():
        db = get_db()
        total_students = db.execute("SELECT COUNT(1) FROM users WHERE role='student' AND is_active=1").fetchone()[0]
        total_orders = db.execute("SELECT COUNT(1) FROM orders").fetchone()[0]
        total_revenue = db.execute("SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE status IN ('paid','received')").fetchone()[0]

        today = today_str()
        today_attendance = db.execute(
            "SELECT COUNT(1) FROM orders WHERE order_date = ? AND status = 'received'",
            (today,),
        ).fetchone()[0]

        pending_requests = db.execute("SELECT COUNT(1) FROM purchase_requests WHERE status = 'pending'").fetchone()[0]

        return jsonify({
            "ok": True,
            "statistics": {
                "totalStudents": int(total_students),
                "totalOrders": int(total_orders),
                "totalRevenue": float(total_revenue or 0),
                "todayAttendance": int(today_attendance),
                "pendingRequests": int(pending_requests),
            },
        })

    # ---- Frontend serving ----
    @app.get("/")
    def serve_index():
        return send_from_directory(app.config["FRONTEND_DIR"], "index.html")

    @app.get("/<path:filename>")
    def serve_frontend(filename: str):
        # API paths are handled by explicit routes above.
        return send_from_directory(app.config["FRONTEND_DIR"], filename)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
