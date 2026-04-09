
const STORAGE_KEY = "bneo_order_draft_v1";

function qs(id) { return document.getElementById(id); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(message) {  const el = qs("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function collectData() {  const transport = document.querySelector('input[name="transportType"]:checked')?.value || "";
  return {    orderNumber: qs("orderNumber").value.trim(),
    compiledDate: qs("compiledDate").value,
    expertFio: qs("expertFio").value.trim(),
    basisType: qs("basisType").value,
    basisNumber: qs("basisNumber").value.trim(),
    basisDate: qs("basisDate").value,
    objectDescription: qs("objectDescription").value.trim(),
    address: qs("address").value.trim(),
    departureDate: qs("departureDate").value,
    departureTime: qs("departureTime").value,
    returnDate: qs("returnDate").value,
    returnTime: qs("returnTime").value,
    transportType: transport,
    transportOther: qs("transportOther").value.trim(),
    carModel: qs("carModel").value.trim(),
    carPlate: qs("carPlate").value.trim(),
    odoOut: qs("odoOut").value.trim(),
    odoIn: qs("odoIn").value.trim(),
    totalMileage: qs("totalMileage").value.trim(),
    fuelRate: qs("fuelRate").value.trim(),
    fuelActual: qs("fuelActual").value.trim(),
    fuelBrand: qs("fuelBrand").value.trim(),
    ticketRoute: qs("ticketRoute").value.trim(),
    tripCount: qs("tripCount").value.trim(),
    totalAmount: qs("totalAmount").value.trim(),
    totalNote: qs("totalNote").value.trim(),
    expertSigner: qs("expertSigner").value.trim(),
    managerSigner: qs("managerSigner").value.trim(),
    accountantSigner: qs("accountantSigner").value.trim(),
  };
}

function saveDraft(showNotice = true) {  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectData()));
  if (showNotice) toast("Черновик сохранён");
}

function loadDraft() {  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {    const data = JSON.parse(raw);
    for (const [key, value] of Object.entries(data)) {      if (key === "transportType") continue;
      const el = qs(key);
      if (el && typeof value === "string") el.value = value;
    }
    if (data.transportType) {      const radio = document.querySelector(`input[name="transportType"][value="${data.transportType}"]`);
      if (radio) radio.checked = true;
    }
    updateTransportUI();
    updateMileage();
  } catch (e) {    console.warn("Draft restore failed", e);
  }
}

function clearDraft() {  localStorage.removeItem(STORAGE_KEY);
  qs("orderForm").reset();
  qsa('.transport-option').forEach(el => el.classList.remove('active'));
  updateTransportUI();
  renderReceiptList();
  toast("Форма очищена");
}

function formatDateNumeric(value) {  if (!value) return "___";
  const [y,m,d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}.${m}.${y}`;
}

function formatDateQuoted(value) {  if (!value) return "«___» _____ 20___ г.";
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const [y,m,d] = value.split("-").map(v => parseInt(v, 10));
  if (!y || !m || !d) return value;
  return `«${String(d).padStart(2,"0")}» ${months[m-1]} ${y} г.`;
}

function valueOrLine(value, fallback = "___________________________") {  return value && String(value).trim() ? String(value).trim() : fallback;
}

function updateTransportUI() {  const selected = document.querySelector('input[name="transportType"]:checked')?.value || "";
  qs("carBlock").classList.toggle("hidden", selected !== "car");
  qs("publicBlock").classList.toggle("hidden", !(selected === "public" || selected === "taxi"));
  qs("otherTransportWrap").classList.toggle("hidden", selected !== "other");

  qsa('.transport-option').forEach(label => {    const input = label.querySelector('input');
    label.classList.toggle('active', input && input.checked);
  });
}

function updateMileage() {  const out = parseFloat(qs("odoOut").value);
  const inn = parseFloat(qs("odoIn").value);
  const totalEl = qs("totalMileage");
  if (!Number.isNaN(out) && !Number.isNaN(inn) && inn >= out) {    totalEl.value = (Math.round((inn - out) * 100) / 100).toString();
  }
}

function renderReceiptList() {  const list = qs("receiptList");
  const files = Array.from(qs("receipts").files || []);
  if (!files.length) {    list.innerHTML = "";
    return;
  }
  list.innerHTML = files.map(file => `<li>${escapeHtml(file.name)} · ${Math.max(1, Math.round(file.size / 1024))} КБ</li>`).join("");
}

function escapeHtml(text) {  return String(text).replace(/[&<>"']/g, s => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[s]));
}

async function fileToDataUrl(file) {  return await new Promise((resolve, reject) => {    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toRubKop(value) {  const num = parseFloat(value || "0");
  if (Number.isNaN(num)) return { rub: "0", kop: "00" };
  const rub = Math.floor(num);
  let kop = Math.round((num - rub) * 100);
  if (kop === 100) {    return { rub: String(rub + 1), kop: "00" };
  }
  return { rub: String(rub), kop: String(kop).padStart(2, "0") };
}

async function buildPdf() {  const data = collectData();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({    title: data.orderNumber ? `Наряд ${data.orderNumber}` : "Наряд на выезд эксперта",
    subject: "Наряд-задание на выезд эксперта",
    author: "BNEO SPOT",
  });

  let y = 18;
  const left = 18;
  const contentWidth = 174;

  function ensureSpace(height = 8) {    if (y + height > 280) {      pdf.addPage();
      y = 18;
    }
  }

  function setFont(style = "normal", size = 12) {    pdf.setFont("times", style);
    pdf.setFontSize(size);
  }

  function writeLine(text, opts = {}) {    const { style = "normal", size = 12, gap = 6, indent = 0, align = "left" } = opts;
    setFont(style, size);
    const maxWidth = contentWidth - indent;
    const lines = pdf.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length * gap + 2);
    pdf.text(lines, left + indent, y, { align, maxWidth });
    y += lines.length * gap;
  }

  function blockLabelValue(label, value, fallback = "___________________________", extraGap = 2) {    writeLine(`${label} ${valueOrLine(value, fallback)}`);
    y += extraGap;
  }

  const checked = v => data.transportType === v ? "☑" : "☐";

  setFont("bold", 14);
  pdf.text(`НАРЯД-ЗАДАНИЕ НА ВЫЕЗД ЭКСПЕРТА № ${data.orderNumber || "___________"}`, 105, y, { align: "center" });
  y += 10;

  writeLine(`Дата составления: ${formatDateQuoted(data.compiledDate)}`, { gap: 6 });
  y += 4;

  writeLine("1. Информация об эксперте", { style: "bold" });
  blockLabelValue("ФИО эксперта:", data.expertFio);
  y += 3;

  writeLine("2. Основание для выезда", { style: "bold" });
  const basisLine = `${data.basisType || "Договор"} № ${data.basisNumber || "____"} от ${data.basisDate ? formatDateNumeric(data.basisDate) : "«__» _____ 20___ г."}`;
  writeLine(basisLine);
  writeLine("Объект экспертизы (краткое описание):", { gap: 6 });
  writeLine(valueOrLine(data.objectDescription, "_________________________________________"), { indent: 4, gap: 6 });
  y += 3;

  writeLine("3. Место и сроки выезда", { style: "bold" });
  writeLine("Адрес объекта (место проведения осмотра):");
  writeLine(valueOrLine(data.address, "_________________________________________"), { indent: 4, gap: 6 });
  blockLabelValue("Дата выезда:", data.departureDate ? formatDateNumeric(data.departureDate) : "");
  blockLabelValue("Дата возвращения:", data.returnDate ? formatDateNumeric(data.returnDate) : "");
  blockLabelValue("Время выезда:", data.departureTime || "___:___", "___:___");
  blockLabelValue("Время возвращения:", data.returnTime || "___:___", "___:___");
  y += 3;

  writeLine("4. Вид транспорта и расчёт расходов", { style: "bold" });
  writeLine("(нужное отметить ✓, заполнить соответствующие поля)", { size: 11 });
  writeLine(`${checked("car")} Личный автомобиль    ${checked("public")} Общественный транспорт (поезд, автобус, метро)`, { gap: 6 });
  writeLine(`${checked("taxi")} Такси    ${checked("other")} Иное: ${data.transportType === "other" ? valueOrLine(data.transportOther) : "________________"}`, { gap: 6 });
  y += 3;

  writeLine("4.1. При использовании личного автомобиля:", { style: "bold" });
  blockLabelValue("Марка, модель:", data.carModel);
  blockLabelValue("Гос. номер:", data.carPlate);
  blockLabelValue("Показания одометра при выезде:", data.odoOut ? `${data.odoOut} км` : "");
  blockLabelValue("Показания одометра при возвращении:", data.odoIn ? `${data.odoIn} км` : "");
  blockLabelValue("Общий пробег:", data.totalMileage ? `${data.totalMileage} км` : "");
  blockLabelValue("Норма расхода топлива (л/100 км):", data.fuelRate);
  blockLabelValue("Фактический расход топлива согласно чекам:", data.fuelActual ? `${data.fuelActual} л` : "");
  blockLabelValue("Марка топлива:", data.fuelBrand);
  y += 2;

  writeLine("4.2. При использовании общественного транспорта / такси:", { style: "bold" });
  blockLabelValue("Вид билета / маршрут:", data.ticketRoute);
  blockLabelValue("Количество поездок:", data.tripCount);
  y += 3;

  writeLine("5. Прилагаемые подтверждающие документы", { style: "bold" });
  const files = Array.from(qs("receipts").files || []);
  if (files.length) {    writeLine("Эксперт приложил следующие документы:", { gap: 6 });
    files.forEach((file, index) => writeLine(`${index + 1}. ${file.name}`, { indent: 4, gap: 5.5 }));
  } else {    writeLine("Эксперт обязан приложить к наряду оригиналы или копии документов, подтверждающих расходы.", { gap: 6 });
  }
  y += 3;

  writeLine("6. Итоговая сумма к возмещению", { style: "bold" });
  const money = toRubKop(data.totalAmount);
  writeLine(`${money.rub} рублей ${money.kop} копеек${data.totalNote ? " — " + data.totalNote : ""}`, { gap: 6 });
  y += 6;

  const expertSigner = data.expertSigner || data.expertFio || "_________";
  const managerSigner = data.managerSigner || "_________";
  const accountantSigner = data.accountantSigner || "_________";
  writeLine(`Эксперт / ${expertSigner} / ${data.compiledDate ? formatDateQuoted(data.compiledDate) : "«___» ____ 20___ г."}`, { gap: 6 });
  writeLine("(ознакомлен, данные подтверждаю)", { size: 10, indent: 10, gap: 5 });
  y += 2;
  writeLine(`Руководитель / ${managerSigner} / ${data.compiledDate ? formatDateQuoted(data.compiledDate) : "«___» ____ 20___ г."}`, { gap: 6 });
  writeLine("(утверждаю выезд)", { size: 10, indent: 10, gap: 5 });
  y += 2;
  writeLine(`Бухгалтер / ${accountantSigner} / ${data.compiledDate ? formatDateQuoted(data.compiledDate) : "«___» ____ 20___ г."}`, { gap: 6 });
  writeLine("(проверил расчёт)", { size: 10, indent: 10, gap: 5 });

  const nonImageFiles = [];
  for (const file of files) {    if (file.type.startsWith("image/")) {      const url = await fileToDataUrl(file);
      pdf.addPage();
      pdf.setFont("times", "bold");
      pdf.setFontSize(12);
      pdf.text(`Приложение: ${file.name}`, 18, 16);
      const props = pdf.getImageProperties(url);
      const pageW = 174;
      const pageH = 255;
      let w = pageW;
      let h = props.height * (w / props.width);
      if (h > pageH) {        h = pageH;
        w = props.width * (h / props.height);
      }
      const x = 18 + (pageW - w) / 2;
      const yImg = 22 + (pageH - h) / 2;
      const fmt = (file.type.includes("png") ? "PNG" : "JPEG");
      pdf.addImage(url, fmt, x, yImg, w, h, undefined, "FAST");
    } else {      nonImageFiles.push(file);
    }
  }

  if (nonImageFiles.length) {    pdf.addPage();
    y = 18;
    setFont("bold", 13);
    pdf.text("Приложение: файлы, не встроенные в PDF", 18, y);
    y += 10;
    setFont("normal", 12);
    const note = "Следующие файлы были выбраны в форме, но не могут быть встроены как изображения. Их наименования перечислены ниже:";
    const lines = pdf.splitTextToSize(note, 174);
    pdf.text(lines, 18, y);
    y += lines.length * 6 + 2;
    nonImageFiles.forEach((file, idx) => {      const desc = `${idx + 1}. ${file.name}`;
      const wrapped = pdf.splitTextToSize(desc, 174);
      if (y + wrapped.length * 6 > 280) { pdf.addPage(); y = 18; }
      pdf.text(wrapped, 18, y);
      y += wrapped.length * 6 + 2;
    });
  }

  return pdf;
}

async function downloadPdf() {  try {    if (!window.jspdf || !window.jspdf.jsPDF) {      throw new Error("jsPDF не загрузился");
    }
    const pdf = await buildPdf();
    const data = collectData();
    const filename = `travel_order_${(data.orderNumber || "draft").replace(/[^\w\-а-яА-Я]+/g, "_")}.pdf`;
    pdf.save(filename);
    saveDraft(false);
    toast("PDF сформирован");
  } catch (err) {    console.error(err);
    toast("Не удалось сформировать PDF");
  }
}

function bindEvents() {  qsa('input[name="transportType"]').forEach(input => {    input.addEventListener('change', () => {      updateTransportUI();
      persistSilently();
    });
  });

  qsa('input, textarea, select').forEach(el => {    if (el.type !== 'file') {      el.addEventListener('input', persistSilently);
      el.addEventListener('change', persistSilently);
    }
  });

  qs("odoOut").addEventListener("input", updateMileage);
  qs("odoIn").addEventListener("input", updateMileage);
  qs("receipts").addEventListener("change", renderReceiptList);

  ["saveDraftBtn", "saveDraftBtnBottom"].forEach(id => qs(id).addEventListener("click", () => saveDraft(true)));
  ["clearBtn", "clearBtnBottom"].forEach(id => qs(id).addEventListener("click", clearDraft));
  ["downloadBtn", "downloadBtnBottom"].forEach(id => qs(id).addEventListener("click", downloadPdf));
}

let persistTimer = null;
function persistSilently() {  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => saveDraft(false), 120);
}

function initTelegram() {  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  try {    tg.ready();
    tg.expand();
  } catch (e) {    console.warn("Telegram init failed", e);
  }
}

window.addEventListener("DOMContentLoaded", () => {  initTelegram();
  bindEvents();
  loadDraft();
  renderReceiptList();
  updateTransportUI();
});
