// ============================================================
//  api.js — PERGAMING — VERSIÓN FINAL CON MANEJO ROBUSTO
// ============================================================

const BASE_URL = "https://e-commerce-perifericos-backend.onrender.com";

export function getToken() { return localStorage.getItem("access_token"); }
export function isLoggedIn() { return !!getToken(); }

export function saveTokens({ access, refresh }) {
    localStorage.setItem("access_token", access);
    if (refresh) localStorage.setItem("refresh_token", refresh);
}
export function clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
}

async function handle(res) {
    // Si el token expiró, refrescar
    if (res.status === 401) {
        const refresh = localStorage.getItem("refresh_token");
        if (refresh) {
            try {
                const refreshRes = await fetch(`${BASE_URL}/auth/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh })
                });
                if (refreshRes.ok) {
                    const tokens = await refreshRes.json();
                    saveTokens(tokens);
                    window.location.reload();
                    return;
                }
            } catch(e) {}
        }
        clearTokens();
        window.dispatchEvent(new Event("sesion-expirada"));
        throw new Error("Sesión expirada. Inicie sesión nuevamente.");
    }

    const ct = res.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) {
        data = await res.json().catch(() => ({}));
        if (!res.ok) {
            let errorMsg = data.error || data.detail || "Error del servidor";
            if (typeof data === 'object') {
                const firstKey = Object.keys(data)[0];
                if (firstKey && data[firstKey]) {
                    errorMsg = `${firstKey}: ${Array.isArray(data[firstKey]) ? data[firstKey].join(", ") : data[firstKey]}`;
                }
            }
            throw new Error(errorMsg);
        }
        return data;
    }
    if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
    return data;
}

export async function login(username, password) {
    const res = await fetch(`${BASE_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    const data = await handle(res);
    saveTokens(data);
    return data;
}

export function logout() { clearTokens(); }

export async function registrarUsuario({ username, email, name, last_name, password, security_questions }) {
    const res = await fetch(`${BASE_URL}/usuario/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, name, last_name, password, security_questions }),
    });
    return handle(res);
}

export async function verificarRespuestasSeguridad(username, respuestas) {
    const res = await fetch(`${BASE_URL}/usuario/verify_security_answers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, respuestas }),
    });
    return handle(res);
}

export async function cambiarContrasena(username, new_password) {
    const res = await fetch(`${BASE_URL}/usuario/change_password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, new_password }),
    });
    return handle(res);
}

// ---------- PRODUCTOS ----------
export async function getProductos(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.categoria) q.set("categoria", params.categoria); // ahora espera un ID numérico
    const res = await fetch(`${BASE_URL}/products/products/?${q}`);
    return handle(res);
}

export async function getCategorias() {
    const res = await fetch(`${BASE_URL}/products/product_category/`);
    return handle(res);
}

export async function getAssets() {
    const res = await fetch(`${BASE_URL}/assets/assets/`);
    return handle(res);
}

// ---------- CARRITO ----------
export async function getCarrito() {
    const res = await fetch(`${BASE_URL}/carts/my_cart/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    return handle(res);
}
export async function agregarAlCarrito(product_id, quantity = 1) {
    const res = await fetch(`${BASE_URL}/carts/add_item/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id, quantity }),
    });
    return handle(res);
}
export async function quitarDelCarrito(product_id) {
    const res = await fetch(`${BASE_URL}/carts/remove_item/`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id }),
    });
    return handle(res);
}

// ---------- ÓRDENES ----------
export async function hacerCheckout(shippingData) {
    const res = await fetch(`${BASE_URL}/orders/checkout/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(shippingData),
    });
    return handle(res);
}
export async function getMisOrdenes() {
    const res = await fetch(`${BASE_URL}/orders/my_orders/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    return handle(res);
}
export async function confirmarTransferencia(orderId) {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/confirmar_transferencia/`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });
    return handle(res);
}
export async function cancelarOrden(orderId, cancel_reason) {
    const res = await fetch(`${BASE_URL}/orders/${orderId}/cancelar/`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_reason }),
    });
    return handle(res);
}

// ---------- CONTACTO ----------
export async function enviarConsulta({ nombre, email, mensaje }) {
    const res = await fetch(`${BASE_URL}/consulta/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, mensaje }),
    });
    return handle(res);
}