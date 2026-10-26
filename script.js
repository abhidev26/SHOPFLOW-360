
"use strict";

/* SHOPFLOW 360
   Front-end demo. Data is stored in this browser only.
*/

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const STORAGE_KEY = "shopflow360_v1";
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function initialData() {
  return {
    products: [
      { id: "p1", name: "Premium Notebook", sku: "ST-001", category: "Stationery", cost: 35, price: 55, stock: 42, reorder: 10 },
      { id: "p2", name: "Ball Pen Pack", sku: "ST-002", category: "Stationery", cost: 45, price: 70, stock: 8, reorder: 12 },
      { id: "p3", name: "Desk Organizer", sku: "OF-001", category: "Office", cost: 120, price: 190, stock: 16, reorder: 5 },
      { id: "p4", name: "A4 Paper Bundle", sku: "OF-002", category: "Office", cost: 180, price: 250, stock: 0, reorder: 8 },
      { id: "p5", name: "Water Bottle", sku: "AC-001", category: "Accessories", cost: 90, price: 150, stock: 24, reorder: 6 }
    ],
    customers: [
      { id: "c1", name: "Rahul Kumar", phone: "9876543210", email: "rahul@example.com" },
      { id: "c2", name: "Priya Shetty", phone: "9876501234", email: "priya@example.com" },
      { id: "c3", name: "Walk-in Customer", phone: "", email: "" }
    ],
    sales: [],
    expenses: [
      { id: "e1", description: "Shop electricity", category: "Utilities", amount: 850, date: today() }
    ],
    stockMovements: [],
    nextInvoice: 1001
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();

    const data = JSON.parse(raw);
    for (const key of ["products", "customers", "sales", "expenses"]) {
      if (!Array.isArray(data[key])) throw new Error("Invalid saved data");
    }

    if (!Array.isArray(data.stockMovements)) data.stockMovements = [];
    if (!Number.isInteger(data.nextInvoice)) data.nextInvoice = 1001;

    return data;
  } catch (error) {
    console.error("Could not load saved data:", error);
    alert("Saved data could not be read. The app will start with demo data. Your previous browser data has not been deleted.");
    return initialData();
  }
}

let db = loadData();
let currentPage = "dashboard";
let modalState = null;
let toastTimeout;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error("Storage error:", error);
    notify("Could not save. Browser storage may be full.");
    return false;
  }
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function totalSales() {
  return db.sales.reduce((sum, sale) => sum + sale.total, 0);
}

function totalPaid() {
  return db.sales.reduce((sum, sale) => sum + sale.paid, 0);
}

function totalDue() {
  return db.sales.reduce((sum, sale) => sum + Math.max(0, sale.total - sale.paid), 0);
}

function totalCosts() {
  return db.sales.reduce((sum, sale) =>
    sum + sale.items.reduce((itemSum, item) => itemSum + item.cost * item.qty, 0), 0);
}

function totalExpenses() {
  return db.expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

function customerSales(customerId) {
  return db.sales
    .filter(sale => sale.customerId === customerId)
    .reduce((sum, sale) => sum + sale.total, 0);
}

function customerDue(customerId) {
  return db.sales
    .filter(sale => sale.customerId === customerId)
    .reduce((sum, sale) => sum + Math.max(0, sale.total - sale.paid), 0);
}

function customerName(customerId) {
  return db.customers.find(customer => customer.id === customerId)?.name
    || "Deleted customer";
}

function dateLabel(date) {
  if (!date) return "—";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? escapeHTML(date)
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
      });
}

function emptyRow(columns, message = "No records yet.") {
  return `<tr><td colspan="${columns}">
    <div class="empty-state"><strong>Nothing here yet</strong>${escapeHTML(message)}</div>
  </td></tr>`;
}

function productAvatar(name) {
  return `<span class="product-avatar">${escapeHTML((name || "?").charAt(0).toUpperCase())}</span>`;
}

function productCell(product) {
  return `<div class="table-product">
    ${productAvatar(product.name)}
    <div><strong>${escapeHTML(product.name)}</strong>
    <small>${escapeHTML(product.category || "Uncategorized")}</small></div>
  </div>`;
}

function stockBadge(product) {
  if (product.stock <= 0) return '<span class="pill out">Out of stock</span>';
  if (product.stock <= product.reorder) return '<span class="pill low">Low stock</span>';
  return '<span class="pill paid">In stock</span>';
}

function paymentBadge(sale) {
  if (sale.paid >= sale.total) return '<span class="pill paid">Paid</span>';
  if (sale.paid > 0) return '<span class="pill due">Partial</span>';
  return '<span class="pill due">Unpaid</span>';
}

/* Navigation */

function navigate(page) {
  if (!$(`#page-${page}`)) return;

  currentPage = page;
  $$(".page").forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
  $$(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $("#breadcrumb").textContent = ({
    dashboard: "Dashboard",
    products: "Inventory",
    sales: "Sales & Billing",
    customers: "Customers",
    expenses: "Expenses",
    reports: "Reports"
  })[page];

  $("#sidebar").classList.remove("open");
  renderAll();
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-page]");
  if (nav) {
    event.preventDefault();
    navigate(nav.dataset.page);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) openRecord(action.dataset.action);
});

$("#menuButton").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("shopflow360_theme",
    document.body.classList.contains("light") ? "light" : "dark");
});

if (localStorage.getItem("shopflow360_theme") === "light") {
  document.body.classList.add("light");
}

/* Dashboard */

function renderDashboard() {
  $("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long"
  }).toUpperCase();

  $("#statSales").textContent = money(totalSales());
  $("#statProfit").textContent = money(totalSales() - totalCosts());
  $("#statDue").textContent = money(totalDue());
  $("#statProducts").textContent = db.products.reduce((sum, p) => sum + p.stock, 0);
  $("#stockCaption").textContent = `${db.products.length} unique products`;

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  const dailySales = lastSevenDays.map(date => ({
    date,
    amount: db.sales
      .filter(sale => sale.date === date)
      .reduce((sum, sale) => sum + sale.total, 0)
  }));

  const max = Math.max(1, ...dailySales.map(day => day.amount));

  $("#salesChart").innerHTML = dailySales.map(day => `
    <div class="chart-column" title="${escapeHTML(day.date)}: ${money(day.amount)}">
      <span class="chart-value">${day.amount ? escapeHTML(money(day.amount).replace("₹", "₹")) : "—"}</span>
      <div class="chart-track">
        <div class="chart-bar" style="height:${Math.max(3, day.amount / max * 100)}%"></div>
      </div>
      <span class="chart-day">${new Date(`${day.date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}</span>
    </div>
  `).join("");

  const alerts = db.products
    .filter(product => product.stock <= product.reorder)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  $("#stockAlerts").innerHTML = alerts.length ? alerts.map(product => `
    <div class="compact-item">
      <div>${productCell(product).replace('class="table-product"', 'class="table-product"')}</div>
      <span class="stock-count">${product.stock} left</span>
    </div>
  `).join("") : '<div class="empty-state"><strong>All good!</strong>No low-stock products.</div>';

  const recent = [...db.sales].sort((a, b) =>
    `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)
  ).slice(0, 5);

  $("#recentSales").innerHTML = recent.length ? recent.map(sale => `
    <tr>
      <td><strong>${escapeHTML(sale.invoice)}</strong></td>
      <td>${dateLabel(sale.date)}</td>
      <td>${money(sale.total)}</td>
      <td>${paymentBadge(sale)}</td>
    </tr>
  `).join("") : emptyRow(4, "Create your first sale to see it here.");
}

/* Inventory */

function renderProducts() {
  const query = ($("#productSearch").value || "").trim().toLowerCase();
  const products = db.products.filter(product =>
    [product.name, product.sku, product.category]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  $("#productCount").textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;

  $("#productTable").innerHTML = products.length ? products.map(product => `
    <tr>
      <td>${productCell(product)}</td>
      <td>${escapeHTML(product.sku || "—")}</td>
      <td>${money(product.price)}</td>
      <td>${money(product.cost)}</td>
      <td><strong>${product.stock}</strong><br>${stockBadge(product)}</td>
      <td><div class="action-group">
        <button class="mini-button" data-edit="product" data-id="${escapeHTML(product.id)}">Edit</button>
        <button class="mini-button danger" data-delete="product" data-id="${escapeHTML(product.id)}">Delete</button>
      </div></td>
    </tr>
  `).join("") : emptyRow(6, "Add a product or change your search.");
}

/* Sales */

function renderSales() {
  $("#salesTotal").textContent = money(totalSales());
  $("#paymentsTotal").textContent = money(totalPaid());

  const sales = [...db.sales].sort((a, b) =>
    `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)
  );

  $("#salesTable").innerHTML = sales.length ? sales.map(sale => `
    <tr>
      <td><strong>${escapeHTML(sale.invoice)}</strong></td>
      <td>${escapeHTML(customerName(sale.customerId))}</td>
      <td>${dateLabel(sale.date)}</td>
      <td>${money(sale.total)}</td>
      <td>${money(sale.paid)}</td>
      <td>${money(Math.max(0, sale.total - sale.paid))}</td>
      <td>${paymentBadge(sale)}</td>
      <td><div class="action-group">
        ${sale.paid < sale.total ? `<button class="mini-button" data-payment="${escapeHTML(sale.id)}">Receive payment</button>` : ""}
        <button class="mini-button" data-invoice="${escapeHTML(sale.id)}">Invoice</button>
        <button class="mini-button danger" data-delete="sale" data-id="${escapeHTML(sale.id)}">Delete</button>
      </div></td>
    </tr>
  `).join("") : emptyRow(8, "Create your first sale to get started.");
}

/* Customers */

function renderCustomers() {
  const query = ($("#customerSearch").value || "").trim().toLowerCase();
  const customers = db.customers.filter(customer =>
    [customer.name, customer.phone, customer.email]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  $("#customerTable").innerHTML = customers.length ? customers.map(customer => `
    <tr>
      <td>${productCell({ name: customer.name, category: customer.email || "Customer" })}</td>
      <td>${escapeHTML(customer.phone || "—")}</td>
      <td>${money(customerSales(customer.id))}</td>
      <td>${money(customerDue(customer.id))}</td>
      <td><div class="action-group">
        <button class="mini-button" data-edit="customer" data-id="${escapeHTML(customer.id)}">Edit</button>
        <button class="mini-button danger" data-delete="customer" data-id="${escapeHTML(customer.id)}">Delete</button>
      </div></td>
    </tr>
  `).join("") : emptyRow(5, "Add a customer or change your search.");
}

/* Expenses */

function renderExpenses() {
  $("#expenseTotal").textContent = money(totalExpenses());
  $("#expenseCount").textContent = db.expenses.length;

  const expenses = [...db.expenses].sort((a, b) => b.date.localeCompare(a.date));

  $("#expenseTable").innerHTML = expenses.length ? expenses.map(expense => `
    <tr>
      <td><strong>${escapeHTML(expense.description)}</strong></td>
      <td>${escapeHTML(expense.category)}</td>
      <td>${dateLabel(expense.date)}</td>
      <td>${money(expense.amount)}</td>
      <td><div class="action-group">
        <button class="mini-button" data-edit="expense" data-id="${escapeHTML(expense.id)}">Edit</button>
        <button class="mini-button danger" data-delete="expense" data-id="${escapeHTML(expense.id)}">Delete</button>
      </div></td>
    </tr>
  `).join("") : emptyRow(5, "No expenses recorded yet.");
}

/* Reports */

function renderReports() {
  const revenue = totalSales();
  const costs = totalCosts();
  const expenses = totalExpenses();

  $("#reportRevenue").textContent = money(revenue);
  $("#reportCosts").textContent = money(costs);
  $("#reportExpenses").textContent = money(expenses);
  $("#reportNet").textContent = money(revenue - costs - expenses);

  const sold = new Map();
  db.sales.forEach(sale => sale.items.forEach(item => {
    sold.set(item.name, (sold.get(item.name) || 0) + item.qty);
  }));

  const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...ranked.map(item => item[1]));

  $("#productReport").innerHTML = ranked.length ? ranked.map(([name, quantity]) => `
    <div class="report-row">
      <strong>${escapeHTML(name)}</strong>
      <div class="report-track"><div class="report-fill" style="width:${quantity / max * 100}%"></div></div>
      <span class="report-value">${quantity} sold</span>
    </div>
  `).join("") : '<div class="empty-state"><strong>No sales data yet</strong>Product rankings appear after you record sales.</div>';
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderSales();
  renderCustomers();
  renderExpenses();
  renderReports();
}

["productSearch", "customerSearch"].forEach(id => {
  $(`#${id}`).addEventListener("input", () => {
    if (id === "productSearch") renderProducts();
    else renderCustomers();
  });
});

/* Modal form builder */

const field = (name, label, type = "text", options = {}) => ({
  name, label, type, ...options
});

function selectOptions(items, selected) {
  return items.map(item => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    return `<option value="${escapeHTML(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHTML(label)}</option>`;
  }).join("");
}

function renderFields(fields, record = {}) {
  $("#formFields").innerHTML = fields.map(item => {
    const value = record[item.name] ?? item.default ?? "";
    const required = item.required === false ? "" : "required";
    const full = item.full ? "full" : "";

    let control;
    if (item.type === "select") {
      control = `<select id="field-${item.name}" name="${item.name}" ${required}>
        ${selectOptions(item.options || [], value)}
      </select>`;
    } else {
      control = `<input id="field-${item.name}" name="${item.name}"
        type="${item.type}" value="${escapeHTML(value)}"
        ${item.min !== undefined ? `min="${item.min}"` : ""}
        ${item.max !== undefined ? `max="${item.max}"` : ""}
        ${item.step ? `step="${item.step}"` : ""}
        ${item.placeholder ? `placeholder="${escapeHTML(item.placeholder)}"` : ""}
        ${required}>`;
    }

    return `<div class="form-field ${full}">
      <label for="field-${item.name}">${escapeHTML(item.label)}</label>
      ${control}
    </div>`;
  }).join("");
}

function productFields() {
  return [
    field("name", "Product name", "text", { full: true }),
    field("sku", "SKU / product code"),
    field("category", "Category"),
    field("cost", "Cost price (₹)", "number", { min: 0, step: "0.01" }),
    field("price", "Selling price (₹)", "number", { min: 0, step: "0.01" }),
    field("stock", "Current stock", "number", { min: 0, step: "1" }),
    field("reorder", "Low-stock threshold", "number", { min: 0, step: "1" })
  ];
}

function customerFields() {
  return [
    field("name", "Customer name", "text", { full: true }),
    field("phone", "Phone number", "tel", { required: false }),
    field("email", "Email", "email", { required: false })
  ];
}

function expenseFields() {
  return [
    field("description", "Expense description", "text", { full: true }),
    field("category", "Category", "select", {
      options: ["Rent", "Utilities", "Transport", "Supplies", "Salary", "Marketing", "Other"]
    }),
    field("amount", "Amount (₹)", "number", { min: 0.01, step: "0.01" }),
    field("date", "Expense date", "date", { default: today() })
  ];
}

function saleFields() {
  if (!db.products.length) return null;

  return [
    field("customerId", "Customer", "select", {
      options: db.customers.length
        ? db.customers.map(c => ({ value: c.id, label: c.name }))
        : [],
      full: true
    }),
    field("productId", "Product", "select", {
      options: db.products.map(p => ({
        value: p.id,
        label: `${p.name} — ${p.stock} available — ${money(p.price)}`
      })),
      full: true
    }),
    field("qty", "Quantity", "number", { min: 1, step: "1", default: 1 }),
    field("discount", "Discount (₹)", "number", { min: 0, step: "0.01", default: 0 }),
    field("paid", "Amount received (₹)", "number", { min: 0, step: "0.01", default: 0 }),
    field("date", "Sale date", "date", { default: today() })
  ];
}

function openRecord(action, id = null) {
  let type = action.replace("new-", "");
  if (!["product", "customer", "expense", "sale"].includes(type)) return;
if (type === "sale") {
  openPOS();
  return;
}
  const collection = type === "product" ? "products"
    : type === "customer" ? "customers"
    : type === "expense" ? "expenses" : "sales";

  const existing = id ? db[collection].find(record => record.id === id) : null;
  if (id && !existing) return notify("Record not found.");

  if (type === "sale" && !db.products.length) {
    return notify("Add a product before creating a sale.");
  }

  if (type === "sale" && !db.customers.length) {
    return notify("Add a customer before creating a sale.");
  }

  if (type === "sale" && existing) {
    return notify("Existing sales cannot be edited in this demo. Record payments or create a new sale.");
  }

  let fields = type === "product" ? productFields()
    : type === "customer" ? customerFields()
    : type === "expense" ? expenseFields() : saleFields();

  if (type === "sale" && !fields) return notify("Add a product first.");

  if (existing && type === "product") {
    fields = fields.filter(item => item.name !== "stock");
    fields.push(field("stockChange", "Stock adjustment (+ / −)", "number", {
      default: 0, min: -1000000, max: 1000000, step: "1"
    }));
  }

  if (existing && type === "customer" && customerDue(existing.id) > 0) {
    notify("This customer has an outstanding balance. Deleting them is blocked until their balance is settled.");
  }

  modalState = { type, id, collection, fields, existing };

  $("#modalTitle").textContent = `${existing ? "Edit" : "Add"} ${type === "sale" ? "sale" : type}`;
  $("#formFields").innerHTML = "";
  renderFields(fields, existing || {});
  $("#modalBackdrop").hidden = false;

  const firstInput = $("#formFields input, #formFields select");
  firstInput?.focus();
}

$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);

$("#modalBackdrop").addEventListener("click", event => {
  if (event.target === $("#modalBackdrop")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal();
});

function closeModal() {
  $("#modalBackdrop").hidden = true;
  $("#recordForm").reset();
  modalState = null;
}

/* Validate and save forms */

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberValue(value, label, min = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new Error(`${label} must be ${min === 0 ? "zero or greater" : `at least ${min}`}.`);
  }
  return number;
}

function requiredText(value, label) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function logStock(product, change, reason) {
  db.stockMovements.push({
    id: makeId(),
    productId: product.id,
    productName: product.name,
    change,
    reason,
    date: today()
  });
}

$("#recordForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!modalState) return;

  try {
    const { type, id, collection, existing } = modalState;
    const values = readForm(event.currentTarget);

    if (type === "product") {
      const name = requiredText(values.name, "Product name");
      const sku = String(values.sku || "").trim();
      const cost = numberValue(values.cost, "Cost price");
      const price = numberValue(values.price, "Selling price");
      const reorder = numberValue(values.reorder, "Reorder threshold");

      if (sku && db.products.some(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== id)) {
        throw new Error("That SKU is already in use.");
      }

      let stock;
      if (existing) {
        const change = numberValue(values.stockChange, "Stock adjustment", -1000000);
        if (!Number.isInteger(change)) throw new Error("Stock adjustment must be a whole number.");
        stock = existing.stock + change;
        if (stock < 0) throw new Error("Stock cannot be negative.");
      } else {
        stock = numberValue(values.stock, "Stock quantity");
        if (!Number.isInteger(stock)) throw new Error("Stock must be a whole number.");
      }

      const record = {
        ...(existing || { id: makeId() }),
        name, sku,
        category: String(values.category || "").trim() || "Uncategorized",
        cost, price, stock, reorder
      };

      if (existing) {
        const change = stock - existing.stock;
        Object.assign(existing, record);
        if (change) logStock(existing, change, "Manual adjustment");
      } else {
        db.products.push(record);
        if (stock) logStock(record, stock, "Opening stock");
      }

    } else if (type === "customer") {
      const name = requiredText(values.name, "Customer name");
      const phone = String(values.phone || "").trim();
      const email = String(values.email || "").trim();

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }

      const record = {
        ...(existing || { id: makeId() }),
        name, phone, email
      };

      if (existing) Object.assign(existing, record);
      else db.customers.push(record);

    } else if (type === "expense") {
      const description = requiredText(values.description, "Description");
      const amount = numberValue(values.amount, "Amount");
      if (amount <= 0) throw new Error("Expense amount must be greater than zero.");

      const record = {
        ...(existing || { id: makeId() }),
        description,
        category: values.category || "Other",
        amount,
        date: values.date || today()
      };

      if (existing) Object.assign(existing, record);
      else db.expenses.push(record);

    } else if (type === "sale") {
      const product = db.products.find(p => p.id === values.productId);
      const customer = db.customers.find(c => c.id === values.customerId);
      const qty = numberValue(values.qty, "Quantity", 1);
      const discount = numberValue(values.discount || 0, "Discount");
      const paid = numberValue(values.paid || 0, "Amount received");

      if (!Number.isInteger(qty)) throw new Error("Quantity must be a whole number.");
      if (!product || !customer) throw new Error("Select a valid product and customer.");
      if (product.stock < qty) throw new Error(`Only ${product.stock} units are available.`);
      if (discount > product.price * qty) throw new Error("Discount cannot exceed the subtotal.");

      const subtotal = product.price * qty;
      const total = Math.round((subtotal - discount) * 100) / 100;

      if (paid > total) throw new Error("Amount received cannot exceed the invoice total.");

      const sale = {
        id: makeId(),
        invoice: `SF-${db.nextInvoice}`,
        customerId: customer.id,
        date: values.date || today(),
        items: [{
          productId: product.id,
          name: product.name,
          qty,
          price: product.price,
          cost: product.cost
        }],
        subtotal,
        discount,
        total,
        paid
      };

      product.stock -= qty;
      logStock(product, -qty, `Sale ${sale.invoice}`);
      db.nextInvoice += 1;
      db.sales.push(sale);
    }

    if (!persist()) throw new Error("The record could not be saved. Please check browser storage.");
    closeModal();
    renderAll();
    notify(`${type === "sale" ? "Sale" : type[0].toUpperCase() + type.slice(1)} saved successfully.`);
  } catch (error) {
    notify(error.message || "Could not save this record.");
  }
});

/* Table actions */

document.addEventListener("click", event => {
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    openRecord(edit.dataset.edit, edit.dataset.id);
    return;
  }

  const remove = event.target.closest("[data-delete]");
  if (remove) {
    deleteRecord(remove.dataset.delete, remove.dataset.id);
    return;
  }

  const payment = event.target.closest("[data-payment]");
  if (payment) {
    receivePayment(payment.dataset.payment);
    return;
  }

  const invoice = event.target.closest("[data-invoice]");
  if (invoice) printInvoice(invoice.dataset.invoice);
});

function deleteRecord(type, id) {
  const collection = type === "product" ? "products"
    : type === "customer" ? "customers"
    : type === "expense" ? "expenses" : "sales";

  const record = db[collection].find(item => item.id === id);
  if (!record) return;

  if (type === "product" && db.sales.some(sale => sale.items.some(item => item.productId === id))) {
    return notify("This product is referenced by a sale. Keep it in the inventory instead.");
  }

  if (type === "customer" && customerDue(id) > 0) {
    return notify("Settle this customer's outstanding balance before deleting them.");
  }

  if (!confirm(`Delete ${type}: ${type === "sale" ? record.invoice : record.name || record.description}?`)) return;

  if (type === "sale") {
    record.items.forEach(item => {
      const product = db.products.find(p => p.id === item.productId);
      if (product) {
        product.stock += item.qty;
        logStock(product, item.qty, `Reversal of ${record.invoice}`);
      }
    });
  }

  db[collection] = db[collection].filter(item => item.id !== id);

  if (!persist()) return notify("Could not save changes.");
  renderAll();
  notify(`${type[0].toUpperCase() + type.slice(1)} deleted.`);
}

function receivePayment(id) {
  const sale = db.sales.find(item => item.id === id);
  if (!sale) return;

  const due = Math.round((sale.total - sale.paid) * 100) / 100;
  const input = prompt(`Invoice ${sale.invoice}\nOutstanding: ${money(due)}\nEnter payment received:`);
  if (input === null) return;

  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0 || amount > due) {
    return notify("Enter a valid amount no greater than the outstanding balance.");
  }

  sale.paid = Math.round((sale.paid + amount) * 100) / 100;
  if (!persist()) {
    sale.paid = Math.round((sale.paid - amount) * 100) / 100;
    return notify("Could not save payment.");
  }

  renderAll();
  notify("Payment recorded.");
}

/* Printable invoice */

function printInvoice(id) {
  const sale = db.sales.find(item => item.id === id);
  if (!sale) return;

  const invoiceWindow = window.open("", "_blank", "width=800,height=700");
  if (!invoiceWindow) return notify("Allow pop-ups to print invoices.");

  const items = sale.items.map(item => `
    <tr><td>${escapeHTML(item.name)}</td><td>${item.qty}</td>
    <td>${money(item.price)}</td><td>${money(item.qty * item.price)}</td></tr>
  `).join("");

  invoiceWindow.document.write(`<!DOCTYPE html>
  <html><head><title>Invoice ${escapeHTML(sale.invoice)}</title>
  <meta charset="utf-8">
  <style>
    body{font:15px Arial,sans-serif;color:#222;padding:36px}
    h1{color:#47751e}table{width:100%;border-collapse:collapse;margin:28px 0}
    th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}
    .total{text-align:right;line-height:2}
    .muted{color:#666}@media print{button{display:none}}
  </style></head><body>
    <h1>SHOPFLOW 360</h1><p class="muted">Business demo invoice</p>
    <hr><h2>Invoice ${escapeHTML(sale.invoice)}</h2>
    <p>Date: ${dateLabel(sale.date)}</p>
    <p>Customer: ${escapeHTML(customerName(sale.customerId))}</p>
    <table><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
    <tbody>${items}</tbody></table>
    <div class="total"><div>Subtotal: ${money(sale.subtotal)}</div>
    <div>Discount: ${money(sale.discount)}</div><h3>Total: ${money(sale.total)}</h3>
    <div>Paid: ${money(sale.paid)}</div>
    <div>Balance: ${money(sale.total - sale.paid)}</div></div>
    <p class="muted">Demo invoice. Configure your actual business and applicable tax details before production use.</p>
    <button onclick="window.print()">Print invoice</button>
  </body></html>`);
  invoiceWindow.document.close();
}

/* CSV exports */

function downloadFile(content, filename, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCSV(rows) {
  return rows.map(row => row.map(value =>
    `"${String(value ?? "").replace(/"/g, '""')}"`
  ).join(",")).join("\r\n");
}

$("#exportSales").addEventListener("click", () => {
  const rows = [
    ["Invoice", "Customer", "Date", "Subtotal", "Discount", "Total", "Paid", "Due"],
    ...db.sales.map(sale => [
      sale.invoice, customerName(sale.customerId), sale.date,
      sale.subtotal, sale.discount, sale.total, sale.paid, sale.total - sale.paid
    ])
  ];
  downloadFile(toCSV(rows), "shopflow-sales.csv");
  notify("Sales CSV exported.");
});

$("#exportAll").addEventListener("click", () => {
  const rows = [
    ["Record Type", "Name / Reference", "Date", "Amount", "Details"],
    ...db.products.map(p => ["Product", p.name, "", p.stock, `SKU: ${p.sku}; Cost: ${p.cost}; Price: ${p.price}`]),
    ...db.sales.map(s => ["Sale", s.invoice, s.date, s.total, `Paid: ${s.paid}; Customer: ${customerName(s.customerId)}`]),
    ...db.expenses.map(e => ["Expense", e.description, e.date, e.amount, e.category])
  ];
  downloadFile(toCSV(rows), "shopflow-report.csv");
  notify("Business report exported.");
});

/* JSON backup and restore */

$("#backupButton").addEventListener("click", () => {
  downloadFile(JSON.stringify(db, null, 2),
    `shopflow-backup-${today()}.json`, "application/json");
  notify("Backup downloaded.");
});

$("#restoreButton").addEventListener("click", () => $("#restoreFile").click());

$("#restoreFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("Backup must be smaller than 10 MB.");

    const data = JSON.parse(await file.text());
    for (const key of ["products", "customers", "sales", "expenses"]) {
      if (!Array.isArray(data[key])) throw new Error(`Backup is missing ${key}.`);
    }

    if (!data.products.every(p => typeof p.id === "string" && typeof p.name === "string" &&
        Number.isFinite(p.stock) && p.stock >= 0 && Number.isFinite(p.price) && p.price >= 0 &&
        Number.isFinite(p.cost) && p.cost >= 0)) {
      throw new Error("Backup contains invalid product records.");
    }

    if (!data.customers.every(c => typeof c.id === "string" && typeof c.name === "string")) {
      throw new Error("Backup contains invalid customers.");
    }

    if (!data.sales.every(s => typeof s.id === "string" && Array.isArray(s.items) &&
        Number.isFinite(s.total) && s.total >= 0 && Number.isFinite(s.paid) &&
        s.paid >= 0 && s.paid <= s.total &&
        s.items.every(i => typeof i.name === "string" && Number.isInteger(i.qty) && i.qty > 0 &&
          Number.isFinite(i.price) && i.price >= 0 && Number.isFinite(i.cost) && i.cost >= 0))) {
      throw new Error("Backup contains invalid sales.");
    }

    if (!data.expenses.every(e => typeof e.id === "string" &&
        typeof e.description === "string" && Number.isFinite(e.amount) && e.amount > 0)) {
      throw new Error("Backup contains invalid expenses.");
    }

    data.stockMovements = Array.isArray(data.stockMovements) ? data.stockMovements : [];
    data.nextInvoice = Number.isInteger(data.nextInvoice) ? data.nextInvoice : 1001;

    if (!confirm("Replace the current browser data with this backup? Download a backup of your current data first if needed.")) return;

    const old = db;
    db = data;
    if (!persist()) {
      db = old;
      return notify("Could not restore the backup.");
    }

    renderAll();
    notify("Backup restored.");
  } catch (error) {
    notify(error.message || "Could not restore backup.");
  } finally {
    event.target.value = "";
  }
});

/* First render */

renderAll();
navigate("dashboard");

/* =====================================================
   COMMIT 2 — MULTI-PRODUCT POS CHECKOUT
   ===================================================== */

let posCart = [];

function openPOS() {
  if (!db.products.length) {
    notify("Add a product before creating a sale.");
    return;
  }

  if (!db.customers.length) {
    notify("Add a customer before creating a sale.");
    return;
  }

  posCart = [];

  let modal = $("#posModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "posModal";
    modal.className = "modal-backdrop";
    modal.hidden = true;

    modal.innerHTML = `
      <section class="modal pos-modal" role="dialog"
        aria-modal="true" aria-labelledby="posTitle">

        <div class="modal-heading">
          <div>
            <p class="eyebrow">SMART CHECKOUT</p>
            <h2 id="posTitle">Create an invoice</h2>
          </div>
          <button class="icon-button" id="posClose"
            type="button" aria-label="Close checkout">✕</button>
        </div>

        <div class="pos-layout">
          <div>
            <label class="form-field">
              <span class="muted">Find products</span>
              <input id="posSearch" type="search"
                placeholder="Search name, SKU or category">
            </label>
            <div class="pos-products" id="posProducts"></div>
          </div>

          <div class="pos-cart">
            <h3>Shopping cart</h3>
            <p class="muted" id="posCartCount">0 items</p>
            <div class="pos-cart-items" id="posCartItems"></div>

            <div class="form-field">
              <label for="posCustomer">Customer</label>
              <select id="posCustomer"></select>
            </div>

            <div class="form-field" style="margin-top:12px">
              <label for="posDate">Invoice date</label>
              <input id="posDate" type="date" required>
            </div>

            <div class="pos-summary">
              <div class="pos-summary-row">
                <span>Subtotal</span>
                <strong id="posSubtotal">₹0.00</strong>
              </div>

              <div class="form-field">
                <label for="posDiscount">Discount (₹)</label>
                <input id="posDiscount" type="number"
                  min="0" step="0.01" value="0">
              </div>

              <div class="pos-summary-row total">
                <span>Total</span>
                <strong id="posTotal">₹0.00</strong>
              </div>

              <div class="form-field">
                <label for="posPaid">Payment received (₹)</label>
                <input id="posPaid" type="number"
                  min="0" step="0.01" value="0">
              </div>

              <div class="pos-summary-row">
                <span>Balance due</span>
                <strong id="posDue">₹0.00</strong>
              </div>
            </div>

            <button class="primary-button pos-checkout"
              id="posCheckout" type="button">
              Complete sale →
            </button>
          </div>
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    $("#posClose").addEventListener("click", closePOS);

    modal.addEventListener("click", event => {
      if (event.target === modal) closePOS();
    });

    $("#posSearch").addEventListener("input", renderPOSProducts);
    $("#posDiscount").addEventListener("input", renderPOSSummary);
    $("#posPaid").addEventListener("input", renderPOSSummary);
    $("#posProducts").addEventListener("click", handlePOSProductClick);
    $("#posCartItems").addEventListener("click", handlePOSCartClick);
    $("#posCartItems").addEventListener("change", handlePOSQuantityChange);
    $("#posCheckout").addEventListener("click", completePOSSale);
  }

  $("#posSearch").value = "";
  $("#posDiscount").value = "0";
  $("#posPaid").value = "0";
  $("#posDate").value = today();

  $("#posCustomer").innerHTML = db.customers.map(customer => `
    <option value="${escapeHTML(customer.id)}">
      ${escapeHTML(customer.name)}
    </option>
  `).join("");

  renderPOSProducts();
  renderPOSCart();
  renderPOSSummary();

  modal.hidden = false;
  $("#posSearch").focus();
}

function closePOS() {
  const modal = $("#posModal");
  if (modal) modal.hidden = true;
  posCart = [];
}

function renderPOSProducts() {
  const query = ($("#posSearch")?.value || "").trim().toLowerCase();

  const products = db.products.filter(product =>
    [product.name, product.sku, product.category].some(value =>
      String(value || "").toLowerCase().includes(query)
    )
  );

  $("#posProducts").innerHTML = products.length
    ? products.map(product => {
        const inCart = posCart.find(item => item.productId === product.id);
        const available = product.stock - (inCart?.qty || 0);

        return `
          <button type="button" class="pos-product"
            data-pos-add="${escapeHTML(product.id)}"
            ${available <= 0 ? "disabled" : ""}>
            <strong>${escapeHTML(product.name)}</strong>
            <small>${escapeHTML(product.sku || product.category || "Product")}</small>
            <small>${available} available</small>
            <span>${money(product.price)}</span>
          </button>
        `;
      }).join("")
    : '<div class="pos-empty">No matching products found.</div>';
}

function handlePOSProductClick(event) {
  const button = event.target.closest("[data-pos-add]");
  if (!button) return;

  const product = db.products.find(p => p.id === button.dataset.posAdd);
  if (!product) return;

  const item = posCart.find(p => p.productId === product.id);

  if (item) {
    if (item.qty >= product.stock) {
      return notify("You cannot exceed available stock.");
    }
    item.qty += 1;
  } else {
    if (product.stock < 1) return notify("This product is out of stock.");

    posCart.push({
      productId: product.id,
      name: product.name,
      qty: 1,
      price: product.price,
      cost: product.cost
    });
  }

  renderPOSProducts();
  renderPOSCart();
  renderPOSSummary();
}

function handlePOSCartClick(event) {
  const button = event.target.closest("[data-pos-action]");
  if (!button) return;

  const id = button.dataset.id;
  const item = posCart.find(p => p.productId === id);
  if (!item) return;

  const product = db.products.find(p => p.id === id);

  switch (button.dataset.posAction) {
    case "minus":
      item.qty -= 1;
      if (item.qty <= 0) {
        posCart = posCart.filter(p => p.productId !== id);
      }
      break;

    case "plus":
      if (product && item.qty < product.stock) {
        item.qty += 1;
      } else {
        notify("Maximum available stock reached.");
      }
      break;

    case "remove":
      posCart = posCart.filter(p => p.productId !== id);
      break;
  }

  renderPOSProducts();
  renderPOSCart();
  renderPOSSummary();
}

function handlePOSQuantityChange(event) {
  const input = event.target.closest("[data-pos-qty]");
  if (!input) return;

  const id = input.dataset.posQty;
  const item = posCart.find(p => p.productId === id);
  const product = db.products.find(p => p.id === id);

  if (!item || !product) return;

  const qty = Number(input.value);

  if (!Number.isInteger(qty) || qty < 1 || qty > product.stock) {
    notify(`Quantity must be between 1 and ${product.stock}.`);
    renderPOSCart();
    return;
  }

  item.qty = qty;
  renderPOSProducts();
  renderPOSCart();
  renderPOSSummary();
}

function renderPOSCart() {
  const count = posCart.reduce((sum, item) => sum + item.qty, 0);

  $("#posCartCount").textContent =
    `${count} item${count === 1 ? "" : "s"}`;

  $("#posCartItems").innerHTML = posCart.length
    ? posCart.map(item => `
        <div class="pos-cart-item">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <button type="button" class="mini-button pos-remove"
              data-pos-action="remove" data-id="${escapeHTML(item.productId)}">
              Remove
            </button>
          </div>

          <small>${money(item.price)} each</small>

          <div class="pos-quantity">
            <button type="button" aria-label="Decrease quantity"
              data-pos-action="minus"
              data-id="${escapeHTML(item.productId)}">−</button>

            <input aria-label="Quantity" type="number" min="1"
              max="${db.products.find(p => p.id === item.productId)?.stock || 1}"
              value="${item.qty}"
              data-pos-qty="${escapeHTML(item.productId)}">

            <button type="button" aria-label="Increase quantity"
              data-pos-action="plus"
              data-id="${escapeHTML(item.productId)}">+</button>

            <strong style="margin-left:auto">${money(item.price * item.qty)}</strong>
          </div>
        </div>
      `).join("")
    : '<div class="pos-empty">Your cart is empty. Select a product to begin.</div>';

  $("#posCheckout").disabled = posCart.length === 0;
}

function getPOSNumbers() {
  const subtotal = posCart.reduce(
    (sum, item) => sum + item.price * item.qty, 0
  );

  const discount = Number($("#posDiscount").value);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const paid = Number($("#posPaid").value);

  return { subtotal, discount, total, paid };
}

function renderPOSSummary() {
  const { subtotal, discount, total, paid } = getPOSNumbers();

  $("#posSubtotal").textContent = money(subtotal);
  $("#posTotal").textContent = money(total);
  $("#posDue").textContent = money(Math.max(0, total - paid));

  const valid =
    posCart.length > 0 &&
    Number.isFinite(discount) &&
    discount >= 0 &&
    discount <= subtotal &&
    Number.isFinite(paid) &&
    paid >= 0 &&
    paid <= total;

  $("#posCheckout").disabled = !valid;
}

function completePOSSale() {
  if (!posCart.length) return notify("Add at least one product.");

  try {
    const customerId = $("#posCustomer").value;
    const customer = db.customers.find(c => c.id === customerId);

    if (!customer) throw new Error("Select a valid customer.");

    const date = $("#posDate").value;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Select a valid invoice date.");
    }

    for (const item of posCart) {
      const product = db.products.find(p => p.id === item.productId);

      if (!product) throw new Error(`${item.name} no longer exists.`);
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        throw new Error("Invalid product quantity.");
      }
      if (product.stock < item.qty) {
        throw new Error(`Insufficient stock for ${product.name}.`);
      }

      // Refresh prices in case inventory changed while checkout was open.
      if (!Number.isFinite(product.price) || product.price < 0 ||
          !Number.isFinite(product.cost) || product.cost < 0) {
        throw new Error(`Invalid pricing for ${product.name}.`);
      }
    }

    const subtotal = Math.round(posCart.reduce((sum, item) => {
      const product = db.products.find(p => p.id === item.productId);
      return sum + product.price * item.qty;
    }, 0) * 100) / 100;

    const discount = Number($("#posDiscount").value);
    const total = Math.round((subtotal - discount) * 100) / 100;
    const paid = Number($("#posPaid").value);

    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      throw new Error("Discount must be between zero and the subtotal.");
    }

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      throw new Error("Payment must be between zero and the invoice total.");
    }

    const sale = {
      id: makeId(),
      invoice: `SF-${db.nextInvoice}`,
      customerId,
      date,
      items: posCart.map(item => {
        const product = db.products.find(p => p.id === item.productId);

        return {
          productId: product.id,
          name: product.name,
          qty: item.qty,
          price: product.price,
          cost: product.cost
        };
      }),
      subtotal,
      discount,
      total,
      paid
    };

    // Snapshot state so a failed save doesn't leave a partial sale.
    const oldProducts = db.products.map(p => ({ ...p }));
    const oldSales = [...db.sales];
    const oldMovements = [...db.stockMovements];
    const oldNextInvoice = db.nextInvoice;

    for (const item of sale.items) {
      const product = db.products.find(p => p.id === item.productId);
      product.stock -= item.qty;
      logStock(product, -item.qty, `Sale ${sale.invoice}`);
    }

    db.sales.push(sale);
    db.nextInvoice += 1;

    if (!persist()) {
      db.products = oldProducts;
      db.sales = oldSales;
      db.stockMovements = oldMovements;
      db.nextInvoice = oldNextInvoice;
      throw new Error("Sale could not be saved. No sale was completed.");
    }

    closePOS();
    renderAll();
    navigate("sales");
    notify(`Invoice ${sale.invoice} created successfully.`);
  } catch (error) {
    notify(error.message || "Unable to complete checkout.");
  }
}

/* Ensure multi-item invoices print correctly. */
const originalPrintInvoice = printInvoice;

printInvoice = function (id) {
  const sale = db.sales.find(item => item.id === id);
  if (!sale) return originalPrintInvoice(id);

  // The existing invoice printer already iterates over sale.items.
  // Multi-item POS invoices use the same compatible data structure.
  originalPrintInvoice(id);
};
