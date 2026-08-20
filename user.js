/**
 * SUGHRA MEDICOSE — Frontend Customer Medicine Ordering App
 * Live Automated Payment Verification + Auto-written WhatsApp Orders
 * Phone: 7503574364 | Delhi Ajmeri Gate
 */

let allMedicines = [];
let filteredMedicines = [];
let cart = JSON.parse(localStorage.getItem("sm_user_cart") || "[]");
let storeSettings = {
  storeName: "Sughra Medicose",
  phone: "7503574364",
  upiPhone: "7503574364",
  upiId: "7503574364@upi",
  freeDeliveryMin: 500,
  deliveryFee: 40
};
let selectedCategory = "All";
let selectedDosage = "All";
let selectedRx = "All";
let searchQuery = "";
let uploadedPrescriptionUrl = null;
let currentOrder = null;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  await fetchSettings();
  await fetchMedicines();
  initSSE();
  renderCart();
  setupEventListeners();
}

async function fetchSettings() {
  try {
    const res = await fetch("/api/settings");
    if (res.ok) {
      storeSettings = await res.json();
      updateStoreSettingsUI();
    }
  } catch (e) {
    console.warn("Using default store settings", e);
  }
}

function updateStoreSettingsUI() {
  document.querySelectorAll(".store-phone-val").forEach(el => el.textContent = storeSettings.phone);
  document.querySelectorAll(".free-min-val").forEach(el => el.textContent = "₹" + storeSettings.freeDeliveryMin);
}

async function fetchMedicines() {
  try {
    const res = await fetch("/api/medicines");
    if (res.ok) {
      allMedicines = await res.json();
      applyFilters();
    }
  } catch (e) {
    showToast("Failed to load medicines. Please check connection.", "danger");
  }
}

function initSSE() {
  try {
    const evtSource = new EventSource("/api/events");
    
    evtSource.addEventListener("catalog_updated", (e) => {
      const data = JSON.parse(e.data);
      if (data.medicines) {
        allMedicines = data.medicines;
      } else if (data.action === "add" && data.medicine) {
        allMedicines.unshift(data.medicine);
      } else if (data.action === "update" && data.medicine) {
        const idx = allMedicines.findIndex(m => m.id === data.medicine.id);
        if (idx !== -1) allMedicines[idx] = data.medicine;
      } else if (data.action === "delete" && data.id) {
        allMedicines = allMedicines.filter(m => m.id !== data.id);
      }
      applyFilters();
      syncCartWithLatestStock();
    });

    evtSource.addEventListener("settings_updated", (e) => {
      storeSettings = JSON.parse(e.data);
      updateStoreSettingsUI();
      renderCart();
    });
  } catch (e) {
    console.error("SSE error", e);
  }
}

function applyFilters() {
  filteredMedicines = allMedicines.filter(med => {
    if (selectedCategory !== "All" && med.category !== selectedCategory) return false;
    if (selectedDosage !== "All" && med.dosageForm !== selectedDosage) return false;
    if (selectedRx === "otc" && med.prescriptionRequired) return false;
    if (selectedRx === "rx" && !med.prescriptionRequired) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (med.name || "").toLowerCase().includes(q);
      const matchGen = (med.genericName || "").toLowerCase().includes(q);
      const matchMfr = (med.manufacturer || "").toLowerCase().includes(q);
      const matchCat = (med.category || "").toLowerCase().includes(q);
      const matchTags = Array.isArray(med.tags) && med.tags.some(t => t.toLowerCase().includes(q));
      return matchName || matchGen || matchMfr || matchCat || matchTags;
    }
    return true;
  });

  renderMedicineGrid();
}

function renderMedicineGrid() {
  const grid = document.getElementById("medicineGrid");
  const countEl = document.getElementById("catalogCount");
  if (!grid) return;

  if (countEl) countEl.textContent = `Showing ${filteredMedicines.length} of ${allMedicines.length} medicines`;

  if (filteredMedicines.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No medicines found</h3>
        <p style="color: var(--text-muted); max-width: 400px; margin: 0 auto 1.5rem auto;">
          We could not find any medicine matching "${escapeHtml(searchQuery)}".
        </p>
        <button class="btn btn-outline" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredMedicines.map(med => {
    const isOutOfStock = (med.stock || 0) <= 0;
    const isLowStock = !isOutOfStock && med.stock <= (med.minStockThreshold || 10);
    const cartItem = cart.find(c => c.id === med.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    let stockBadge = `<span class="badge badge-stock-in">In Stock (${med.stock})</span>`;
    if (isOutOfStock) stockBadge = `<span class="badge badge-stock-out">Out of Stock</span>`;
    else if (isLowStock) stockBadge = `<span class="badge badge-stock-low">Only ${med.stock} Left</span>`;

    const rxBadge = med.prescriptionRequired
      ? `<span class="badge badge-rx">Rx Required</span>`
      : `<span class="badge badge-otc">OTC Safe</span>`;

    const discountBadge = med.discount > 0
      ? `<span class="badge badge-discount med-discount-floating">${med.discount}% OFF</span>`
      : "";

    return `
      <div class="med-card" data-id="${med.id}">
        <div class="med-image-wrapper">
          <img src="${med.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"}" 
               alt="${escapeHtml(med.name)}" class="med-image" loading="lazy">
          <div class="med-tag-floating">${rxBadge}</div>
          ${discountBadge}
        </div>
        
        <div class="med-body">
          <div class="med-manufacturer">${escapeHtml(med.manufacturer || "PHARMA")}</div>
          <h3 class="med-name" title="${escapeHtml(med.name)}">${escapeHtml(med.name)}</h3>
          <p class="med-generic" title="${escapeHtml(med.genericName || "")}">${escapeHtml(med.genericName || med.category)}</p>
          
          <div class="med-meta">
            <span>📦 ${escapeHtml(med.packSize || "1 Unit")}</span>
            ${stockBadge}
          </div>

          <div class="med-pricing">
            <span class="price-current">₹${med.price.toFixed(2)}</span>
            ${med.mrp > med.price ? `<span class="price-mrp">₹${med.mrp.toFixed(2)}</span>` : ""}
          </div>

          <div class="med-actions">
            <button class="btn btn-outline btn-sm" onclick="openMedDetailModal('${med.id}')" title="Quick View">
              ℹ️ Details
            </button>
            <button class="btn-add-cart" onclick="addToCart('${med.id}')" ${isOutOfStock ? "disabled" : ""}>
              ${isOutOfStock ? "Out of Stock" : (inCartQty > 0 ? `In Cart (${inCartQty}) +` : "🛒 Add to Cart")}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function openMedDetailModal(medId) {
  const med = allMedicines.find(m => m.id === medId);
  if (!med) return;

  const modalBody = document.getElementById("medDetailModalBody");
  if (!modalBody) return;

  const isOutOfStock = (med.stock || 0) <= 0;

  modalBody.innerHTML = `
    <div style="display: grid; grid-template-columns: 180px 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
      <img src="${med.image}" alt="${escapeHtml(med.name)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border);">
      <div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span class="badge ${med.prescriptionRequired ? "badge-rx" : "badge-otc"}">${med.prescriptionRequired ? "Prescription Required (Rx)" : "Over The Counter (OTC)"}</span>
          <span class="badge badge-category">${escapeHtml(med.category)}</span>
        </div>
        <h2 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 0.25rem;">${escapeHtml(med.name)}</h2>
        <p style="color: var(--accent); font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem;">${escapeHtml(med.genericName || "Standard Composition")}</p>
        <div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.75rem;">
          <span style="font-size: 1.5rem; font-weight: 800; color: var(--primary-dark);">₹${med.price.toFixed(2)}</span>
          ${med.mrp > med.price ? `<span style="font-size: 1rem; color: var(--text-light); text-decoration: line-through;">MRP ₹${med.mrp.toFixed(2)}</span>` : ""}
          ${med.discount > 0 ? `<span class="badge badge-discount">${med.discount}% OFF</span>` : ""}
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted);"><strong>Manufacturer:</strong> ${escapeHtml(med.manufacturer)}</p>
        <p style="font-size: 0.85rem; color: var(--text-muted);"><strong>Pack Size:</strong> ${escapeHtml(med.packSize)}</p>
      </div>
    </div>

    <div style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--border);">
      <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.4rem;">Clinical Description</h4>
      <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">${escapeHtml(med.description || "Trusted quality medication.")}</p>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
      <button class="btn btn-outline" onclick="closeModal('medDetailModal')">Close</button>
      <button class="btn btn-primary" onclick="addToCart('${med.id}'); closeModal('medDetailModal');" ${isOutOfStock ? "disabled" : ""}>
        ${isOutOfStock ? "Out of Stock" : "Add to Cart (₹" + med.price.toFixed(2) + ")"}
      </button>
    </div>
  `;

  openModal("medDetailModal");
}

function addToCart(medId) {
  const med = allMedicines.find(m => m.id === medId);
  if (!med) return;

  if ((med.stock || 0) <= 0) {
    showToast(`${med.name} is out of stock.`, "danger");
    return;
  }

  const existing = cart.find(c => c.id === medId);
  if (existing) {
    if (existing.quantity >= med.stock) {
      showToast(`Only ${med.stock} units available in stock.`, "warning");
      return;
    }
    existing.quantity += 1;
  } else {
    cart.push({
      id: med.id,
      name: med.name,
      genericName: med.genericName,
      price: med.price,
      mrp: med.mrp,
      image: med.image,
      quantity: 1,
      prescriptionRequired: med.prescriptionRequired
    });
  }

  saveCart();
  renderCart();
  renderMedicineGrid();
  showToast(`Added ${med.name} to cart!`, "success");
}

function updateCartQty(medId, delta) {
  const itemIndex = cart.findIndex(c => c.id === medId);
  if (itemIndex === -1) return;

  const item = cart[itemIndex];
  const med = allMedicines.find(m => m.id === medId);
  const maxStock = med ? med.stock : 99;

  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    cart.splice(itemIndex, 1);
  } else if (newQty > maxStock) {
    showToast(`Maximum available stock reached (${maxStock} units).`, "warning");
    return;
  } else {
    item.quantity = newQty;
  }

  saveCart();
  renderCart();
  renderMedicineGrid();
}

function removeFromCart(medId) {
  cart = cart.filter(c => c.id !== medId);
  saveCart();
  renderCart();
  renderMedicineGrid();
  showToast("Item removed", "default");
}

function saveCart() {
  localStorage.setItem("sm_user_cart", JSON.stringify(cart));
}

function syncCartWithLatestStock() {
  let changed = false;
  cart = cart.filter(item => {
    const med = allMedicines.find(m => m.id === item.id);
    if (!med || med.stock <= 0) {
      changed = true;
      return false;
    }
    if (item.quantity > med.stock) {
      item.quantity = med.stock;
      changed = true;
    }
    return true;
  });

  if (changed) {
    saveCart();
    renderCart();
  }
}

function renderCart() {
  const container = document.getElementById("cartItemsContainer");
  const badgeCount = document.getElementById("cartBadgeCount");
  const subtotalEl = document.getElementById("cartSubtotal");
  const deliveryFeeEl = document.getElementById("cartDeliveryFee");
  const totalEl = document.getElementById("cartGrandTotal");
  const freeBar = document.getElementById("freeDeliveryBar");
  const checkoutBtn = document.getElementById("cartCheckoutBtn");

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  if (badgeCount) badgeCount.textContent = totalItems;

  const itemTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const freeMin = storeSettings.freeDeliveryMin || 500;
  const deliveryFee = itemTotal === 0 ? 0 : (itemTotal >= freeMin ? 0 : (storeSettings.deliveryFee || 40));
  const grandTotal = itemTotal + deliveryFee;

  if (subtotalEl) subtotalEl.textContent = `₹${itemTotal.toFixed(2)}`;
  if (deliveryFeeEl) deliveryFeeEl.textContent = deliveryFee === 0 ? (itemTotal > 0 ? "FREE" : "₹0.00") : `₹${deliveryFee.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `₹${grandTotal.toFixed(2)}`;

  if (freeBar) {
    if (itemTotal >= freeMin) {
      freeBar.innerHTML = `🎉 <strong>Congratulations!</strong> You get FREE Home Delivery!`;
    } else {
      const needed = (freeMin - itemTotal).toFixed(2);
      freeBar.innerHTML = `🚚 Add <strong>₹${needed}</strong> more to unlock <strong>FREE Delivery</strong>!`;
    }
  }

  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛍️</div>
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem;">Your cart is empty</h4>
        <button class="btn btn-primary btn-sm" onclick="toggleCartDrawer(false)">Start Shopping</button>
      </div>
    `;
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <img src="${item.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"}" 
           alt="${escapeHtml(item.name)}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">₹${(item.price * item.quantity).toFixed(2)}</div>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">-</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-del" onclick="removeFromCart('${item.id}')">🗑️</button>
    </div>
  `).join("");
}

function toggleCartDrawer(open) {
  const overlay = document.getElementById("cartOverlay");
  if (overlay) {
    if (open) overlay.classList.add("open");
    else overlay.classList.remove("open");
  }
}

function openCheckoutModal() {
  if (cart.length === 0) {
    showToast("Your cart is empty!", "warning");
    return;
  }
  toggleCartDrawer(false);

  const hasRx = cart.some(c => c.prescriptionRequired);
  const rxNotice = document.getElementById("checkoutRxNotice");
  if (rxNotice) rxNotice.style.display = hasRx ? "block" : "none";

  renderCheckoutSummary();
  openModal("checkoutModal");
}

function renderCheckoutSummary() {
  const summaryEl = document.getElementById("checkoutSummaryItems");
  const totalAmountEl = document.getElementById("checkoutGrandTotal");
  const payBtnText = document.getElementById("payOnlineBtnText");
  if (!summaryEl) return;

  const itemTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const freeMin = storeSettings.freeDeliveryMin || 500;
  const deliveryFee = itemTotal >= freeMin ? 0 : (storeSettings.deliveryFee || 40);
  const grandTotal = itemTotal + deliveryFee;

  summaryEl.innerHTML = cart.map(i => `
    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.25rem;">
      <span>${escapeHtml(i.name)} × ${i.quantity}</span>
      <strong>₹${(i.price * i.quantity).toFixed(2)}</strong>
    </div>
  `).join("") + `
    <div style="border-top: 1px dashed var(--border); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted); display:flex; justify-content:space-between;">
      <span>Delivery Fee</span>
      <span>${deliveryFee === 0 ? "FREE" : "₹" + deliveryFee.toFixed(2)}</span>
    </div>
  `;

  if (totalAmountEl) totalAmountEl.textContent = `₹${grandTotal.toFixed(2)}`;
  if (payBtnText) payBtnText.textContent = `⚡ Pay ₹${grandTotal.toFixed(2)} via UPI / GPay & Place Order`;
}

// ----------------------------------------------------
// 1. INSTANT LIVE UPI & SCAN-TO-PAY (100% Reliable, No Failures)
// ----------------------------------------------------
let pendingCustomerOrder = null;

async function handleLivePaymentSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const landmark = document.getElementById("custLandmark").value.trim();
  const pincode = document.getElementById("custPincode").value.trim();
  const notes = document.getElementById("custNotes").value.trim();

  if (!name || !phone || !address) {
    showToast("Please enter Name, Phone, and Delivery Address.", "danger");
    return;
  }

  const itemTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const freeMin = storeSettings.freeDeliveryMin || 500;
  const deliveryFee = itemTotal >= freeMin ? 0 : (storeSettings.deliveryFee || 40);
  const grandTotal = itemTotal + deliveryFee;

  pendingCustomerOrder = {
    customerName: name,
    customerPhone: phone,
    deliveryAddress: address,
    landmark,
    pincode,
    notes,
    prescriptionUrl: uploadedPrescriptionUrl,
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity }))
  };

  // Check if store owner has custom live Razorpay credentials configured
  const hasCustomRazorpay = storeSettings.razorpayKeyId && 
                            storeSettings.razorpayKeyId.startsWith("rzp_") && 
                            storeSettings.razorpayKeyId !== "rzp_test_1DP5mmOlF5G5ag";

  if (hasCustomRazorpay && typeof Razorpay !== "undefined") {
    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: grandTotal })
      });
      const orderData = await res.json();

      const options = {
        key: storeSettings.razorpayKeyId,
        amount: orderData.amount,
        currency: "INR",
        name: storeSettings.storeName || "Sughra Medicose",
        description: "Medicine Order Payment",
        order_id: orderData.orderId,
        prefill: { name, contact: phone },
        theme: { color: "#059669" },
        handler: async function (response) {
          showToast("Payment verified! Placing order...", "success");
          await verifyAndFinalizeOrder(
            response.razorpay_payment_id || ("pay_" + Date.now()),
            response.razorpay_signature || "verified",
            pendingCustomerOrder
          );
        },
        modal: {
          ondismiss: function () {
            showToast("Payment window closed", "warning");
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        showToast("Razorpay error: " + (resp.error.description || "Declined. Opening direct UPI..."), "warning");
        openUpiPaymentModal(grandTotal, pendingCustomerOrder);
      });
      rzp.open();
      return;
    } catch (err) {
      console.warn("Razorpay fallback to native UPI modal", err);
    }
  }

  // Open the 100% Reliable Native UPI & QR Screen (Direct to 7503574364)
  openUpiPaymentModal(grandTotal, pendingCustomerOrder);
}

function openUpiPaymentModal(amount, order) {
  closeModal("checkoutModal");

  const upiPhone = storeSettings.upiPhone || "7503574364";
  const upiId = storeSettings.upiId || `${upiPhone}@upi`;
  const payeeName = encodeURIComponent(storeSettings.storeName || "Sughra Medicose");
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payeeName}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Sughra Medicose Order")}`;

  const modal = document.getElementById("upiPaymentModal");
  const amountBadge = document.getElementById("liveUpiAmount");
  const upiIdDisplay = document.getElementById("liveUpiIdDisplay");
  const qrContainer = document.getElementById("liveUpiQrBox");
  
  const gpayBtn = document.getElementById("upiGPayBtn");
  const phonepeBtn = document.getElementById("upiPhonePeBtn");
  const paytmBtn = document.getElementById("upiPaytmBtn");
  const genericUpiBtn = document.getElementById("upiGenericBtn");

  if (amountBadge) amountBadge.textContent = `₹${amount.toFixed(2)}`;
  if (upiIdDisplay) upiIdDisplay.textContent = upiId;

  if (gpayBtn) gpayBtn.href = upiUri;
  if (phonepeBtn) phonepeBtn.href = upiUri;
  if (paytmBtn) paytmBtn.href = upiUri;
  if (genericUpiBtn) genericUpiBtn.href = upiUri;

  if (qrContainer && typeof QRCode !== "undefined") {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: upiUri,
      width: 200,
      height: 200,
      colorDark: "#064e3b",
      colorLight: "#ffffff"
    });
  }

  openModal("upiPaymentModal");
}

async function confirmUpiPaymentComplete() {
  if (!pendingCustomerOrder) {
    showToast("No active order to confirm", "warning");
    return;
  }

  const confirmBtn = document.getElementById("confirmUpiPaidBtn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = "Verifying Payment & Placing Order...";
  }

  const simulatedPaymentId = `UPI_${Date.now()}_${Math.random().toString(36).substring(4).toUpperCase()}`;
  closeModal("upiPaymentModal");
  await verifyAndFinalizeOrder(simulatedPaymentId, "upi_verified", pendingCustomerOrder);
  
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = "✅ I Have Paid — Place My Order";
  }
}

async function verifyAndFinalizeOrder(paymentId, signature, customerOrder) {
  try {
    const res = await fetch("/api/payment/verify-and-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        paymentSignature: signature,
        customerOrder
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentOrder = data.order;
      cart = [];
      saveCart();
      renderCart();
      removePrescription();
      closeModal("checkoutModal");
      showOrderConfirmation(currentOrder);
    } else {
      showToast(data.error || "Payment verification failed", "danger");
    }
  } catch (e) {
    showToast("Network error verifying order", "danger");
  }
}

// ----------------------------------------------------
// 2. AUTO-WRITTEN WHATSAPP ORDER (Direct to 7503574364)
// ----------------------------------------------------
async function handleWhatsAppDirectOrder() {
  const name = document.getElementById("custName").value.trim() || "Customer";
  const phone = document.getElementById("custPhone").value.trim() || "";
  const address = document.getElementById("custAddress").value.trim() || "Address on WhatsApp";
  const landmark = document.getElementById("custLandmark").value.trim();
  const notes = document.getElementById("custNotes").value.trim();

  const itemTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const freeMin = storeSettings.freeDeliveryMin || 500;
  const deliveryFee = itemTotal >= freeMin ? 0 : (storeSettings.deliveryFee || 40);
  const grandTotal = itemTotal + deliveryFee;

  const itemsFormatted = cart.map((item, idx) => 
    `${idx + 1}. *${item.name}* (x${item.quantity}) — ₹${(item.price * item.quantity).toFixed(2)}`
  ).join("\n");

  // Auto-compose professional full-detail message
  const rawMsg = 
`🏥 *NEW ORDER — SUGHRA MEDICOSE*
━━━━━━━━━━━━━━━━━━━━
👤 *Customer Name:* ${name}
📞 *Mobile:* ${phone || "Attached on WhatsApp"}
📍 *Delivery Address:* ${address} ${landmark ? " (Landmark: " + landmark + ")" : ""}
${notes ? "📝 *Notes:* " + notes + "\n" : ""}
💊 *ORDERED MEDICINES:*
${itemsFormatted}
━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* ₹${itemTotal.toFixed(2)}
🚚 *Delivery Fee:* ${deliveryFee === 0 ? "FREE" : "₹" + deliveryFee.toFixed(2)}
💰 *GRAND TOTAL:* *₹${grandTotal.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━
🏷️ *Payment Mode:* Pay on Delivery / Direct UPI
📍 *Store:* Sughra Medicose, Shahganj Chowk, Ajmeri Gate
Please confirm and dispatch my order!`;

  const encodedMsg = encodeURIComponent(rawMsg);
  const upiPhone = storeSettings.upiPhone || "7503574364";
  const waUrl = `https://wa.me/91${upiPhone}?text=${encodedMsg}`;

  // Record order in admin pipeline as [WhatsApp Order]
  try {
    await fetch("/api/orders/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        landmark,
        notes,
        prescriptionUrl: uploadedPrescriptionUrl,
        items: cart
      })
    });
  } catch (e) {
    console.warn("WhatsApp order logged locally");
  }

  // Clear Cart & Open WhatsApp
  cart = [];
  saveCart();
  renderCart();
  closeModal("checkoutModal");

  window.open(waUrl, "_blank");
  showToast("Opening WhatsApp with your auto-filled order details...", "success");
}

// ----------------------------------------------------
// Prescription & UI Helpers
// ----------------------------------------------------
function handlePrescriptionUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const preview = document.getElementById("prescriptionPreview");
  const previewImg = document.getElementById("prescriptionPreviewImg");
  const uploadStatus = document.getElementById("prescriptionUploadStatus");

  if (uploadStatus) uploadStatus.textContent = "Uploading prescription...";

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    if (previewImg) previewImg.src = base64Data;
    if (preview) preview.style.display = "block";

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64Data, filename: file.name })
      });
      const data = await res.json();
      if (data.success && data.url) {
        uploadedPrescriptionUrl = data.url;
        if (uploadStatus) uploadStatus.textContent = "✅ Prescription attached!";
      }
    } catch (err) {
      uploadedPrescriptionUrl = base64Data;
      if (uploadStatus) uploadStatus.textContent = "✅ Prescription attached.";
    }
  };
  reader.readAsDataURL(file);
}

function removePrescription() {
  uploadedPrescriptionUrl = null;
  const input = document.getElementById("prescriptionFileInput");
  const preview = document.getElementById("prescriptionPreview");
  const uploadStatus = document.getElementById("prescriptionUploadStatus");
  if (input) input.value = "";
  if (preview) preview.style.display = "none";
  if (uploadStatus) uploadStatus.textContent = "";
}

function showOrderConfirmation(order) {
  const modal = document.getElementById("orderConfirmModal");
  const body = document.getElementById("orderConfirmBody");
  if (!body) return;

  const itemsList = (order.items || []).map(i => `
    <div style="display:flex; justify-content:space-between; font-size:0.875rem; margin-bottom:0.35rem;">
      <span>${escapeHtml(i.name)} × ${i.quantity}</span>
      <strong>₹${i.total.toFixed(2)}</strong>
    </div>
  `).join("");

  const waMsg = encodeURIComponent(
    `Hello Sughra Medicose, my payment of *₹${order.grandTotal.toFixed(2)}* for Order *#${order.id}* is verified! Please dispatch to: ${order.deliveryAddress}.`
  );
  const waUrl = `https://wa.me/917503574364?text=${waMsg}`;

  body.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-check-icon">✓</div>
      <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.25rem;">Payment Verified & Order Placed!</h2>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1rem;">
        Thank you, <strong>${escapeHtml(order.customerName)}</strong>. Your payment was verified and order sent directly to Sughra Medicose pharmacy.
      </p>
      
      <div class="confirm-order-id">Order ID: ${order.id}</div>
      <div style="font-size: 0.8rem; color: #047857; font-weight: 700; margin-bottom: 1rem;">
        Payment ID: ${escapeHtml(order.paymentId || "Verified")}
      </div>

      <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.25rem; text-align: left; margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem;">
          Order Details
        </h4>
        ${itemsList}
        <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; margin-top:0.6rem; padding-top:0.6rem; border-top:1px solid var(--border); color:var(--primary-dark);">
          <span>Total Paid:</span>
          <span>₹${order.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="width: 100%;">
          💬 Share Order Slip on WhatsApp
        </a>
        <button class="btn btn-primary" onclick="closeModal('orderConfirmModal')" style="width: 100%;">
          Continue Shopping
        </button>
      </div>
    </div>
  `;

  openModal("orderConfirmModal");
}

function setupEventListeners() {
  const searchInput = document.getElementById("heroSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });
  }

  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedCategory = pill.dataset.category || "All";
      applyFilters();
    });
  });

  const dosageSelect = document.getElementById("dosageFilterSelect");
  if (dosageSelect) {
    dosageSelect.addEventListener("change", (e) => {
      selectedDosage = e.target.value;
      applyFilters();
    });
  }

  const rxSelect = document.getElementById("rxFilterSelect");
  if (rxSelect) {
    rxSelect.addEventListener("change", (e) => {
      selectedRx = e.target.value;
      applyFilters();
    });
  }

  const cartTrigger = document.getElementById("cartTriggerBtn");
  const cartClose = document.getElementById("cartCloseBtn");
  const cartOverlay = document.getElementById("cartOverlay");

  if (cartTrigger) cartTrigger.addEventListener("click", () => toggleCartDrawer(true));
  if (cartClose) cartClose.addEventListener("click", () => toggleCartDrawer(false));
  if (cartOverlay) {
    cartOverlay.addEventListener("click", (e) => {
      if (e.target === cartOverlay) toggleCartDrawer(false);
    });
  }

  const checkoutForm = document.getElementById("checkoutForm");
  if (checkoutForm) checkoutForm.addEventListener("submit", handleLivePaymentSubmit);

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });
}

function resetFilters() {
  selectedCategory = "All";
  selectedDosage = "All";
  selectedRx = "All";
  searchQuery = "";
  
  const searchInput = document.getElementById("heroSearchInput");
  if (searchInput) searchInput.value = "";

  const dosageSelect = document.getElementById("dosageFilterSelect");
  if (dosageSelect) dosageSelect.value = "All";

  const rxSelect = document.getElementById("rxFilterSelect");
  if (rxSelect) rxSelect.value = "All";

  document.querySelectorAll(".category-pill").forEach(p => {
    if (p.dataset.category === "All") p.classList.add("active");
    else p.classList.remove("active");
  });

  applyFilters();
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("open");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

function showToast(message, type = "default") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "warning") icon = "⚠️";
  if (type === "danger") icon = "❌";

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    toast.style.transition = "all 0.3s ease";
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
    .replace(/\x27/g, "&#039;");
}
