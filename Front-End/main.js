// ============================================================
//  main.js — PERGAMING — VERSIÓN COMPLETA CON FILTRADO POR ID
//  y órdenes más recientes primero
// ============================================================

import {
    login, logout, isLoggedIn, registrarUsuario,
    verificarRespuestasSeguridad, cambiarContrasena,
    getProductos, getCategorias, getAssets,
    getCarrito, agregarAlCarrito, quitarDelCarrito,
    hacerCheckout, getMisOrdenes, confirmarTransferencia, cancelarOrden,
    enviarConsulta,
} from "./api.js";

const STORE = {
    cbu:    "0000003100012345678901",
    alias:  "PERGAMING.VENTAS",
    email:  "pergamingventas@gmail.com",
    soporte:"pergamingventas@gmail.com",
};

let productosCache  = [];
let categoriasCache = [];
let categoriaMap    = {};
let recoveryState = { username: null };

// ---------- UTILIDADES UI ----------
function toast(msg, tipo = "ok") {
    const t = document.createElement("div");
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function spinnerOn(btn) {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.orig = btn.textContent;
    btn.textContent = "...";
}
function spinnerOff(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = btn.dataset.orig || btn.textContent;
}

function abrirModal(id) { document.getElementById(id)?.classList.add("activo"); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove("activo"); }

document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.classList.remove("activo");
});

// ---------- NAVBAR ----------
function actualizarNavbar() {
    const logged = isLoggedIn();
    document.getElementById("nav-login")?.classList.toggle("hidden", logged);
    document.getElementById("nav-register")?.classList.toggle("hidden", logged);
    document.getElementById("nav-logout")?.classList.toggle("hidden", !logged);
    document.getElementById("nav-carrito")?.classList.toggle("hidden", !logged);
    document.getElementById("nav-ordenes")?.classList.toggle("hidden", !logged);
}

// ---------- ASSETS ----------
async function cargarAssets() {
    try {
        const assets = await getAssets();
        const logo = assets.find(a => a.name?.toLowerCase().includes("logo"));
        if (logo) document.querySelectorAll(".logo-dinamico").forEach(el => el.src = logo.image);
    } catch (_) {}
}

// ---------- CATEGORÍAS ----------
async function cargarCategorias() {
    try {
        const cats = await getCategorias();
        categoriasCache = cats;
        categoriaMap = {};
        cats.forEach(c => {
            categoriaMap[c.description] = c.id;
        });
        const select = document.getElementById("filtro-select");
        if (select) {
            select.innerHTML = '<option value="">Todos los productos</option>';
            cats.forEach(c => {
                const option = document.createElement("option");
                option.value = c.description;
                option.textContent = c.description;
                select.appendChild(option);
            });
        }
    } catch (e) { console.error("Error cargando categorías:", e); }
}

// ---------- PRODUCTOS ----------
function renderProductos(lista) {
    const cont = document.getElementById("lista-productos");
    if (!cont) return;
    if (!lista.length) {
        cont.innerHTML = `<p class="sin-resultados">No se encontraron productos en esta categoría.</p>`;
        return;
    }
    cont.innerHTML = lista.map(p => `
        <div class="producto-card" data-id="${p.id}">
            <img src="${p.product_image || './imgs/mouse.webp'}" alt="${p.name}" onerror="this.src='./imgs/mouse.webp'">
            <div class="producto-info">
                <h3>${p.name}</h3>
                <p class="producto-desc">${p.description}</p>
                <span class="producto-precio">$${Number(p.price).toLocaleString("es-AR")}</span>
                <span class="producto-stock ${p.stock === 0 ? 'sin-stock' : ''}">${p.stock > 0 ? `Stock: ${p.stock}` : "Sin stock"}</span>
                <div class="qty-wrapper">
                    ${p.stock > 0 ? `<input type="number" id="qty-${p.id}" value="1" min="1" max="${p.stock}" title="Cantidad">` : ""}
                    <button class="btn btn-agregar" data-id="${p.id}" ${p.stock === 0 ? "disabled" : ""}>${p.stock > 0 ? "Agregar" : "Sin stock"}</button>
                </div>
                <button class="btn-ver-mas" data-id="${p.id}" style="margin-top:8px; background:none; border:1px solid #7b2cbf; color:#7b2cbf; padding:5px 14px; border-radius:4px; cursor:pointer; font-size:0.82rem; width:100%;">Ver más</button>
            </div>
        </div>`).join("");

    cont.querySelectorAll(".btn-agregar").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!isLoggedIn()) { toast("Iniciá sesión para comprar", "warn"); abrirModal("modal-login"); return; }
            const qtyInput = document.getElementById(`qty-${btn.dataset.id}`);
            const qty = qtyInput ? Math.max(1, Number(qtyInput.value) || 1) : 1;
            spinnerOn(btn);
            try {
                await agregarAlCarrito(Number(btn.dataset.id), qty);
                toast(`${qty > 1 ? qty + "x p" : "P"}roducto${qty > 1 ? "s" : ""} agregado${qty > 1 ? "s" : ""} ✓`);
                await actualizarContadorCarrito();
            } catch (e) { toast(e.message, "error"); }
            finally { spinnerOff(btn); }
        });
    });

    cont.querySelectorAll(".btn-ver-mas").forEach(btn => {
        btn.addEventListener("click", () => {
            const prod = productosCache.find(p => String(p.id) === String(btn.dataset.id));
            if (!prod) return;
            document.getElementById("detalle-img").src = prod.product_image || './imgs/mouse.webp';
            document.getElementById("detalle-img").alt = prod.name;
            document.getElementById("detalle-nombre").textContent = prod.name;
            document.getElementById("detalle-precio").textContent = `$${Number(prod.price).toLocaleString("es-AR")}`;
            document.getElementById("detalle-descripcion").textContent = prod.description || "Sin descripción.";
            document.getElementById("detalle-stock").textContent = prod.stock > 0 ? `Stock disponible: ${prod.stock}` : "Sin stock";
            abrirModal("modal-detalle-producto");
        });
    });
}

async function cargarProductos(params = {}) {
    const cont = document.getElementById("lista-productos");
    if (!cont) return;
    cont.innerHTML = `<p class="cargando">Cargando productos...</p>`;
    try {
        const data = await getProductos(params);
        productosCache = Array.isArray(data) ? data : [];
        renderProductos(productosCache);
    } catch (error) {
        console.error("Error en cargarProductos:", error);
        cont.innerHTML = `<p class="sin-resultados">No se pudieron cargar los productos.</p>`;
    }
}

let categoriaActivaId = null;

function filtrarPorCat(nombreCategoria) {
    if (!nombreCategoria || nombreCategoria === "") {
        categoriaActivaId = null;
    } else {
        const catId = categoriaMap[nombreCategoria];
        categoriaActivaId = catId || null;
    }
    aplicarFiltros();
}

function aplicarFiltros() {
    const busqueda = document.getElementById("busqueda")?.value.trim() || "";
    const params = {};
    if (busqueda) params.search = busqueda;
    if (categoriaActivaId !== null) params.categoria = categoriaActivaId;
    cargarProductos(params);
}

// ---------- CARRITO ----------
async function actualizarContadorCarrito() {
    if (!isLoggedIn()) return;
    try {
        const c = await getCarrito();
        const badge = document.getElementById("carrito-badge");
        if (!badge) return;
        if (Array.isArray(c)) {
            const totalItems = c.reduce((acc, item) => acc + Number(item.quantity || item.cantidad || 1), 0);
            badge.textContent = totalItems || "";
        } else {
            badge.textContent = c?.total_items || c?.cantidad_total || "";
        }
    } catch (_) {}
}

async function renderCarrito() {
    const cont    = document.getElementById("carrito-items");
    const totalEl = document.getElementById("carrito-total");
    if (!cont) return;

    if (!isLoggedIn()) {
        cont.innerHTML = `<p class="sin-resultados">Iniciá sesión para ver tu carrito.</p>`;
        if (totalEl) totalEl.textContent = "$0";
        return;
    }

    cont.innerHTML = `<p class="cargando">Cargando...</p>`;
    try {
        const carrito = await getCarrito();
        const items = Array.isArray(carrito) ? carrito : (carrito?.items || []);
        if (!items.length) {
            cont.innerHTML = `<p class="sin-resultados">Tu carrito está vacío.</p>`;
            if (totalEl) totalEl.textContent = "$0";
            return;
        }
        let totalCalculado = 0;
        cont.innerHTML = items.map(item => {
            const prod   = item.product || item.producto || {};
            const precio = Number(prod.price || prod.precio || 0);
            const nombre = prod.name || prod.nombre || "Producto";
            const img    = prod.product_image || prod.imagen || './imgs/mouse.webp';
            const qty    = Number(item.quantity || item.cantidad || 1);
            const sub    = Number(item.subtotal || (precio * qty));
            totalCalculado += sub;
            return `<div class="carrito-item">
                <img src="${img}" alt="${nombre}" onerror="this.src='./imgs/mouse.webp'">
                <div class="carrito-item-info">
                    <p>${nombre}</p>
                    <span>${qty} × $${precio.toLocaleString("es-AR")}</span>
                </div>
                <button class="btn-quitar-item" data-id="${prod.id || item.id}">✕</button>
            </div>`;
        }).join("");
        const totalFinal = (carrito && !Array.isArray(carrito) && carrito.total) ? Number(carrito.total) : totalCalculado;
        if (totalEl) totalEl.textContent = `$${totalFinal.toLocaleString("es-AR")}`;
        cont.dataset.total = totalFinal;
        cont.querySelectorAll(".btn-quitar-item").forEach(btn => {
            btn.addEventListener("click", async () => {
                spinnerOn(btn);
                try {
                    await quitarDelCarrito(Number(btn.dataset.id));
                    toast("Producto quitado");
                    await renderCarrito();
                    await actualizarContadorCarrito();
                } catch (e) { toast(e.message, "error"); }
                finally { spinnerOff(btn); }
            });
        });
    } catch (e) {
        console.error("Error detallado en renderCarrito:", e);
        if (e.message.includes("token not valid") || e.message.includes("not valid")) {
            cont.innerHTML = `
                <p class="sin-resultados" style="text-align:center; padding:20px;">
                    Tu sesión expiró. 
                    <a href="#" id="link-relogin-cart" style="color:#7b2cbf; font-weight:bold; text-decoration:underline;">Iniciá sesión acá</a> para ver tu carrito.
                </p>`;
            document.getElementById("link-relogin-cart")?.addEventListener("click", (ev) => {
                ev.preventDefault();
                cerrarModal("modal-carrito");
                abrirModal("modal-login");
            });
        } else {
            cont.innerHTML = `<p class="error-msg" style="color:#ef4444; font-size:0.9rem;">Error al cargar el carrito: ${e.message || "Problema de respuesta"}</p>`;
        }
    }
}

// ---------- CHECKOUT ----------
function abrirFormularioPago() {
    cerrarModal("modal-carrito");
    const divInfo = document.getElementById("checkout-info-bancaria");
    if (divInfo) {
        divInfo.innerHTML = `
            <div class="checkout-alerta-banco" style="background:#111827; border:1px solid #4b5563; padding:12px; border-radius:6px; margin-bottom:15px; color:#f3f4f6;">
                <p style="margin:0 0 6px 0; color:#10b981; font-weight:bold; font-size:0.95rem;">Datos de Transferencia:</p>
                <p style="margin:2px 0; font-size:0.85rem;"><strong>Alias:</strong> ${STORE.alias}</p>
                <p style="margin:2px 0; font-size:0.85rem;"><strong>CBU:</strong> ${STORE.cbu}</p>
                <p style="margin:2px 0; font-size:0.85rem;"><strong>Email de envío:</strong> ${STORE.email}</p>
            </div>
        `;
    }
    abrirModal("modal-checkout");
}

async function manejarConfirmarPago(e) {
    e.preventDefault();
    const btn  = e.target.querySelector("button[type=submit]");
    const el   = (id) => document.getElementById(id)?.value?.trim() || "";
    
    const method = el("delivery_method") || "envio";
    
    const shippingData = {
        shipping_name:      el("shipping_name"),
        shipping_last_name: el("shipping_last_name"),
        shipping_email:     el("shipping_email"),
        delivery_method:    method,
        shipping_address:   el("shipping_address"),
        transfer_confirmed: false,
    };

    if (!shippingData.shipping_name || !shippingData.shipping_last_name || !shippingData.shipping_email) {
        toast("Completá todos los datos personales básicos.", "warn");
        return;
    }
    
    if (method === "envio" && !shippingData.shipping_address) {
        toast("Completá tu dirección para el envío a domicilio.", "warn");
        return;
    }
    
    spinnerOn(btn);
    try {
        const orden = await hacerCheckout(shippingData);
        toast(`¡Pedido #${orden.id} registrado! Cuando transfieras, confírmalo en Mis Órdenes.`);
        document.getElementById("form-pago")?.reset();
        cerrarModal("modal-checkout");
        await actualizarContadorCarrito();
        await renderMisOrdenes();
        abrirModal("modal-ordenes");
    } catch (e) {
        toast(e.message || "Error al procesar el pedido.", "error");
    } finally {
        spinnerOff(btn);
    }
}

// ---------- MIS ÓRDENES (con orden descendente por fecha) ----------
const ESTADO_LABELS = {
    PENDIENTE:  "⏳ Pendiente de pago",
    PAGADO:     "✅ Pago confirmado",
    VIAJE:      "🚚 En camino",
    ENTREGADO:  "📦 Entregado",
    CANCELADO:  "❌ Cancelado",
    RECHAZADO:  "🚫 Rechazado",
};
const ESTADO_CLASES = {
    PENDIENTE: "estado-pendiente",
    PAGADO:    "estado-pagado",
    VIAJE:     "estado-viaje",
    ENTREGADO: "estado-entregado",
    CANCELADO: "estado-cancelado",
    RECHAZADO: "estado-rechazado",
};

async function renderMisOrdenes() {
    const cont = document.getElementById("ordenes-lista");
    if (!cont) return;
    cont.innerHTML = `<p class="cargando">Cargando pedidos...</p>`;
    try {
        let ordenes = await getMisOrdenes();
        if (Array.isArray(ordenes) && ordenes.length) {
            ordenes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        if (!ordenes.length) {
            cont.innerHTML = `<p class="sin-resultados">Todavía no realizaste ninguna compra.</p>`;
            return;
        }
        cont.innerHTML = ordenes.map(o => {
            const esPendiente = o.status === 'PENDIENTE';
            const esPagado    = o.status === 'PAGADO';
            return `
            <div class="orden-card" data-id="${o.id}">
                <div class="orden-header">
                    <span class="orden-id">Pedido #${o.id}</span>
                    <span class="orden-estado ${ESTADO_CLASES[o.status] || ''}">${ESTADO_LABELS[o.status] || o.status}</span>
                    <span class="orden-fecha">${o.created_at ? new Date(o.created_at).toLocaleDateString("es-AR") : ""}</span>
                </div>
                <div class="orden-envio">
                    <!-- MODIFICADO: Normalizamos a minúsculas con .toLowerCase() para evitar errores de case-sensitivity -->
                    <strong>Método:</strong> ${o.delivery_method?.toLowerCase() === 'retiro' ? 'Retiro en sucursal' : 'Envío a domicilio'}<br>
                    <strong>A nombre de:</strong> ${o.shipping_name} ${o.shipping_last_name}
                    ${o.delivery_method?.toLowerCase() !== 'retiro' && o.shipping_address ? `<br><strong>Dirección:</strong> ${o.shipping_address}` : ''}
                </div>
                <ul class="orden-items">
                    ${(o.items || []).map(i => `<li>${i.quantity} × ${i.product_name} — $${Number(i.price).toLocaleString("es-AR")}</li>`).join("")}
                </ul>
                <div class="orden-total">Total: <strong>$${Number(o.total || 0).toLocaleString("es-AR")}</strong></div>
                ${o.cancel_reason ? `<p class="orden-motivo">Motivo: ${o.cancel_reason}</p>` : ""}
                <div class="orden-acciones">
                    ${esPendiente ? `
                        <div style="background:#1e1b4b; border:1px solid #3730a3; padding:10px; border-radius:4px; margin-bottom:10px; font-size:0.8rem;">
                            <p style="margin:0 0 4px 0; color:#c7d2fe;"><strong>Instrucciones de Pago:</strong></p>
                            Transferí al Alias: <strong style="color:#fff;">${STORE.alias}</strong><br>
                            CBU: <strong style="color:#fff;">${STORE.cbu}</strong><br>
                            Enviá el comprobante a: <strong style="color:#fff;">${STORE.email}</strong>
                        </div>
                        ${!o.transfer_confirmed ? `
                        <button class="btn-confirmar-transferencia" data-order-id="${o.id}">
                            ✔ Ya realicé la transferencia
                        </button>` : `<p style="color:#10b981; font-size:0.85rem; font-weight:bold; margin-bottom:8px;">⏳ Transferencia ya informada. Esperando validación.</p>`}
                        <button class="btn-cancelar-orden" data-order-id="${o.id}">
                            ✕ Cancelar pedido
                        </button>
                    ` : ""}
                    ${esPagado ? `
                        <button class="btn-solicitar-devolucion" data-order-id="${o.id}">
                            ↩ Solicitar devolución
                        </button>
                    ` : ""}
                </div>
            </div>`;
        }).join("");
        cont.querySelectorAll(".btn-confirmar-transferencia").forEach(btn => btn.addEventListener("click", () => manejarConfirmarTransferencia(btn.dataset.orderId)));
        cont.querySelectorAll(".btn-cancelar-orden").forEach(btn => btn.addEventListener("click", () => abrirModalCancelacion(btn.dataset.orderId)));
        cont.querySelectorAll(".btn-solicitar-devolucion").forEach(btn => btn.addEventListener("click", () => abrirModalCancelacion(btn.dataset.orderId)));
    } catch (e) {
        cont.innerHTML = `<p class="error-msg">Error al cargar los pedidos.</p>`;
    }
}

async function manejarConfirmarTransferencia(orderId) {
    if (!confirm("¿Confirmás que ya realizaste la transferencia bancaria?")) return;
    try {
        await confirmarTransferencia(orderId);
        toast("¡Transferencia informada! Validaremos tu pago a la brevedad.");
        await renderMisOrdenes();
    } catch (e) {
        toast(e.message || "Error al informar la transferencia.", "error");
    }
}

function abrirModalCancelacion(orderId) {
    const modal = document.getElementById("modal-cancelacion");
    if (!modal) {
        const motivo = prompt("¿Por qué querés cancelar el pedido?");
        if (!motivo?.trim()) return;
        ejecutarCancelacion(orderId, motivo.trim());
        return;
    }
    modal.dataset.orderId = orderId;
    document.getElementById("cancelacion-motivo")?.focus();
    abrirModal("modal-cancelacion");
}

async function ejecutarCancelacion(orderId, motivo) {
    try {
        await cancelarOrden(orderId, motivo);
        toast("Pedido cancelado correctamente.");
        cerrarModal("modal-cancelacion");
        await renderMisOrdenes();
    } catch (e) {
        toast(e.message || "Error al cancelar el pedido.", "error");
    }
}

// ---------- LOGIN ----------
async function manejarLogin(e) {
    e.preventDefault();
    const btn      = e.target.querySelector("button[type=submit]");
    const username = document.getElementById("login-username")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    if (!username || !password) return toast("Completá usuario y contraseña.", "warn");
    spinnerOn(btn);
    try {
        await login(username, password);
        cerrarModal("modal-login");
        actualizarNavbar();
        await actualizarContadorCarrito();
        toast(`Bienvenido, ${username} 👾`);
    } catch (e) {
        const msg = e.message || "";
        if (msg.toLowerCase().includes("locked") || msg.toLowerCase().includes("bloqueado") || msg.toLowerCase().includes("too many")) {
            toast("Cuenta bloqueada temporalmente. Esperá unos minutos o comunicate mediante la ventana de contacto.", "error");
        } else {
            toast("Usuario o contraseña incorrectos. Intentá nuevamente.", "error");
        }
    }
    finally { spinnerOff(btn); }
}

// ---------- REGISTRO ----------
async function manejarRegistro(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");

    const password = document.getElementById("reg-password")?.value;
    const passwordConfirm = document.getElementById("reg-password-confirm")?.value;
    if (password !== passwordConfirm) {
        return toast("Las contraseñas no coinciden.", "warn");
    }

    const respuesta1 = document.getElementById("reg-q1-answer")?.value?.trim() || "";
    const respuesta2 = document.getElementById("reg-q2-answer")?.value?.trim() || "";
    const respuesta3 = document.getElementById("reg-q3-answer")?.value?.trim() || "";

    if (!respuesta1 || !respuesta2 || !respuesta3) {
        return toast("Por favor, respondé todas las preguntas de seguridad.", "warn");
    }

    const security_questions = [
        { question: "mascota", answer: respuesta1 },
        { question: "ciudad",  answer: respuesta2 },
        { question: "madre",   answer: respuesta3 }
    ];

    const data = {
        username:   document.getElementById("reg-username")?.value.trim(),
        email:      document.getElementById("reg-email")?.value.trim(),
        name:       document.getElementById("reg-name")?.value.trim(),
        last_name:  document.getElementById("reg-lastname")?.value.trim(),
        password:   password,
        security_questions: security_questions,
    };

    spinnerOn(btn);
    try {
        await registrarUsuario(data);
        toast("¡Cuenta creada! Ya podés iniciar sesión.");
        cerrarModal("modal-register");
        abrirModal("modal-login");
    } catch (e) {
        console.error("Error detallado:", e);
        toast(e.message || "Error al registrarse.", "error");
    } finally {
        spinnerOff(btn);
    }
}

// ---------- RECUPERACIÓN ----------
function recuperacionPaso1(e) {
    e.preventDefault();
    const username = document.getElementById("rec-username")?.value.trim();
    if (!username) return toast("Ingresá tu nombre de usuario.", "warn");
    recoveryState.username = username;
    cerrarModal("modal-recuperar-p1");
    abrirModal("modal-recuperar-p2");
}

async function recuperacionPaso2(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");

    const resp1 = document.getElementById("rec-q1")?.value.trim() || "";
    const resp2 = document.getElementById("rec-q2")?.value.trim() || "";
    const resp3 = document.getElementById("rec-q3")?.value.trim() || "";

    if (!resp1 || !resp2 || !resp3) {
        return toast("Respondé todas las preguntas.", "warn");
    }

    const respuestas = [
        { question: "mascota", answer: resp1 },
        { question: "ciudad",  answer: resp2 },
        { question: "madre",   answer: resp3 }
    ];

    spinnerOn(btn);
    try {
        await verificarRespuestasSeguridad(recoveryState.username, respuestas);
        toast("Respuestas correctas. Ahora podés cambiar tu contraseña.");
        cerrarModal("modal-recuperar-p2");
        abrirModal("modal-recuperar-p3");
    } catch (e) {
        toast(e.message || "Respuestas incorrectas. Verificá tus datos.", "error");
    } finally {
        spinnerOff(btn);
    }
}

async function recuperacionPaso3(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    const newPass = document.getElementById("rec-newpassword")?.value;
    const confirmPass = document.getElementById("rec-newpassword-confirm")?.value;

    if (!newPass || newPass.length < 8) return toast("La contraseña debe tener al menos 8 caracteres.", "warn");
    if (newPass !== confirmPass) return toast("Las contraseñas no coinciden.", "warn");

    spinnerOn(btn);
    try {
        await cambiarContrasena(recoveryState.username, newPass);
        toast("Contraseña actualizada correctamente ✓");
        recoveryState.username = null;
        cerrarModal("modal-recuperar-p3");
        abrirModal("modal-login");
    } catch (e) {
        toast(e.message || "Error al cambiar la contraseña.", "error");
    } finally {
        spinnerOff(btn);
    }
}

// ---------- CONTACTO ----------
async function manejarContacto(e) {
    e.preventDefault();
    const btn     = e.target.querySelector("button[type=submit]");
    const inputs  = e.target.querySelectorAll("input, textarea");
    const nombre  = inputs[0]?.value.trim();
    const email   = inputs[1]?.value.trim();
    const mensaje = inputs[2]?.value.trim();
    if (!nombre || !email || !mensaje) return toast("Completá todos los campos.", "warn");
    spinnerOn(btn);
    try {
        await enviarConsulta({ nombre, email, mensaje });
        toast("¡Consulta enviada! 📬");
        e.target.reset();
    } catch (_) { toast("Error al enviar la consulta.", "error"); }
    finally { spinnerOff(btn); }
}

// ---------- INICIALIZACIÓN ----------
document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("sesion-expirada", () => {
        cerrarModal("modal-carrito");
        cerrarModal("modal-checkout");
        actualizarNavbar();
        toast("Tu sesión expiró por seguridad. Volvé a ingresar.", "warn");
    });

    document.getElementById("filtro-select")?.addEventListener("change", (e) => {
        filtrarPorCat(e.target.value);
    });

    // Solución: debounce en la búsqueda
    let timeoutBusqueda;
    document.getElementById("busqueda")?.addEventListener("input", () => {
        clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(aplicarFiltros, 400); // Espera 400ms después de la última tecla
    });

    // Botonera grande de categorías (imágenes)
    document.querySelectorAll("#categoria-cartas .categoria").forEach(card => {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => {
            const cat = card.dataset.categoria;
            const mapaNombres = { mouse: "Mouse", teclados: "Teclados", mousepads: "Mousepad", auriculares: "Auriculares" };
            const nombreCategoria = mapaNombres[cat] || cat;
            const select = document.getElementById("filtro-select");
            if (select) select.value = nombreCategoria;
            filtrarPorCat(nombreCategoria);
            document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" });
        });
    });

    document.querySelector("#header .btn")?.addEventListener("click", () =>
        document.getElementById("productos")?.scrollIntoView({ behavior: "smooth" })
    );

    document.getElementById("nav-login")?.addEventListener("click", e => { e.preventDefault(); abrirModal("modal-login"); });
    document.getElementById("nav-register")?.addEventListener("click", e => { e.preventDefault(); abrirModal("modal-register"); });
    document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); logout(); actualizarNavbar(); toast("Sesión cerrada 👋"); });
    document.getElementById("nav-carrito")?.addEventListener("click", async e => { e.preventDefault(); abrirModal("modal-carrito"); await renderCarrito(); });
    document.getElementById("nav-ordenes")?.addEventListener("click", async e => { e.preventDefault(); abrirModal("modal-ordenes"); await renderMisOrdenes(); });

    document.getElementById("form-login")?.addEventListener("submit", manejarLogin);
    document.getElementById("form-register")?.addEventListener("submit", manejarRegistro);
    document.getElementById("form-recuperar-p1")?.addEventListener("submit", recuperacionPaso1);
    document.getElementById("form-recuperar-p2")?.addEventListener("submit", recuperacionPaso2);
    document.getElementById("form-recuperar-p3")?.addEventListener("submit", recuperacionPaso3);

    document.getElementById("link-reset-pw")?.addEventListener("click", e => { e.preventDefault(); cerrarModal("modal-login"); abrirModal("modal-recuperar-p1"); });
    document.getElementById("link-a-registro")?.addEventListener("click", e => { e.preventDefault(); cerrarModal("modal-login"); abrirModal("modal-register"); });
    document.getElementById("link-a-login")?.addEventListener("click", e => { e.preventDefault(); cerrarModal("modal-register"); abrirModal("modal-login"); });

    document.getElementById("btn-checkout")?.addEventListener("click", async () => abrirFormularioPago());
    document.getElementById("form-pago")?.addEventListener("submit", manejarConfirmarPago);
    document.getElementById("form-cancelacion")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const modal = document.getElementById("modal-cancelacion");
        const orderId = modal?.dataset.orderId;
        const motivo = document.getElementById("cancelacion-motivo")?.value.trim();
        if (!motivo) return toast("Ingresá el motivo.", "warn");
        await ejecutarCancelacion(orderId, motivo);
    });
    document.querySelector("#contacto form")?.addEventListener("submit", manejarContacto);
    document.querySelectorAll(".btn-cerrar-modal").forEach(btn =>
        btn.addEventListener("click", () => btn.closest(".modal")?.classList.remove("activo"))
    );

    actualizarNavbar();
    cargarAssets();
    const pantallaCarga = document.getElementById("pantalla-carga");

    cargarCategorias().then(() => {
        cargarProductos().then(() => {
            if (pantallaCarga) pantallaCarga.style.display = "none";
        }).catch(() => {
            if (pantallaCarga) pantallaCarga.style.display = "none";
        });
    }).catch(() => {
        if (pantallaCarga) pantallaCarga.style.display = "none";
    });
    if (isLoggedIn()) actualizarContadorCarrito();
});