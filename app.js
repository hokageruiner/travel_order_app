const STORAGE_KEY = 'travel_order_app_v2';
const RENDER_SCALE = 2;

const monthNames = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const fields = [
  'orderNumber','documentDate','expertName','basisType','basisNumber','basisDate','expertiseObject',
  'address','departureDate','returnDate','departureTime','returnTime','otherTransport',
  'carModel','carPlate','odometerStart','odometerEnd','totalMileage','fuelRate','fuelActual','fuelBrand',
  'ticketRoute','tripCount','sumRub','sumKop','signExpert','signHead','signAccountant'
];

const fileInput = document.getElementById('receipts');
const fileList = document.getElementById('fileList');

function byId(id) { return document.getElementById(id); }

function getTransportValue() {
  return document.querySelector('input[name="transportType"]:checked')?.value || '';
}

function setTransportValue(value) {
  const radio = document.querySelector(`input[name="transportType"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function formatDateParts(value) {
  if (!value) return {day: '___', month: '_____', year: '20___'};
  const [year, month, day] = value.split('-');
  const monthName = monthNames[Number(month)] || '_____';
  return { day, month: monthName, year };
}

function readForm() {
  const data = Object.fromEntries(fields.map(id => [id, byId(id)?.value?.trim?.() ?? '']));
  data.transportType = getTransportValue();
  data.receiptNames = Array.from(fileInput.files).map(file => file.name);
  return data;
}

function saveDraft() {
  const data = readForm();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const id of fields) {
      if (data[id] !== undefined && byId(id)) byId(id).value = data[id];
    }
    if (data.transportType) setTransportValue(data.transportType);
    syncTransportBlocks();
    renderFileList(data.receiptNames || []);
  } catch (error) {
    console.warn('Не удалось восстановить черновик', error);
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'radio') {
      el.checked = false;
    } else if (el.type !== 'file') {
      el.value = '';
    }
  });
  fileInput.value = '';
  renderFileList([]);
  syncTransportBlocks();
}

function renderFileList(names) {
  fileList.innerHTML = '';
  if (!names.length) {
    const li = document.createElement('li');
    li.textContent = 'Файлы не выбраны';
    fileList.appendChild(li);
    return;
  }
  names.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    fileList.appendChild(li);
  });
}

function syncTransportBlocks() {
  const transport = getTransportValue();
  byId('carCard').style.display = transport === 'car' ? '' : 'none';
  byId('publicCard').style.display = (transport === 'public' || transport === 'taxi') ? '' : 'none';
}

function bindPreview(data) {
  const docDate = formatDateParts(data.documentDate);
  const basisDate = formatDateParts(data.basisDate);
  const departureDate = formatDateParts(data.departureDate);
  const returnDate = formatDateParts(data.returnDate);

  const receiptLines = data.receiptNames.length
    ? data.receiptNames.map((name, index) => `${index + 1}. ${name}`).join('\n')
    : '—';

  const mapping = {
    ...data,
    documentDateDay: docDate.day,
    documentDateMonth: docDate.month,
    documentDateYear: docDate.year,
    basisDateDay: basisDate.day,
    basisDateMonth: basisDate.month,
    basisDateYear: basisDate.year,
    departureDateDay: departureDate.day,
    departureDateMonth: departureDate.month,
    departureDateYear: departureDate.year,
    returnDateDay: returnDate.day,
    returnDateMonth: returnDate.month,
    returnDateYear: returnDate.year,
    markCar: data.transportType === 'car' ? '✓' : ' ',
    markPublic: data.transportType === 'public' ? '✓' : ' ',
    markTaxi: data.transportType === 'taxi' ? '✓' : ' ',
    markOther: data.transportType === 'other' ? '✓' : ' ',
    receiptList: receiptLines,
    sumRub: data.sumRub || '0',
    sumKop: (data.sumKop || '0').toString().padStart(2, '0'),
    signExpert: data.signExpert || '_________',
    signHead: data.signHead || '_________',
    signAccountant: data.signAccountant || '_________',
  };

  document.querySelectorAll('[data-bind]').forEach(node => {
    const key = node.getAttribute('data-bind');
    node.textContent = mapping[key] || '_________';
  });
}

async function renderDocPages(pdf) {
  const pageNodes = [byId('docPage1'), byId('docPage2')];
  for (let i = 0; i < pageNodes.length; i += 1) {
    const canvas = await html2canvas(pageNodes[i], {
      scale: RENDER_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (i > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, 0, pageWidth, pageHeight);
  }
}

function fitSize(srcWidth, srcHeight, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return { width: srcWidth * ratio, height: srcHeight * ratio };
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function appendImageReceipt(pdf, file) {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  pdf.addPage();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const box = fitSize(img.width, img.height, pageWidth - 20, pageHeight - 20);
  const x = (pageWidth - box.width) / 2;
  const y = (pageHeight - box.height) / 2;
  const format = file.type.includes('png') ? 'PNG' : 'JPEG';
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`Приложение: ${file.name}`, 10, 10);
  pdf.addImage(dataUrl, format, x, Math.max(16, y), box.width, box.height);
}

async function appendPdfReceipt(pdf, file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = globalThis.pdfjsLib;
  if (!pdfjsLib) {
    pdf.addPage();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`Приложение PDF: ${file.name}`, 10, 20);
    pdf.text('Не удалось отрендерить PDF в браузере.', 10, 30);
    return;
  }
  const source = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  for (let pageIndex = 1; pageIndex <= source.numPages; pageIndex += 1) {
    const page = await source.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const img = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addPage();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const box = fitSize(canvas.width, canvas.height, pageWidth - 20, pageHeight - 20);
    const x = (pageWidth - box.width) / 2;
    const y = (pageHeight - box.height) / 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`Приложение PDF: ${file.name} (стр. ${pageIndex})`, 10, 10);
    pdf.addImage(img, 'JPEG', x, Math.max(16, y), box.width, box.height);
  }
}

async function appendUnsupportedReceiptList(pdf, files) {
  if (!files.length) return;
  pdf.addPage();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(14);
  pdf.text('Приложения в офисных форматах', 10, 20);
  pdf.setFontSize(11);
  let y = 34;
  files.forEach((file, index) => {
    const line = `${index + 1}. ${file.name}`;
    pdf.text(line, 10, y);
    y += 8;
    if (y > 280 && index < files.length - 1) {
      pdf.addPage();
      y = 20;
    }
  });
  pdf.text('В браузерной версии содержимое DOC/DOCX/XLS/XLSX не встраивается как изображение.', 10, Math.min(y + 10, 286));
}

async function buildPdf() {
  const { jsPDF } = window.jspdf;
  const data = readForm();
  bindPreview(data);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  await renderDocPages(pdf);

  const files = Array.from(fileInput.files);
  const images = files.filter(file => file.type.startsWith('image/'));
  const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  const officeFiles = files.filter(file => !file.type.startsWith('image/') && !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')));

  for (const file of images) {
    await appendImageReceipt(pdf, file);
  }
  for (const file of pdfFiles) {
    await appendPdfReceipt(pdf, file);
  }
  await appendUnsupportedReceiptList(pdf, officeFiles);

  return { pdf, data };
}

async function downloadPdf() {
  const button = byId('downloadPdfBtn');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Собираю PDF...';
  try {
    const { pdf, data } = await buildPdf();
    const filename = `travel_order_${data.orderNumber || 'без_номера'}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error(error);
    alert('Не удалось собрать PDF. Откройте консоль браузера и пришлите ошибку.');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function attachEvents() {
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'file') return;
    el.addEventListener('input', saveDraft);
    el.addEventListener('change', saveDraft);
  });
  document.querySelectorAll('input[name="transportType"]').forEach(el => {
    el.addEventListener('change', () => {
      syncTransportBlocks();
      saveDraft();
    });
  });
  fileInput.addEventListener('change', () => {
    renderFileList(Array.from(fileInput.files).map(file => file.name));
  });
  byId('restoreDraftBtn').addEventListener('click', loadDraft);
  byId('clearDraftBtn').addEventListener('click', clearDraft);
  byId('downloadPdfBtn').addEventListener('click', downloadPdf);
}

async function initPdfJs() {
  try {
    const module = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
    globalThis.pdfjsLib = module;
    module.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';
  } catch (error) {
    console.warn('pdf.js не загрузился', error);
  }
}

function presetToday() {
  const today = new Date().toISOString().slice(0, 10);
  ['documentDate', 'basisDate', 'departureDate', 'returnDate'].forEach(id => {
    if (!byId(id).value) byId(id).value = today;
  });
  if (!getTransportValue()) setTransportValue('public');
  syncTransportBlocks();
}

window.addEventListener('DOMContentLoaded', async () => {
  attachEvents();
  presetToday();
  loadDraft();
  syncTransportBlocks();
  renderFileList([]);
  await initPdfJs();
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
});
