/**
 * SUGHRA MEDICOSE — Professional Pharmacy Admin Control Center
 * Real-time Order Reception, Audio Beep Engine, Inventory Management, Catalog CRUD
 */

// State
let authToken = sessionStorage.getItem("sm_admin_token") || "";
let activeTab = "dashboard";
let currentOrderFilter = "All";
let orders = [];
let medicines = [];
let analytics = {};
let storeSettings = {};
let activeAlertInterval = null;
let currentEditingMedId = null;

// Web Audio API Sound Engine
class BeeperAudioEngine {
  constructor() {
    this.ctx = null;
    this.isBeeping = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playSingleBeep(freq = 880, duration = 0.15, type = "sine") {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Loud high-priority pharmacy order alert chime
  playOrderAlarm() {
    this.init();
    if (!this.ctx) return;
    
    // Play distinctive double-pulse chime: 880Hz -> 1174Hz
    const now = this.ctx.currentTime;
    const notes = [
      { f: 880, t: 0 },
      { f: 1174.66, t: 0.18 },
      { f: 880, t: 0.36 },
      { f: 1318.51, t: 0.54 }
    ];

    notes.forEach(n => {
      setTimeout(() => {
        this.playSingleBeep(n.f, 0.14, "triangle");
      }, n.t * 1000);
    });
  }

  startContinuousAlert() {
    this.stopContinuousAlert();
    this.playOrderAlarm();
    this.isBeeping = true;
    activeAlertInterval = setInterval(() => {
      if (this.isBeeping) {
        this.playOrderAlarm();
      }
    }, 4500);
  }

  stopContinuousAlert() {
    this.isBeeping = false;
    if (activeAlertInterval) {
      clearInterval(activeAlertInterval);
      activeAlertInterval = null;
    }
    const banner = document.getElementById("newOrderBanner");
    if (banner) banner.style.display = "none";
  }
}

const beeper = new BeeperAudioEngine();

// App Initialization
document.addEventListener("DOMContentLoaded", () => {
  initAdminApp();
});

async function initAdminApp() {
  setupNavigation();
  setupAuthEvents();
  
  if (authToken) {
    showDashboardView();
  } else {
    showAuthLock();
  }
}

// Authentication Handlers
function setupAuthEvents() {
  const loginForm = document.getElementById("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pwdInput = document.getElementById("adminPasswordInput");
      const errEl = document.getElementById("authErrorMsg");
      const password = pwdInput.value.trim();

      if (!password) return;

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          authToken = data.token;
          sessionStorage.setItem("sm_admin_token", authToken);
          // Unlock audio context on user action
          beeper.init();
          beeper.playSingleBeep(1046, 0.2, "sine");
          showDashboardView();
        } else {
          if (errEl) {
            errEl.textContent = data.error || "Invalid Password or PIN";
            errEl.style.display = "block";
          }
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = "Server connection error";
          errEl.style.display = "block";
        }
      }
    });
  }

  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      authToken = "";
      sessionStorage.removeItem("sm_admin_token");
      beeper.stopContinuousAlert();
      showAuthLock();
    });
  }
}

function showAuthLock() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("adminMainLayout").style.display = "none";
}

async function showDashboardView() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("adminMainLayout").style.display = "flex";
  
  await loadAllAdminData();
  initAdminSSE();
}

// Load Data
async function loadAllAdminData() {
  await Promise.all([
    fetchAdminOrders(),
    fetchAdminMedicines(),
    fetchAdminAnalytics(),
    fetchAdminSettings()
  ]);
  renderCurrentTab();
}

async function fetchAdminOrders() {
  try {
    const res = await fetch("/api/orders", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      orders = await res.json();
      updatePendingBadge();
    }
  } catch (e) {
    console.error("Error fetching orders", e);
  }
}

async function fetchAdminMedicines() {
  try {
    const res = await fetch("/api/medicines");
    if (res.ok) {
      medicines = await res.json();
    }
  } catch (e) {
    console.error("Error fetching medicines", e);
  }
}

async function fetchAdminAnalytics() {
  try {
    const res = await fetch("/api/analytics", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      analytics = await res.json();
    }
  } catch (e) {
    console.error("Error fetching analytics", e);
  }
}

async function fetchAdminSettings() {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      storeSettings = await res.json();
      updateSettingsUI();
    }
  } catch (e) {
    console.error("Error fetching settings", e);
  }
}

// Real-Time Server-Sent Events (SSE)
function initAdminSSE() {
  try {
    const evtSource = new EventSource("/api/events");

    evtSource.addEventListener("new_order", (e) => {
      const newOrder = JSON.parse(e.data);
      orders.unshift(newOrder);
      updatePendingBadge();
      
      // 🔊 TRIGGER LOUD AUDIBLE BEEP & FLASHER!
      beeper.startContinuousAlert();
      showNewOrderBanner(newOrder);
      
      // Re-render
      if (activeTab === "orders" || activeTab === "dashboard") {
        renderCurrentTab();
      }
      fetchAdminAnalytics();
    });

    evtSource.addEventListener("order_status_updated", (e) => {
      const updatedOrder = JSON.parse(e.data);
      const idx = orders.findIndex(o => o.id === updatedOrder.id);
      if (idx !== -1) orders[idx] = updatedOrder;
      updatePendingBadge();
      if (activeTab === "orders" || activeTab === "dashboard") renderCurrentTab();
    });

    evtSource.addEventListener("catalog_updated", (e) => {
      const data = JSON.parse(e.data);
      if (data.medicines) medicines = data.medicines;
      if (activeTab === "medicines" || activeTab === "inventory" || activeTab === "dashboard") {
        renderCurrentTab();
      }
    });

  } catch (e) {
    console.error("Admin SSE error", e);
  }
}

function showNewOrderBanner(order) {
  const banner = document.getElementById("newOrderBanner");
  const textEl = document.getElementById("newOrderBannerText");
  if (!banner || !textEl) return;

  textEl.innerHTML = `🚨 <strong>NEW ORDER: #${order.id}</strong> — ${escapeHtml(order.customerName)} (₹${order.grandTotal.toFixed(2)})`;
  banner.style.display = "flex";
}

function acknowledgeNewOrder() {
  beeper.stopContinuousAlert();
  switchTab("orders");
  filterOrders("Pending");
}

function testBeepSound() {
  beeper.init();
  beeper.playOrderAlarm();
  showAdminToast("Testing Order Alert Sound (Beep)...", "success");
}

function updatePendingBadge() {
  const pendingCount = orders.filter(o => o.status === "Pending").length;
  const badge = document.getElementById("pendingOrdersBadge");
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? "inline-block" : "none";
  }
}

// ----------------------------------------------------
// Navigation & Tab Switching
// ----------------------------------------------------
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.dataset.tab === tabName) item.classList.add("active");
    else item.classList.remove("active");
  });

  document.querySelectorAll(".tab-pane").forEach(pane => {
    if (pane.id === `tab-${tabName}`) pane.classList.add("active");
    else pane.classList.remove("active");
  });

  renderCurrentTab();
}

function renderCurrentTab() {
  if (activeTab === "dashboard") renderDashboardTab();
  if (activeTab === "orders") renderOrdersTab();
  if (activeTab === "medicines") renderMedicinesTab();
  if (activeTab === "inventory") renderInventoryTab();
  if (activeTab === "settings") renderSettingsTab();
}

// ----------------------------------------------------
// Tab 1: Dashboard
// ----------------------------------------------------
function renderDashboardTab() {
  const pendingCount = orders.filter(o => o.status === "Pending").length;
  const todayRevenue = analytics.todayRevenue || 0;
  const totalRevenue = analytics.totalRevenue || 0;
  const lowStockCount = medicines.filter(m => m.stock <= (m.minStockThreshold || 10)).length;

  document.getElementById("dashTodayRevenue").textContent = `₹${todayRevenue.toFixed(2)}`;
  document.getElementById("dashTotalRevenue").textContent = `₹${totalRevenue.toFixed(2)}`;
  document.getElementById("dashPendingOrders").textContent = pendingCount;
  document.getElementById("dashLowStock").textContent = lowStockCount;

  // Recent 5 Orders Table
  const recentOrders = orders.slice(0, 5);
  const tableBody = document.getElementById("dashRecentOrdersTable");
  if (tableBody) {
    if (recentOrders.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--admin-muted); padding:2rem;">No orders yet.</td></tr>`;
    } else {
      tableBody.innerHTML = recentOrders.map(o => `
        <tr>
          <td><strong>#${o.id}</strong></td>
          <td>${escapeHtml(o.customerName)}<br><span style="font-size:0.75rem; color:var(--admin-muted);">${o.customerPhone}</span></td>
          <td>${o.items ? o.items.length : 0} items</td>
          <td><strong>₹${(o.grandTotal || 0).toFixed(2)}</strong></td>
          <td>${getStatusBadge(o.status)}</td>
          <td>
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="openOrderDetailsModal('${o.id}')">
              View Details
            </button>
          </td>
        </tr>
      `).join("");
    }
  }
}

// ----------------------------------------------------
// Tab 2: Orders Management
// ----------------------------------------------------
function filterOrders(status) {
  currentOrderFilter = status;
  document.querySelectorAll(".order-tab").forEach(tab => {
    if (tab.dataset.status === status) tab.classList.add("active");
    else tab.classList.remove("active");
  });
  renderOrdersTab();
}

function renderOrdersTab() {
  const tableBody = document.getElementById("ordersTableBody");
  if (!tableBody) return;

  let filtered = orders;
  if (currentOrderFilter !== "All") {
    filtered = orders.filter(o => o.status === currentOrderFilter);
  }

  // Check search input
  const searchInput = document.getElementById("orderSearchInput");
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(o => 
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--admin-muted); padding:3rem;">No orders found in "${currentOrderFilter}".</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(o => {
    const itemsSummary = (o.items || []).map(i => `${escapeHtml(i.name)} (${i.quantity})`).join(", ");
    const hasRx = Boolean(o.prescriptionUrl);
    const dateStr = new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + new Date(o.createdAt).toLocaleDateString();

    return `
      <tr>
        <td>
          <strong>#${o.id}</strong><br>
          <span style="font-size:0.75rem; color:var(--admin-muted);">${dateStr}</span>
        </td>
        <td>
          <strong>${escapeHtml(o.customerName)}</strong><br>
          <a href="tel:${o.customerPhone}" style="color:var(--admin-accent); font-size:0.8rem; text-decoration:none;">📞 ${o.customerPhone}</a>
        </td>
        <td style="max-width: 250px;">
          <div style="font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(itemsSummary)}">${escapeHtml(itemsSummary)}</div>
          <div style="font-size:0.75rem; color:var(--admin-muted);">${escapeHtml(o.deliveryAddress)}</div>
        </td>
        <td>
          <strong>₹${(o.grandTotal || 0).toFixed(2)}</strong><br>
          <span style="font-size:0.75rem; color:${o.paymentMethod === "UPI" ? "#34d399" : "#fbbf24"}; font-weight:700;">${o.paymentMethod}</span>
        </td>
        <td>
          ${hasRx ? `<button class="admin-btn admin-btn-outline admin-btn-sm" onclick="viewPrescriptionModal('${o.prescriptionUrl}')">📄 View Rx</button>` : `<span style="font-size:0.75rem; color:var(--admin-muted);">None</span>`}
        </td>
        <td>${getStatusBadge(o.status)}</td>
        <td>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            ${getNextActionButtons(o)}
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="openOrderDetailsModal('${o.id}')" title="Details">
              👁️
            </button>
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="printInvoice('${o.id}')" title="Print Invoice">
              🖨️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function getNextActionButtons(order) {
  if (order.status === "Pending") {
    return `<button class="admin-btn admin-btn-primary admin-btn-sm" onclick="updateOrderStatus('${order.id}', 'Accepted')">✓ Accept</button>`;
  }
  if (order.status === "Accepted") {
    return `<button class="admin-btn admin-btn-primary admin-btn-sm" style="background:#a855f7;" onclick="updateOrderStatus('${order.id}', 'Preparing')">📦 Prepare</button>`;
  }
  if (order.status === "Preparing") {
    return `<button class="admin-btn admin-btn-primary admin-btn-sm" style="background:#f97316;" onclick="updateOrderStatus('${order.id}', 'Out for Delivery')">🛵 Dispatch</button>`;
  }
  if (order.status === "Out for Delivery") {
    return `<button class="admin-btn admin-btn-primary admin-btn-sm" style="background:#10b981;" onclick="updateOrderStatus('${order.id}', 'Delivered')">✅ Delivered</button>`;
  }
  return "";
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) orders[idx] = data.order;
      updatePendingBadge();
      renderOrdersTab();
      showAdminToast(`Order #${orderId} marked as ${newStatus}`, "success");
    } else {
      showAdminToast("Failed to update status", "danger");
    }
  } catch (e) {
    showAdminToast("Network error updating order", "danger");
  }
}

// ----------------------------------------------------
// Tab 3: Medicine Catalog Manager (CRUD)
// ----------------------------------------------------
function renderMedicinesTab() {
  const tableBody = document.getElementById("medicinesTableBody");
  if (!tableBody) return;

  const searchInput = document.getElementById("medSearchInput");
  let filtered = medicines;

  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(m => 
      m.name.toLowerCase().includes(q) ||
      (m.genericName || "").toLowerCase().includes(q) ||
      (m.category || "").toLowerCase().includes(q) ||
      (m.manufacturer || "").toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--admin-muted); padding:3rem;">No medicines found. Click "Add New Medicine" to create one.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(m => {
    const isOut = (m.stock || 0) <= 0;
    const isLow = !isOut && m.stock <= (m.minStockThreshold || 10);
    let stockBadge = `<span class="status-badge status-delivered">${m.stock} Units</span>`;
    if (isOut) stockBadge = `<span class="status-badge status-cancelled">Out of Stock</span>`;
    else if (isLow) stockBadge = `<span class="status-badge status-pending">Low (${m.stock})</span>`;

    return `
      <tr>
        <td>
          <img src="${m.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"}" 
               alt="${escapeHtml(m.name)}" 
               style="width:44px; height:44px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--admin-border);">
        </td>
        <td>
          <strong>${escapeHtml(m.name)}</strong><br>
          <span style="font-size:0.75rem; color:var(--admin-muted);">${escapeHtml(m.genericName || m.category)}</span>
        </td>
        <td>
          <span style="font-size:0.8rem; background:rgba(2,132,199,0.15); color:#38bdf8; padding:0.2rem 0.5rem; border-radius:4px;">${escapeHtml(m.category)}</span><br>
          <span style="font-size:0.75rem; color:var(--admin-muted);">${escapeHtml(m.dosageForm || "Tablet")}</span>
        </td>
        <td>
          <strong>₹${m.price.toFixed(2)}</strong>
          ${m.mrp > m.price ? `<br><span style="font-size:0.75rem; color:var(--admin-muted); text-decoration:line-through;">₹${m.mrp.toFixed(2)}</span>` : ""}
        </td>
        <td>${stockBadge}</td>
        <td>
          <span style="font-size:0.75rem;">Batch: ${escapeHtml(m.batchNo || "-")}</span><br>
          <span style="font-size:0.75rem; color:var(--admin-muted);">Exp: ${escapeHtml(m.expiryDate || "-")}</span>
        </td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="openEditMedModal('${m.id}')" title="Edit">✏️ Edit</button>
            <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="deleteMedicine('${m.id}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openAddMedModal() {
  currentEditingMedId = null;
  document.getElementById("medModalTitle").textContent = "Add New Medicine";
  document.getElementById("medForm").reset();
  document.getElementById("medImagePreview").src = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80";
  openAdminModal("medModal");
}

function openEditMedModal(medId) {
  const med = medicines.find(m => m.id === medId);
  if (!med) return;

  currentEditingMedId = medId;
  document.getElementById("medModalTitle").textContent = `Edit Medicine — ${med.name}`;
  
  document.getElementById("medName").value = med.name;
  document.getElementById("medGenericName").value = med.genericName || "";
  document.getElementById("medCategory").value = med.category || "Pain & Fever";
  document.getElementById("medDosageForm").value = med.dosageForm || "Tablet";
  document.getElementById("medPackSize").value = med.packSize || "";
  document.getElementById("medManufacturer").value = med.manufacturer || "";
  document.getElementById("medMrp").value = med.mrp || med.price;
  document.getElementById("medPrice").value = med.price;
  document.getElementById("medStock").value = med.stock || 0;
  document.getElementById("medMinStock").value = med.minStockThreshold || 10;
  document.getElementById("medBatchNo").value = med.batchNo || "";
  document.getElementById("medExpiryDate").value = med.expiryDate || "";
  document.getElementById("medRxRequired").checked = Boolean(med.prescriptionRequired);
  document.getElementById("medImageUrl").value = med.image || "";
  document.getElementById("medImagePreview").src = med.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80";
  document.getElementById("medDescription").value = med.description || "";
  document.getElementById("medDosageInstructions").value = med.dosageInstructions || "";

  openAdminModal("medModal");
}

async function handleSaveMedicine(e) {
  e.preventDefault();

  const name = document.getElementById("medName").value.trim();
  const genericName = document.getElementById("medGenericName").value.trim();
  const category = document.getElementById("medCategory").value;
  const dosageForm = document.getElementById("medDosageForm").value;
  const packSize = document.getElementById("medPackSize").value.trim();
  const manufacturer = document.getElementById("medManufacturer").value.trim();
  const mrp = parseFloat(document.getElementById("medMrp").value) || 0;
  const price = parseFloat(document.getElementById("medPrice").value) || 0;
  const stock = parseInt(document.getElementById("medStock").value, 10) || 0;
  const minStockThreshold = parseInt(document.getElementById("medMinStock").value, 10) || 10;
  const batchNo = document.getElementById("medBatchNo").value.trim();
  const expiryDate = document.getElementById("medExpiryDate").value;
  const prescriptionRequired = document.getElementById("medRxRequired").checked;
  const image = document.getElementById("medImageUrl").value.trim() || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80";
  const description = document.getElementById("medDescription").value.trim();
  const dosageInstructions = document.getElementById("medDosageInstructions").value.trim();

  if (!name || !price) {
    showAdminToast("Please provide Medicine Name and Selling Price.", "danger");
    return;
  }

  const payload = {
    name,
    genericName,
    category,
    dosageForm,
    packSize,
    manufacturer,
    mrp,
    price,
    stock,
    minStockThreshold,
    batchNo,
    expiryDate,
    prescriptionRequired,
    image,
    description,
    dosageInstructions
  };

  const isEdit = Boolean(currentEditingMedId);
  const url = isEdit ? `/api/medicines/${currentEditingMedId}` : "/api/medicines";
  const method = isEdit ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (isEdit) {
        const idx = medicines.findIndex(m => m.id === currentEditingMedId);
        if (idx !== -1) medicines[idx] = data.medicine;
        showAdminToast(`Updated ${name}!`, "success");
      } else {
        medicines.unshift(data.medicine);
        showAdminToast(`Added ${name} to catalog! Instant sync to user app.`, "success");
      }
      closeAdminModal("medModal");
      renderMedicinesTab();
    } else {
      showAdminToast(data.error || "Failed to save medicine", "danger");
    }
  } catch (err) {
    showAdminToast("Network error saving medicine", "danger");
  }
}

async function deleteMedicine(medId) {
  const med = medicines.find(m => m.id === medId);
  if (!med) return;

  if (!confirm(`Are you sure you want to delete "${med.name}" from inventory and user app?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/medicines/${medId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${authToken}` }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      medicines = medicines.filter(m => m.id !== medId);
      renderMedicinesTab();
      showAdminToast(`Deleted ${med.name}`, "default");
    } else {
      showAdminToast("Failed to delete medicine", "danger");
    }
  } catch (e) {
    showAdminToast("Error deleting medicine", "danger");
  }
}

// ----------------------------------------------------
// Tab 4: Inventory & Stock Management
// ----------------------------------------------------
function renderInventoryTab() {
  const tableBody = document.getElementById("inventoryTableBody");
  if (!tableBody) return;

  const today = new Date();

  tableBody.innerHTML = medicines.map(m => {
    const isOut = (m.stock || 0) <= 0;
    const isLow = !isOut && m.stock <= (m.minStockThreshold || 10);

    // Expiry Check
    let expiryStatus = `<span class="status-badge status-delivered">Good</span>`;
    if (m.expiryDate) {
      const exp = new Date(m.expiryDate);
      const diffDays = Math.round((exp - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        expiryStatus = `<span class="status-badge status-cancelled">Expired</span>`;
      } else if (diffDays <= 90) {
        expiryStatus = `<span class="status-badge status-pending">Exp in ${diffDays}d</span>`;
      }
    }

    return `
      <tr>
        <td><strong>${escapeHtml(m.name)}</strong><br><span style="font-size:0.75rem; color:var(--admin-muted);">${escapeHtml(m.batchNo || "No Batch")}</span></td>
        <td>${escapeHtml(m.category)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="adjustStock('${m.id}', -1)">-</button>
            <strong style="min-width:30px; text-align:center; color:${isOut ? "#ef4444" : (isLow ? "#f59e0b" : "#10b981")}">${m.stock}</strong>
            <button class="admin-btn admin-btn-outline admin-btn-sm" onclick="adjustStock('${m.id}', 1)">+</button>
            <button class="admin-btn admin-btn-primary admin-btn-sm" style="margin-left:0.5rem; font-size:0.75rem;" onclick="quickRestockModal('${m.id}')">+ Restock</button>
          </div>
        </td>
        <td>${m.minStockThreshold || 10}</td>
        <td>${escapeHtml(m.expiryDate || "-")}</td>
        <td>${expiryStatus}</td>
        <td>₹${((m.stock || 0) * (m.price || 0)).toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

async function adjustStock(medId, delta) {
  try {
    const res = await fetch(`/api/medicines/${medId}/stock`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ delta })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      const idx = medicines.findIndex(m => m.id === medId);
      if (idx !== -1) medicines[idx] = data.medicine;
      renderInventoryTab();
    }
  } catch (e) {
    showAdminToast("Failed to update stock", "danger");
  }
}

function quickRestockModal(medId) {
  const med = medicines.find(m => m.id === medId);
  if (!med) return;

  const qtyStr = prompt(`Enter restock quantity to add to "${med.name}" (Current stock: ${med.stock}):`, "50");
  if (!qtyStr) return;

  const delta = parseInt(qtyStr, 10);
  if (isNaN(delta) || delta <= 0) {
    showAdminToast("Invalid quantity", "warning");
    return;
  }

  adjustStock(medId, delta);
  showAdminToast(`Added ${delta} units to ${med.name}!`, "success");
}

function exportInventoryCSV() {
  if (medicines.length === 0) {
    showAdminToast("No medicines to export", "warning");
    return;
  }

  const headers = ["ID", "Name", "Generic Salt", "Category", "Dosage Form", "Pack Size", "Manufacturer", "MRP", "Price", "Stock", "Min Threshold", "Batch No", "Expiry Date", "Rx Required"];
  const rows = medicines.map(m => [
    m.id,
    `"${(m.name || "").replace(/"/g, '""')}"`,
    `"${(m.genericName || "").replace(/"/g, '""')}"`,
    `"${m.category || ""}"`,
    `"${m.dosageForm || ""}"`,
    `"${m.packSize || ""}"`,
    `"${m.manufacturer || ""}"`,
    m.mrp || m.price,
    m.price,
    m.stock,
    m.minStockThreshold,
    m.batchNo || "",
    m.expiryDate || "",
    m.prescriptionRequired ? "YES" : "NO"
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `sughra_medicose_inventory_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showAdminToast("Inventory CSV Exported Successfully!", "success");
}

// ----------------------------------------------------
// Tab 5: Settings
// ----------------------------------------------------
function updateSettingsUI() {
  const storeNameInput = document.getElementById("settingStoreName");
  const phoneInput = document.getElementById("settingPhone");
  const upiPhoneInput = document.getElementById("settingUpiPhone");
  const upiIdInput = document.getElementById("settingUpiId");
  const freeMinInput = document.getElementById("settingFreeMin");
  const deliveryFeeInput = document.getElementById("settingDeliveryFee");
  const openSwitch = document.getElementById("settingStoreOpen");

  if (storeNameInput) storeNameInput.value = storeSettings.storeName || "Sughra Medicose";
  if (phoneInput) phoneInput.value = storeSettings.phone || "7503574364";
  if (upiPhoneInput) upiPhoneInput.value = storeSettings.upiPhone || "7503574364";
  if (upiIdInput) upiIdInput.value = storeSettings.upiId || "7503574364@upi";
  if (freeMinInput) freeMinInput.value = storeSettings.freeDeliveryMin || 500;
  if (deliveryFeeInput) deliveryFeeInput.value = storeSettings.deliveryFee || 40;
  if (openSwitch) openSwitch.checked = storeSettings.isStoreOpen !== false;
  const rzpKeyInput = document.getElementById("settingRazorpayKeyId");
  if (rzpKeyInput) rzpKeyInput.value = storeSettings.razorpayKeyId || "";
}

function renderSettingsTab() {
  updateSettingsUI();
}

async function saveStoreSettings(e) {
  e.preventDefault();

  const storeName = document.getElementById("settingStoreName").value.trim();
  const phone = document.getElementById("settingPhone").value.trim();
  const upiPhone = document.getElementById("settingUpiPhone").value.trim();
  const upiId = document.getElementById("settingUpiId").value.trim();
  const freeDeliveryMin = parseFloat(document.getElementById("settingFreeMin").value) || 500;
  const deliveryFee = parseFloat(document.getElementById("settingDeliveryFee").value) || 40;
  const isStoreOpen = document.getElementById("settingStoreOpen").checked;
  const razorpayKeyId = document.getElementById("settingRazorpayKeyId").value.trim();
  const razorpayKeySecret = document.getElementById("settingRazorpayKeySecret").value.trim();
  const newPassword = document.getElementById("settingNewPassword").value.trim();

  const payload = {
    storeName,
    phone,
    upiPhone,
    upiId,
    freeDeliveryMin,
    deliveryFee,
    isStoreOpen,
    razorpayKeyId
  };
  if (razorpayKeySecret) payload.razorpayKeySecret = razorpayKeySecret;

  if (newPassword) {
    payload.adminPassword = newPassword;
  }

  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      storeSettings = data.settings;
      showAdminToast("Settings saved successfully!", "success");
      document.getElementById("settingNewPassword").value = "";
    } else {
      showAdminToast("Failed to save settings", "danger");
    }
  } catch (e) {
    showAdminToast("Error saving settings", "danger");
  }
}

// ----------------------------------------------------
// Modals & Invoices
// ----------------------------------------------------
function openOrderDetailsModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const modalBody = document.getElementById("orderDetailsModalBody");
  if (!modalBody) return;

  const itemsRows = (order.items || []).map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td>₹${i.price.toFixed(2)}</td>
      <td>${i.quantity}</td>
      <td><strong>₹${(i.total || (i.price * i.quantity)).toFixed(2)}</strong></td>
    </tr>
  `).join("");

  const waMsg = encodeURIComponent(`Hello ${order.customerName}, regarding your Sughra Medicose Order #${order.id}...`);
  const waUrl = `https://wa.me/91${order.customerPhone.replace(/\D/g, "")}?text=${waMsg}`;

  modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem; font-weight:800;">Order #${order.id}</h2>
        <p style="color:var(--admin-muted); font-size:0.85rem;">Placed on: ${new Date(order.createdAt).toLocaleString()}</p>
      </div>
      <div>${getStatusBadge(order.status)}</div>
    </div>

    <div class="form-grid-2" style="background:#111827; padding:1rem; border-radius:var(--radius-md); margin-bottom:1.25rem; border:1px solid var(--admin-border);">
      <div>
        <h4 style="font-size:0.8rem; color:var(--admin-muted); text-transform:uppercase; margin-bottom:0.25rem;">Customer Details</h4>
        <p><strong>${escapeHtml(order.customerName)}</strong></p>
        <p>📞 <a href="tel:${order.customerPhone}" style="color:var(--admin-accent); text-decoration:none;">${order.customerPhone}</a></p>
        <a href="${waUrl}" target="_blank" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:0.4rem; color:#25d366;">
          💬 WhatsApp Customer
        </a>
      </div>
      <div>
        <h4 style="font-size:0.8rem; color:var(--admin-muted); text-transform:uppercase; margin-bottom:0.25rem;">Delivery Address</h4>
        <p style="font-size:0.9rem;">${escapeHtml(order.deliveryAddress)}</p>
        ${order.landmark ? `<p style="font-size:0.8rem; color:var(--admin-muted);">Landmark: ${escapeHtml(order.landmark)}</p>` : ""}
        ${order.notes ? `<p style="font-size:0.8rem; color:#fbbf24; margin-top:0.3rem;">Note: ${escapeHtml(order.notes)}</p>` : ""}
      </div>
    </div>

    <table class="admin-table" style="margin-bottom:1.25rem;">
      <thead>
        <tr>
          <th>Medicine Item</th>
          <th>Unit Price</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div style="background:#111827; padding:1rem; border-radius:var(--radius-md); border:1px solid var(--admin-border); margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; font-size:0.875rem;">
        <span>Items Subtotal:</span>
        <span>₹${(order.itemTotal || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; font-size:0.875rem;">
        <span>Delivery Charge:</span>
        <span>${order.deliveryFee === 0 ? "FREE" : "₹" + (order.deliveryFee || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:800; border-top:1px dashed var(--admin-border); padding-top:0.5rem; color:#34d399;">
        <span>Grand Total:</span>
        <span>₹${(order.grandTotal || 0).toFixed(2)}</span>
      </div>
      <div style="margin-top:0.5rem; font-size:0.8rem; color:var(--admin-muted);">
        Payment: <strong>${order.paymentMethod}</strong> (${order.paymentStatus})
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
      <div style="display:flex; gap:0.5rem;">
        ${getNextActionButtons(order)}
        <button class="admin-btn admin-btn-danger admin-btn-sm" onclick="updateOrderStatus('${order.id}', 'Cancelled'); closeAdminModal('orderDetailsModal');">
          Cancel Order
        </button>
      </div>
      <button class="admin-btn admin-btn-outline" onclick="printInvoice('${order.id}')">
        🖨️ Print Tax Invoice
      </button>
    </div>
  `;

  openAdminModal("orderDetailsModal");
}

function viewPrescriptionModal(url) {
  const modalBody = document.getElementById("prescriptionViewBody");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align:center;">
      <img src="${url}" alt="Prescription" style="max-width:100%; max-height:75vh; border-radius:var(--radius-md); border:1px solid var(--admin-border); box-shadow:var(--shadow-lg);">
      <div style="margin-top:1rem; display:flex; justify-content:center; gap:0.75rem;">
        <a href="${url}" target="_blank" download="prescription.jpg" class="admin-btn admin-btn-primary">
          💾 Download Prescription
        </a>
        <button class="admin-btn admin-btn-outline" onclick="closeAdminModal('prescriptionModal')">
          Close
        </button>
      </div>
    </div>
  `;

  openAdminModal("prescriptionModal");
}

function printInvoice(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const invoiceContainer = document.getElementById("printableInvoiceContainer");
  if (!invoiceContainer) return;

  const itemsRows = (order.items || []).map((i, idx) => `
    <tr>
      <td style="padding:6px 8px; border:1px solid #ddd;">${idx + 1}</td>
      <td style="padding:6px 8px; border:1px solid #ddd;"><strong>${escapeHtml(i.name)}</strong></td>
      <td style="padding:6px 8px; border:1px solid #ddd; text-align:center;">${i.quantity}</td>
      <td style="padding:6px 8px; border:1px solid #ddd; text-align:right;">₹${i.price.toFixed(2)}</td>
      <td style="padding:6px 8px; border:1px solid #ddd; text-align:right;">₹${(i.total || (i.price * i.quantity)).toFixed(2)}</td>
    </tr>
  `).join("");

  invoiceContainer.innerHTML = `
    <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #000; padding: 20px;">
      <div style="display:flex; justify-content:space-between; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 24px; color: #059669; margin: 0;">SUGHRA MEDICOSE</h1>
          <p style="font-size: 12px; margin: 3px 0;">Registered Chemist & Retail Pharmacy</p>
          <p style="font-size: 12px; margin: 2px 0;">Shahganj Chowk, Ajmeri Gate, Delhi - 110006</p>
          <p style="font-size: 12px; margin: 2px 0;">Phone: 7503574364 | DL No: DL-PH-94821</p>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 18px; margin: 0; color: #333;">TAX INVOICE / CASH MEMO</h2>
          <p style="font-size: 13px; margin: 4px 0;"><strong>Invoice No:</strong> #${order.id}</p>
          <p style="font-size: 12px; margin: 2px 0;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p style="font-size: 12px; margin: 2px 0;"><strong>Status:</strong> ${order.status}</p>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size: 13px; background: #f9fafb; padding: 10px; border: 1px solid #eee;">
        <div>
          <strong>Billed To:</strong><br>
          ${escapeHtml(order.customerName)}<br>
          Phone: ${order.customerPhone}<br>
          Address: ${escapeHtml(order.deliveryAddress)}
        </div>
        <div style="text-align: right;">
          <strong>Payment Information:</strong><br>
          Mode: ${order.paymentMethod}<br>
          Status: ${order.paymentStatus}<br>
          UPI Phone: 7503574364
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding:8px; border:1px solid #ddd; width:40px;">#</th>
            <th style="padding:8px; border:1px solid #ddd; text-align:left;">Medicine Description</th>
            <th style="padding:8px; border:1px solid #ddd; width:60px; text-align:center;">Qty</th>
            <th style="padding:8px; border:1px solid #ddd; width:100px; text-align:right;">Rate</th>
            <th style="padding:8px; border:1px solid #ddd; width:110px; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:8px; border:1px solid #ddd; text-align:right;"><strong>Subtotal:</strong></td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">₹${(order.itemTotal || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:8px; border:1px solid #ddd; text-align:right;"><strong>Delivery Fee:</strong></td>
            <td style="padding:8px; border:1px solid #ddd; text-align:right;">${order.deliveryFee === 0 ? "FREE" : "₹" + (order.deliveryFee || 0).toFixed(2)}</td>
          </tr>
          <tr style="background: #f0fdf4; font-size: 15px;">
            <td colspan="4" style="padding:10px; border:1px solid #ddd; text-align:right;"><strong>GRAND TOTAL (INR):</strong></td>
            <td style="padding:10px; border:1px solid #ddd; text-align:right; font-weight:800; color:#059669;">₹${(order.grandTotal || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="display:flex; justify-content:space-between; margin-top: 40px; font-size: 12px; border-top: 1px dashed #ccc; padding-top: 15px;">
        <div>
          <strong>Terms & Conditions:</strong><br>
          1. Genuine medicines certified by licensed druggist.<br>
          2. Store under recommended temperature conditions.<br>
          3. For queries, contact Tasnim Jamal: 7503574364.
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <p style="margin-bottom: 30px;">For <strong>SUGHRA MEDICOSE</strong></p>
          <p style="border-top: 1px solid #000; padding-top: 4px; font-size: 11px;">Authorized Signatory / Registered Pharmacist</p>
        </div>
      </div>
    </div>
  `;

  window.print();
}

// ----------------------------------------------------
// UI Helpers
// ----------------------------------------------------
function getStatusBadge(status) {
  switch (status) {
    case "Pending": return `<span class="status-badge status-pending">Pending</span>`;
    case "Accepted": return `<span class="status-badge status-accepted">Accepted</span>`;
    case "Preparing": return `<span class="status-badge status-preparing">Preparing</span>`;
    case "Out for Delivery": return `<span class="status-badge status-out">Out for Delivery</span>`;
    case "Delivered": return `<span class="status-badge status-delivered">Delivered</span>`;
    case "Cancelled": return `<span class="status-badge status-cancelled">Cancelled</span>`;
    default: return `<span class="status-badge">${escapeHtml(status)}</span>`;
  }
}

function getPaymentBadge(order) {
  if (order.paymentMethod === "WhatsApp / COD") {
    return `<span style="font-size:0.75rem; background:rgba(37,211,102,0.15); color:#25d366; padding:2px 6px; border-radius:4px; font-weight:700;">💬 WhatsApp Order</span>`;
  }
  if (order.paymentId || order.paymentStatus === "Completed (Verified)") {
    return `<span style="font-size:0.75rem; background:rgba(16,185,129,0.15); color:#34d399; padding:2px 6px; border-radius:4px; font-weight:700;">💳 Bank Paid & Verified</span>`;
  }
  return `<span style="font-size:0.75rem; color:#fbbf24; font-weight:700;">${escapeHtml(order.paymentMethod || "COD")}</span>`;
}

function openAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("open");
}

function closeAdminModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

function showAdminToast(msg, type = "default") {
  let container = document.getElementById("adminToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "adminToastContainer";
    container.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px;";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.style.cssText = "background:#1e293b; color:#fff; padding:12px 18px; border-radius:8px; border:1px solid #334155; font-size:14px; font-weight:600; box-shadow:0 10px 15px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px;";
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "warning") icon = "⚠️";
  if (type === "danger") icon = "❌";

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
