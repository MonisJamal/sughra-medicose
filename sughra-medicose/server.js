const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");

let PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const PUBLIC_DIR = path.join(__dirname, "public");

[DATA_DIR, UPLOADS_DIR, BACKUPS_DIR, PUBLIC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const MEDICINES_FILE = path.join(DATA_DIR, "medicines.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// ----------------------------------------------------
// Password Hashing & Admin Sessions
// ----------------------------------------------------
function hashPassword(password, salt = null) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (!storedHash.includes(":")) {
    return password === storedHash;
  }
  const [salt, originalHash] = storedHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === originalHash;
}

const activeSessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function createSession() {
  const token = "sm_sec_" + crypto.randomBytes(32).toString("hex");
  activeSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// ----------------------------------------------------
// Rate Limiter
// ----------------------------------------------------
const rateLimitMap = new Map();

function checkRateLimit(ip, endpointType) {
  const now = Date.now();
  const key = `${ip}:${endpointType}`;
  let record = rateLimitMap.get(key);

  let windowMs = 60 * 1000;
  let maxRequests = 120;

  if (endpointType === "login") {
    windowMs = 15 * 60 * 1000;
    maxRequests = 10;
  } else if (endpointType === "order") {
    windowMs = 5 * 60 * 1000;
    maxRequests = 30;
  }

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, record);
    return true;
  }

  record.count++;
  if (record.count > maxRequests) {
    return false;
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }
  for (const [token, session] of activeSessions.entries()) {
    if (now > session.expiresAt) activeSessions.delete(token);
  }
}, 5 * 60 * 1000);

// ----------------------------------------------------
// Database Helpers (Atomic File Writes)
// ----------------------------------------------------
function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, "utf8");
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (e) {
    console.error(`[DB Error] Reading JSON from ${file}:`, e.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    const tempFile = `${file}.tmp.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, file);
    return true;
  } catch (e) {
    console.error(`[DB Error] Writing JSON to ${file}:`, e.message);
    return false;
  }
}

// ----------------------------------------------------
// Real-Time Server-Sent Events (SSE) Bus
// ----------------------------------------------------
const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(": ping\n\n");
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 25000);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf"
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error("Request entity too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function isAuthValid(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  if (isValidSession(token)) return true;

  const settings = readJSON(SETTINGS_FILE, {});
  const storedPassword = settings.adminPassword || "sughra123";
  if (token === storedPassword || token === "sughra_admin_token_" + storedPassword) {
    return true;
  }
  return false;
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
}

// ----------------------------------------------------
// HTTP Server & Router
// ----------------------------------------------------
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  const clientIp = getClientIp(req);
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith("/api/") && pathname !== "/api/events") {
    if (!checkRateLimit(clientIp, "general")) {
      return sendJSON(res, 429, { error: "Too many requests. Please slow down." });
    }
  }

  try {
    // SSE Realtime Events Endpoint
    if (pathname === "/api/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no"
      });
      res.write("event: connected\ndata: {\"connected\":true}\n\n");
      sseClients.add(res);

      req.on("close", () => {
        sseClients.delete(res);
      });
      return;
    }

    // API: Admin Login
    if (pathname === "/api/auth/login" && req.method === "POST") {
      if (!checkRateLimit(clientIp, "login")) {
        return sendJSON(res, 429, { error: "Too many login attempts. Please wait 15 minutes." });
      }

      const body = await parseBody(req);
      const settings = readJSON(SETTINGS_FILE, {});
      const storedPassword = settings.adminPassword || "sughra123";

      if (body.password && verifyPassword(body.password, storedPassword)) {
        const token = createSession();
        return sendJSON(res, 200, {
          success: true,
          token,
          storeName: settings.storeName,
          owner: settings.owner
        });
      } else {
        return sendJSON(res, 401, {
          success: false,
          error: "Invalid admin password or PIN"
        });
      }
    }

    // API: Settings
    if (pathname === "/api/settings") {
      if (req.method === "GET") {
        const settings = readJSON(SETTINGS_FILE, {});
        const safeSettings = { ...settings };
        delete safeSettings.adminPassword;
        return sendJSON(res, 200, safeSettings);
      }
      if (req.method === "PUT") {
        if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
        const body = await parseBody(req);
        const current = readJSON(SETTINGS_FILE, {});
        
        const updated = { ...current, ...body };
        if (body.adminPassword) {
          updated.adminPassword = hashPassword(body.adminPassword);
        }
        
        writeJSON(SETTINGS_FILE, updated);
        broadcastSSE("settings_updated", updated);
        return sendJSON(res, 200, { success: true, settings: updated });
      }
    }

    // API: Analytics
    if (pathname === "/api/analytics" && req.method === "GET") {
      if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
      const orders = readJSON(ORDERS_FILE, []);
      const medicines = readJSON(MEDICINES_FILE, []);
      
      let totalRevenue = 0;
      let todayRevenue = 0;
      let todayOrders = 0;
      const todayDateStr = new Date().toISOString().slice(0, 10);

      const statusCounts = {
        Pending: 0,
        Accepted: 0,
        Preparing: 0,
        "Out for Delivery": 0,
        Delivered: 0,
        Cancelled: 0
      };

      const itemSales = {};

      for (const order of orders) {
        if (order.status !== "Cancelled") {
          totalRevenue += (order.grandTotal || 0);
          const orderDate = (order.createdAt || "").slice(0, 10);
          if (orderDate === todayDateStr) {
            todayRevenue += (order.grandTotal || 0);
            todayOrders += 1;
          }
          if (Array.isArray(order.items)) {
            for (const item of order.items) {
              itemSales[item.name] = (itemSales[item.name] || 0) + (item.quantity || 1);
            }
          }
        }
        if (statusCounts[order.status] !== undefined) {
          statusCounts[order.status]++;
        }
      }

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockCount = 0;
      let inventoryValuation = 0;

      for (const med of medicines) {
        totalStockCount += (med.stock || 0);
        inventoryValuation += ((med.stock || 0) * (med.price || 0));
        if (med.stock === 0) outOfStockCount++;
        else if (med.stock <= (med.minStockThreshold || 10)) lowStockCount++;
      }

      const topProducts = Object.entries(itemSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return sendJSON(res, 200, {
        totalOrders: orders.length,
        todayOrders,
        totalRevenue,
        todayRevenue,
        statusCounts,
        topProducts,
        totalMedicines: medicines.length,
        totalStockCount,
        lowStockCount,
        outOfStockCount,
        inventoryValuation
      });
    }

    // API: Medicines CRUD
    if (pathname === "/api/medicines") {
      const medicines = readJSON(MEDICINES_FILE, []);

      if (req.method === "GET") {
        return sendJSON(res, 200, medicines);
      }

      if (req.method === "POST") {
        if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
        const body = await parseBody(req);
        
        if (!body.name || !body.price || isNaN(parseFloat(body.price))) {
          return sendJSON(res, 400, { error: "Valid medicine name and price are required" });
        }

        const newMedicine = {
          id: "med_" + Date.now(),
          name: String(body.name).trim(),
          genericName: String(body.genericName || "").trim(),
          category: String(body.category || "General Health").trim(),
          dosageForm: String(body.dosageForm || "Tablet").trim(),
          packSize: String(body.packSize || "1 Unit").trim(),
          manufacturer: String(body.manufacturer || "Generic").trim(),
          mrp: Math.max(0, parseFloat(body.mrp) || parseFloat(body.price)),
          price: Math.max(0, parseFloat(body.price)),
          discount: body.mrp && body.price && parseFloat(body.mrp) > parseFloat(body.price) 
            ? Math.round(((parseFloat(body.mrp) - parseFloat(body.price)) / parseFloat(body.mrp)) * 100)
            : 0,
          stock: Math.max(0, parseInt(body.stock, 10) || 0),
          minStockThreshold: Math.max(1, parseInt(body.minStockThreshold, 10) || 10),
          batchNo: String(body.batchNo || "BATCH-" + Date.now().toString().slice(-4)),
          expiryDate: String(body.expiryDate || "2027-12-31"),
          prescriptionRequired: Boolean(body.prescriptionRequired),
          image: body.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
          description: String(body.description || "").trim(),
          dosageInstructions: String(body.dosageInstructions || "As directed by physician").trim(),
          storage: String(body.storage || "Store below 25°C in a dry place").trim(),
          tags: Array.isArray(body.tags) ? body.tags : [body.name.toLowerCase(), (body.genericName || "").toLowerCase()]
        };

        medicines.unshift(newMedicine);
        writeJSON(MEDICINES_FILE, medicines);

        broadcastSSE("catalog_updated", { action: "add", medicine: newMedicine, medicines });
        return sendJSON(res, 201, { success: true, medicine: newMedicine });
      }
    }

    if (pathname.startsWith("/api/medicines/")) {
      const parts = pathname.split("/").filter(Boolean);
      const id = parts[2];
      const isStockPatch = parts[3] === "stock";
      const medicines = readJSON(MEDICINES_FILE, []);
      const index = medicines.findIndex(m => m.id === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: "Medicine not found" });
      }

      if (req.method === "GET") {
        return sendJSON(res, 200, medicines[index]);
      }

      if (req.method === "PUT") {
        if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
        const body = await parseBody(req);
        
        const existing = medicines[index];
        const updated = {
          ...existing,
          ...body,
          id: existing.id,
          mrp: body.mrp !== undefined ? parseFloat(body.mrp) : existing.mrp,
          price: body.price !== undefined ? parseFloat(body.price) : existing.price,
          stock: body.stock !== undefined ? Math.max(0, parseInt(body.stock, 10)) : existing.stock,
          minStockThreshold: body.minStockThreshold !== undefined ? Math.max(1, parseInt(body.minStockThreshold, 10)) : existing.minStockThreshold,
          prescriptionRequired: body.prescriptionRequired !== undefined ? Boolean(body.prescriptionRequired) : existing.prescriptionRequired
        };

        if (updated.mrp && updated.price && updated.mrp > updated.price) {
          updated.discount = Math.round(((updated.mrp - updated.price) / updated.mrp) * 100);
        }

        medicines[index] = updated;
        writeJSON(MEDICINES_FILE, medicines);

        broadcastSSE("catalog_updated", { action: "update", medicine: updated, medicines });
        return sendJSON(res, 200, { success: true, medicine: updated });
      }

      if (req.method === "PATCH" && isStockPatch) {
        if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
        const body = await parseBody(req);
        
        if (body.stock !== undefined) {
          medicines[index].stock = Math.max(0, parseInt(body.stock, 10));
        } else if (body.delta !== undefined) {
          medicines[index].stock = Math.max(0, (medicines[index].stock || 0) + parseInt(body.delta, 10));
        }

        writeJSON(MEDICINES_FILE, medicines);
        broadcastSSE("catalog_updated", { action: "stock_update", medicine: medicines[index], medicines });
        return sendJSON(res, 200, { success: true, medicine: medicines[index] });
      }

      if (req.method === "DELETE") {
        if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
        medicines.splice(index, 1);
        writeJSON(MEDICINES_FILE, medicines);

        broadcastSSE("catalog_updated", { action: "delete", id, medicines });
        return sendJSON(res, 200, { success: true, deletedId: id });
      }
    }

    // ----------------------------------------------------
    // API: Orders (UPI with Dynamic QR, COD, WhatsApp)
    // ----------------------------------------------------
    if (pathname === "/api/orders") {
      const orders = readJSON(ORDERS_FILE, []);

      if (req.method === "GET") {
        return sendJSON(res, 200, orders);
      }

      if (req.method === "POST") {
        if (!checkRateLimit(clientIp, "order")) {
          return sendJSON(res, 429, { error: "Order limit exceeded. Please wait a few moments." });
        }

        const body = await parseBody(req);
        
        if (!body.customerName || !body.customerPhone || !body.deliveryAddress || !Array.isArray(body.items) || body.items.length === 0) {
          return sendJSON(res, 400, { error: "Missing required order information" });
        }

        const settings = readJSON(SETTINGS_FILE, {});
        const medicines = readJSON(MEDICINES_FILE, []);

        let itemTotal = 0;
        const processedItems = [];

        for (const cartItem of body.items) {
          const med = medicines.find(m => m.id === cartItem.id);
          const price = med ? med.price : (parseFloat(cartItem.price) || 0);
          const quantity = Math.max(1, parseInt(cartItem.quantity, 10) || 1);
          const lineTotal = price * quantity;
          itemTotal += lineTotal;

          if (med) {
            med.stock = Math.max(0, (med.stock || 0) - quantity);
          }

          processedItems.push({
            id: cartItem.id,
            name: med ? med.name : (cartItem.name || "Medicine"),
            genericName: med ? med.genericName : "",
            price,
            quantity,
            total: lineTotal
          });
        }

        writeJSON(MEDICINES_FILE, medicines);

        const freeDeliveryMin = settings.freeDeliveryMin || 500;
        const deliveryFee = itemTotal >= freeDeliveryMin ? 0 : (settings.deliveryFee || 40);
        const grandTotal = itemTotal + deliveryFee;

        const randomNum = Math.floor(10000 + Math.random() * 90000);
        const orderId = "SM-" + randomNum;

        const paymentMethod = body.paymentMethod || "UPI";
        let paymentStatus = "Pending Verification";
        if (paymentMethod === "COD") paymentStatus = "COD Pending";
        else if (paymentMethod === "WhatsApp") paymentStatus = "WhatsApp Order";

        const newOrder = {
          id: orderId,
          customerName: String(body.customerName).trim().slice(0, 100),
          customerPhone: String(body.customerPhone).trim().slice(0, 20),
          deliveryAddress: String(body.deliveryAddress).trim().slice(0, 300),
          landmark: String(body.landmark || "").trim().slice(0, 150),
          pincode: String(body.pincode || "").trim().slice(0, 10),
          notes: String(body.notes || "").trim().slice(0, 300),
          prescriptionUrl: body.prescriptionUrl || null,
          items: processedItems,
          itemTotal,
          deliveryFee,
          discount: 0,
          grandTotal,
          paymentMethod,
          paymentStatus,
          upiPhone: settings.upiPhone || "7503574364",
          upiId: settings.upiId || "7503574364@upi",
          status: "Pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        orders.unshift(newOrder);
        writeJSON(ORDERS_FILE, orders);

        // Realtime broadcast: triggers instant audio beep in Admin!
        broadcastSSE("new_order", newOrder);
        broadcastSSE("catalog_updated", { action: "stock_update", medicines });

        return sendJSON(res, 201, {
          success: true,
          order: newOrder
        });
      }
    }

    // Order status update: /api/orders/:id/status
    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/status") && req.method === "PATCH") {
      if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
      const parts = pathname.split("/").filter(Boolean);
      const id = parts[2];
      const body = await parseBody(req);
      const orders = readJSON(ORDERS_FILE, []);
      const index = orders.findIndex(o => o.id === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: "Order not found" });
      }

      if (body.status) {
        orders[index].status = body.status;
        orders[index].updatedAt = new Date().toISOString();
        if (body.paymentStatus) {
          orders[index].paymentStatus = body.paymentStatus;
        } else if (body.status === "Delivered") {
          orders[index].paymentStatus = "Paid & Completed";
        }
      }

      writeJSON(ORDERS_FILE, orders);
      broadcastSSE("order_status_updated", orders[index]);
      return sendJSON(res, 200, { success: true, order: orders[index] });
    }

    // Admin 1-Click Payment Confirmation: /api/orders/:id/confirm-payment
    if (pathname.startsWith("/api/orders/") && pathname.endsWith("/confirm-payment") && req.method === "PATCH") {
      if (!isAuthValid(req)) return sendJSON(res, 403, { error: "Unauthorized" });
      const parts = pathname.split("/").filter(Boolean);
      const id = parts[2];
      const orders = readJSON(ORDERS_FILE, []);
      const index = orders.findIndex(o => o.id === id);

      if (index === -1) {
        return sendJSON(res, 404, { error: "Order not found" });
      }

      orders[index].paymentStatus = "Verified & Paid";
      orders[index].status = orders[index].status === "Pending" ? "Accepted" : orders[index].status;
      orders[index].updatedAt = new Date().toISOString();

      writeJSON(ORDERS_FILE, orders);
      broadcastSSE("order_status_updated", orders[index]);
      return sendJSON(res, 200, { success: true, order: orders[index] });
    }

    // API: File Uploads
    if (pathname === "/api/upload" && req.method === "POST") {
      const body = await parseBody(req);
      
      if (!body.data) {
        return sendJSON(res, 400, { error: "No image data received" });
      }

      const matches = body.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = ".jpg";

      if (matches && matches.length === 3) {
        const mime = matches[1].toLowerCase();
        if (mime.includes("png")) ext = ".png";
        else if (mime.includes("webp")) ext = ".webp";
        else if (mime.includes("pdf")) ext = ".pdf";
        else if (mime.includes("jpeg") || mime.includes("jpg")) ext = ".jpg";
        else {
          return sendJSON(res, 400, { error: "Unsupported file type. Please upload JPG, PNG, WebP, or PDF." });
        }
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(body.data, "base64");
      }

      if (buffer.length > 10 * 1024 * 1024) {
        return sendJSON(res, 400, { error: "File size exceeds 10MB limit." });
      }

      const filename = "upload_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex") + ext;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      return sendJSON(res, 200, {
        success: true,
        url: "/uploads/" + filename,
        filename
      });
    }

    // Static Files & Routing
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };

    if (pathname === "/admin" || pathname === "/admin/") {
      const adminPath = path.join(PUBLIC_DIR, "admin.html");
      if (fs.existsSync(adminPath)) {
        res.writeHead(200, { ...securityHeaders, "Content-Type": "text/html; charset=utf-8" });
        return fs.createReadStream(adminPath).pipe(res);
      }
    }

    if (pathname.startsWith("/uploads/")) {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { ...securityHeaders, "Content-Type": contentType });
        return fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { ...securityHeaders, "Content-Type": "text/plain" });
        return res.end("File not found");
      }
    }

    let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    let safeFilePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

    if (!safeFilePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { ...securityHeaders, "Content-Type": "text/plain" });
      return res.end("Forbidden");
    }

    if (fs.existsSync(safeFilePath) && fs.statSync(safeFilePath).isFile()) {
      const ext = path.extname(safeFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "text/plain";
      res.writeHead(200, { ...securityHeaders, "Content-Type": contentType });
      return fs.createReadStream(safeFilePath).pipe(res);
    }

    const indexFallback = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexFallback)) {
      res.writeHead(200, { ...securityHeaders, "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(indexFallback).pipe(res);
    }

    res.writeHead(404, { ...securityHeaders, "Content-Type": "text/plain" });
    res.end("Not Found");

  } catch (err) {
    console.error("[Unhandled Server Error]:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
});

let attempts = 0;
function tryListen(port) {
  server.listen(port, () => {
    console.log(`====================================================`);
    console.log(`  SUGHRA MEDICOSE — Direct UPI & QR Pharmacy Platform`);
    console.log(`  1. Frontend User App:   http://localhost:${port}/`);
    console.log(`  2. Admin Management:    http://localhost:${port}/admin`);
    console.log(`  UPI Phone Number:       7503574364`);
    console.log(`  Admin Default Password: sughra123`);
    console.log(`====================================================`);
  });
}

server.on("error", (e) => {
  if (e.code === "EADDRINUSE" && attempts < 5) {
    attempts++;
    PORT = PORT + 1;
    console.log(`Port busy, trying port ${PORT}...`);
    tryListen(PORT);
  } else {
    console.error("[Server Error]:", e.message);
  }
});

tryListen(PORT);
