/**
 * ==========================================
 * TAILWIND CONFIGURATION
 * ==========================================
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Cairo", "sans-serif"] },
      colors: {
        brand: { dark: "#0f172a", gold: "#d4af37", bg: "#f8fafc" },
        dash: { primary: "#2c3e50", accent: "#f39c12" },
      },
    },
  },
};

/**
 * ==========================================
 * STATE & STORAGE (Delta System)
 * ==========================================
 */
let clientsDB = [];
let trashDB = [];
let activeClient = null;

// Fetch data on page load
async function loadDB() {
  try {
    const res = await fetch("/api/data");
    const data = await res.json();
    clientsDB = data.clientsDB || [];
    trashDB = data.trashDB || [];
    renderDashboard();
  } catch (err) {
    console.error("Failed to load DB from backend:", err);
  }
}

// Call load DB on initialization
loadDB();

async function saveDB() {
  try {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientsDB, trashDB }),
    });
  } catch (err) {
    console.error("Failed to save DB to backend:", err);
  }
}

/**
 * ==========================================
 * AUTHENTICATION
 * ==========================================
 */
function handleLogin() {
  const user = document.getElementById("userInput").value.trim();
  const pass = document.getElementById("passInput").value;
  const authorized = ["فوزي", "محمود", "نجاح", "وليد", "omar"];

  if (authorized.includes(user) && pass === "123456789") {
    document.getElementById("login-wrapper").classList.add("page-hidden");
    document
      .getElementById("dashboard-wrapper")
      .classList.remove("page-hidden");
    document.getElementById("adminName").innerText = user;
    renderDashboard();
  } else {
    document.getElementById("errorMessage").classList.remove("hidden");
  }
}

/**
 * ==========================================
 * DASHBOARD & MAIN VIEWS
 * ==========================================
 */
function renderDashboard(query = "") {
  const tbody = document.getElementById("mainTableBody");
  tbody.innerHTML = "";
  const filtered = clientsDB.filter(
    (c) => c.name.includes(query) || c.plot.includes(query),
  );

  filtered.forEach((c) => {
    const totalTips = c.tips.reduce((acc, t) => acc + parseFloat(t.amount), 0);
    const totalExpenses = c.expenses.reduce(
      (acc, e) => acc + parseFloat(e.amount),
      0,
    );
    const owed = c.paid - totalExpenses;

    // تم إضافة تنسيقات UI الخاصة بالصور الدائرية والألوان لتتطابق مع التصميم الجميل
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 dark:hover:bg-slate-700 transition group">
        <td class="border-x border-gray-100 dark:border-slate-700">
           ${c.name}
        </td>
        <td class="border-x border-gray-100 dark:border-slate-700">${c.plot}</td>
        <td class="text-red-600 font-black border-x border-gray-100 dark:border-slate-700">${owed.toLocaleString()} ج.م</td>
        <td dir="ltr" class="border-x border-gray-100 dark:border-slate-700 font-bold">${c.phone || "---"}</td>
        <td class="rounded-l-2xl border-r-0 ">
          <div class="flex gap-2 justify-end w-fit">
            <button onclick="openClientPage('${c.id}')" class="bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg font-bold hover:bg-[#2c3e50] hover:text-white transition">عرض</button>
            <button onclick="deleteClient('${c.id}')" class="bg-red-50 dark:bg-red-900/30 text-red-500 px-3 py-2 rounded-lg font-bold hover:bg-red-500 hover:text-white transition"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  });
}

function backToDashboard() {
  document.getElementById("client-wrapper").classList.add("page-hidden");
  document.getElementById("dashboard-wrapper").classList.remove("page-hidden");
  renderDashboard();
}

/**
 * ==========================================
 * CLIENT MANAGEMENT (CRUD)
 * ==========================================
 */
function createNewClient() {
  const name = document.getElementById("newC_Name").value;
  const plot = document.getElementById("newC_Plot").value;
  const total = parseFloat(document.getElementById("newC_Total").value) || 0;

  if (name && plot && total) {
    const newClient = {
      id: Date.now().toString(),
      name,
      plot,
      totalContract: total,
      paid: total,
      phone: "",
      expenses: [],
      tips: [],
      docs: [],
    };
    clientsDB.push(newClient);
    saveDB();
    renderDashboard();
    toggleNewClientModal();
    // تصفير المدخلات
    document.getElementById("newC_Name").value = "";
    document.getElementById("newC_Plot").value = "";
    document.getElementById("newC_Total").value = "";
  }
}

function deleteClient(id) {
  showConfirmModal(
    "تأكيد الحذف",
    "هل أنت متأكد من رغبتك في نقل هذا العميل لسلة المهملات؟",
    () => {
      const idx = clientsDB.findIndex((c) => c.id === id);
      if (idx !== -1) {
        trashDB.push(clientsDB.splice(idx, 1)[0]);
        saveDB();
        renderDashboard();
      }
    },
  );
}

function restoreClient(id) {
  const idx = trashDB.findIndex((c) => c.id === id);
  clientsDB.push(trashDB.splice(idx, 1)[0]);
  saveDB();
  renderDashboard();
  document.getElementById("trashModal").classList.add("hidden");
}

/**
 * ==========================================
 * CLIENT DETAILS UI
 * ==========================================
 */
function openClientPage(id) {
  activeClient = clientsDB.find((c) => c.id === id);
  document.getElementById("dashboard-wrapper").classList.add("page-hidden");
  document.getElementById("client-wrapper").classList.remove("page-hidden");

  updateClientDOM();
}

function updateClientDOM() {
  if (!activeClient) return;
  document.getElementById("clientNameText").innerText = activeClient.name;
  document.getElementById("clientPlotText").innerText =
    "قطعة: " + activeClient.plot;
  document.getElementById("clientPhoneText").innerText =
    activeClient.phone || "لا يوجد";
  document.getElementById("totalContractText").innerText =
    activeClient.totalContract.toLocaleString();

  const expenses = activeClient.expenses.reduce(
    (acc, e) => acc + parseFloat(e.amount),
    0,
  );
  document.getElementById("paidAmountText").innerText = (
    activeClient.paid - expenses
  ).toLocaleString();

  const totalTips = activeClient.tips.reduce(
    (acc, t) => acc + parseFloat(t.amount),
    0,
  );
  const totalExpenses = activeClient.expenses.reduce(
    (acc, e) => acc + parseFloat(e.amount),
    0,
  );
  const paid = activeClient.paid;
  const tips = activeClient.tips.reduce(
    (acc, e) => acc + parseFloat(e.amount),
    0,
  );
  const owed = tips;

  document.getElementById("owedAmountText").innerText = owed.toLocaleString();

  // رندر الجداول
  renderClientExpenses();
  renderClientTips();
  renderClientDocuments();
  renderClientPDFs();
}

function renderClientExpenses() {
  document.getElementById("expensesTableBody").innerHTML = activeClient.expenses
    .map(
      (e) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${e.reason}</td>
          <td class="p-3 text-gray-500 text-xs">${e.date || "---"}</td>
          <td class="p-3 text-red-500 font-bold">-${e.amount} ج.م</td>
        </tr>`,
    )
    .join("");
}

function renderClientTips() {
  document.getElementById("tipsTableBody").innerHTML = activeClient.tips
    .map(
      (t) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${t.reason}</td>
          <td class="p-3 text-gray-500 dark:text-gray-400 text-xs">${t.payer}</td>
          <td class="p-3 text-gray-500 text-xs">${t.date || "---"}</td>
          <td class="p-3 text-orange-600 font-bold">+${t.amount} ج.م</td>
        </tr>`,
    )
    .join("");
}

function renderClientDocuments() {
  document.getElementById("documentsTableBody").innerHTML = activeClient.docs
    .map(
      (d, i) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-4 font-bold text-brand-primary dark:text-gray-200">${d.person}</td>
          <td class="p-4">${d.name}</td>
          <td class="p-4 text-gray-500 dark:text-gray-400">${d.purpose}</td>
          <td class="p-4 font-bold">${d.place}</td>
          <td class="p-4 text-gray-500 text-xs">${d.date || "---"}</td>
          <td class="p-4">
            <button onclick="editDoc(${i})" class="bg-blue-50 text-blue-600 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-bold hover:bg-blue-100 transition"><i class="fas fa-pen"></i> تعديل</button>
          </td>
        </tr>`,
    )
    .join("");
}

function renderClientPDFs() {
  const pdfs = activeClient.pdfs || [];
  document.getElementById("pdfTableBody").innerHTML = pdfs.length
    ? pdfs
        .map(
          (p) => `
        <tr class="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          <td class="p-3 font-bold">${p.originalName}</td>
          <td class="p-3 text-gray-500 text-xs">${p.date}</td>
          <td class="p-3 text-center">
            <div class="flex gap-2 justify-center">
              <button onclick="previewPDF('${p.path}', '${p.originalName}')" class="bg-blue-50 text-blue-600 dark:bg-blue-900/30 px-3 py-1 rounded-lg font-bold hover:bg-blue-500 hover:text-white transition flex items-center gap-1">
                <i class="fas fa-eye"></i> معاينة
              </button>
              <button onclick="downloadPDF('${p.path}', '${p.originalName}')" class="bg-green-50 text-green-600 dark:bg-green-900/30 px-3 py-1 rounded-lg font-bold hover:bg-green-500 hover:text-white transition flex items-center gap-1">
                <i class="fas fa-download"></i> تحميل
              </button>
              <button onclick="deletePDF('${activeClient.id}', '${p.filename}')" class="bg-red-50 text-red-600 dark:bg-red-900/30 px-3 py-1 rounded-lg font-bold hover:bg-red-500 hover:text-white transition flex items-center gap-1">
                <i class="fas fa-trash"></i> حذف
              </button>
            </div>
          </td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="p-6 text-center text-gray-400 font-bold">لا توجد ملفات مرفوعة</td></tr>`;
}

/**
 * ==========================================
 * PDF ACTIONS (PREVIEW, DOWNLOAD, DELETE)
 * ==========================================
 */

/**
 * ==========================================
 * PDF ACTIONS (PREVIEW, DOWNLOAD, DELETE)
 * ==========================================
 */

function previewPDF(url, title) {
  const modal = document.getElementById("pdfPreviewModal");
  const container = document.getElementById("embedpdf-container");
  const loading = document.getElementById("pdfLoading");
  const titleEl = document.getElementById("pdfPreviewTitle");

  titleEl.textContent = `معاينة: ${title}`;
  modal.classList.remove("hidden");
  // loading.classList.remove("hidden");

  // Clear previous content
  container.innerHTML = "";

  // Initialize EmbedPDF
  // Note: EmbedPDF becomes available globally via the snippet script
  if (window.EmbedPDF) {
    window.EmbedPDF.init({
      type: "container",
      target: container,
      src: url,
      theme: { preference: "system" },
    });
  } else {
    console.error("EmbedPDF library not loaded");
    alert("تعذر تحميل معاين الملفات المتقدم");
    closePDFPreview();
  }
}

function closePDFPreview() {
  const modal = document.getElementById("pdfPreviewModal");
  const container = document.getElementById("embedpdf-container");

  modal.classList.add("hidden");
  container.innerHTML = ""; // Cleanup
}

function downloadPDF(url, originalName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = originalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function deletePDF(clientId, filename) {
  showConfirmModal(
    "حذف الملف",
    "هل أنت متأكد من حذف هذا الملف نهائياً؟",
    async () => {
      try {
        const res = await fetch("/api/delete-pdf", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, filename }),
        });
        const data = await res.json();
        if (data.success) {
          activeClient.pdfs = activeClient.pdfs.filter(
            (p) => p.filename !== filename,
          );
          renderClientPDFs();
          loadDB(); // التزامن مع سيرفر
        } else {
          alert("فشل حذف الملف: " + data.error);
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert("حدث خطأ أثناء اتصال السيرفر");
      }
    },
  );
}

async function handleFileUpload(input) {
  const file = input.files[0];
  if (!file || !activeClient) return;

  if (file.type !== "application/pdf") {
    alert("يرجى اختيار ملف PDF فقط");
    return;
  }

  const formData = new FormData();
  formData.append("pdf", file);
  formData.append("clientId", activeClient.id);

  try {
    const res = await fetch("/api/upload-pdf", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      if (!activeClient.pdfs) activeClient.pdfs = [];
      activeClient.pdfs.push(data.pdf);
      renderClientPDFs();
      // تشغيل تحميل البيانات مرة أخرى للتزامن الكامل
      loadDB();
    } else {
      alert("فشل رفع الملف: " + data.error);
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("حدث خطأ أثناء الرفع");
  } finally {
    input.value = ""; // تصفير المدخل
  }
}

/**
 * ==========================================
 * TRANSACTIONS
 * ==========================================
 */
function addExp() {
  const r = document.getElementById("in1").value;
  const a = parseFloat(document.getElementById("in2").value);
  const d = document.getElementById("inExpDate").value;
  if (r && a) {
    activeClient.expenses.push({ reason: r, amount: a, date: d });
    saveDB();
    updateClientDOM();
    closeSubModal();
  }
}

function addTip() {
  const r = document.getElementById("in1").value;
  const p = document.getElementById("in2").value;
  const a = parseFloat(document.getElementById("in3").value);
  const d = document.getElementById("inTipDate").value;
  if (r && a) {
    activeClient.tips.push({ reason: r, payer: p, amount: a, date: d });
    saveDB();
    updateClientDOM();
    closeSubModal();
  }
}

function addDoc() {
  const p = document.getElementById("in1").value;
  const n = document.getElementById("in2").value;
  const g = document.getElementById("in3").value;
  const l = document.getElementById("in4").value;
  const d = document.getElementById("inDocDate").value;
  if (p && n) {
    activeClient.docs.push({
      person: p,
      name: n,
      purpose: g,
      place: l,
      date: d,
    });
    saveDB();
    updateClientDOM();
    closeModals();
  }
}

/**
 * ==========================================
 * INLINE EDITING
 * ==========================================
 */
let currentEditField = null;

function requestEdit(field, type = "text", title = "القيمة") {
  currentEditField = field;
  document.getElementById("editModalTitle").innerText = `تعديل ${title}`;
  document.getElementById("newValueInput").type = type;
  document.getElementById("newValueInput").value = activeClient[field] || "";
  document.getElementById("editValueModal").classList.remove("hidden");
  document.getElementById("newValueInput").focus();
}

function saveNewValue() {
  if (!activeClient || !currentEditField) return;
  const val = document.getElementById("newValueInput").value;

  if (currentEditField === "paid" || currentEditField === "totalContract") {
    activeClient[currentEditField] = parseFloat(val) || 0;
  } else {
    activeClient[currentEditField] = val;
  }

  saveDB();
  updateClientDOM();
  closeModals();
}

function editDoc(i) {
  const doc = activeClient.docs[i];
  const person = prompt("المستلم", doc.person);
  const name = prompt("اسم الورقة", doc.name);
  const purpose = prompt("الغرض", doc.purpose);
  const place = prompt("المكان", doc.place);
  if (person && name) {
    doc.person = person;
    doc.name = name;
    doc.purpose = purpose;
    doc.place = place;
    saveDB();
    updateClientDOM();
  }
}

/**
 * ==========================================
 * MODALS & UI HELPERS
 * ==========================================
 */
function closeModals() {
  document.getElementById("subModal").classList.add("hidden");
  document.getElementById("editValueModal").classList.add("hidden");
  document.getElementById("trashModal").classList.add("hidden");
  document.getElementById("newClientModal").classList.add("hidden");
  closeConfirmModal();
}

function showSubModal(type) {
  const div = document.getElementById("subModalContent");
  if (type === "exp") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">إضافة مصروف</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="البيان" />
        <input id="in2" type="number" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المبلغ" />
        <input id="inExpDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addExp()" class="w-full bg-red-500 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-red-600">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-red-500";
  } else if (type === "tip") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">إضافة إكرامية</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المصلحة" />
        <input id="in2" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="من سدد؟" />
        <input id="in3" type="number" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المبلغ" />
        <input id="inTipDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addTip()" class="w-full bg-orange-500 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-orange-600">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-orange-500";
  } else if (type === "doc") {
    div.innerHTML = `
      <h3 class="font-black text-2xl mb-6 dark:text-white text-center">حركة مستند</h3>
      <div class="space-y-4 mb-6">
        <input id="in1" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المستلم" />
        <input id="in2" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="اسم الورقة" />
        <input id="in3" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="الغرض" />
        <input id="in4" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" placeholder="المكان" />
        <input id="inDocDate" type="date" class="w-full px-4 py-2 rounded-xl border-2 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 dark:text-white" />
      </div>
      <button onclick="addDoc()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-lg shadow-lg hover:bg-blue-700">تسجيل وحفظ</button>
    `;
    document.getElementById("subModal").firstElementChild.className =
      "bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl w-96 text-right relative border-t-4 border-blue-500";
  }
  document.getElementById("subModal").classList.remove("hidden");
}

function closeSubModal() {
  document.getElementById("subModal").classList.add("hidden");
}

function openTrashModal() {
  const list = document.getElementById("trashList");
  list.innerHTML = trashDB.length
    ? trashDB
        .map(
          (c) => `
        <div class="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-4 rounded-xl border border-gray-100 dark:border-slate-600 mb-3">
            <span class="font-bold dark:text-white">${c.name} - ${c.plot}</span>
            <button onclick="restoreClient('${c.id}')" class="text-green-600 bg-green-50 px-4 py-2 rounded-lg font-bold hover:bg-green-500 hover:text-white transition">استعادة <i class="fas fa-rotate-left"></i></button>
        </div>`,
        )
        .join("")
    : "<p class='text-center text-gray-500 font-bold py-6'>السلة فارغة</p>";
  document.getElementById("trashModal").classList.remove("hidden");
}

function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  const icon = document.getElementById("themeIcon");
  if (document.documentElement.classList.contains("dark")) {
    icon.classList.replace("fa-moon", "fa-sun");
  } else {
    icon.classList.replace("fa-sun", "fa-moon");
  }
}

function toggleNewClientModal() {
  document.getElementById("newClientModal").classList.toggle("hidden");
}

/**
 * ==========================================
 * CUSTOM CONFIRM MODAL
 * ==========================================
 */
function showConfirmModal(title, message, onConfirm) {
  document.getElementById("confirmTitle").innerText = title;
  document.getElementById("confirmMessage").innerText = message;
  document.getElementById("confirmModal").classList.remove("hidden");

  // تصفية أي حدث قديم على الزر
  const oldBtn = document.getElementById("confirmBtn");
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.addEventListener("click", () => {
    onConfirm();
    closeConfirmModal();
  });
}

function closeConfirmModal() {
  document.getElementById("confirmModal").classList.add("hidden");
}
