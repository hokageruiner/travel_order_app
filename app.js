const form = document.getElementById('orderForm');
const receiptInput = document.getElementById('receipts');
const receiptPreview = document.getElementById('receiptPreview');
const pdfRoot = document.getElementById('pdfRoot');
const STORAGE_KEY = 'bneo_travel_order_draft_v2';

function value(name){ return (form.elements[name]?.value || '').trim(); }
function selectedTransport(){ return form.querySelector('input[name="transport_type"]:checked')?.value || ''; }
function checkbox(selected, current){ return selected === current ? '☑' : '☐'; }
function formatDate(value){ if(!value) return '___'; const [y,m,d] = value.split('-'); return `${d}.${m}.${y}`; }
function formatTime(value){ return value || '__:__'; }
function lineBreaks(text){ return (text || '________________________').replace(/\n/g, '<br>'); }
function escapeHtml(value){ return String(value || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }); }

function saveDraft(){
  const data = {};
  [...form.elements].forEach(el => {
    if (!el.name || el.type === 'file') return;
    if (el.type === 'radio') {
      if (el.checked) data[el.name] = el.value;
      return;
    }
    data[el.name] = el.value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreDraft(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([name,val]) => {
      const el = form.elements[name];
      if (!el) return;
      if (el instanceof RadioNodeList) {
        [...el].forEach(r => { r.checked = r.value === val; });
      } else {
        el.value = val;
      }
    });
    updateTransportSections();
  } catch (_) {}
}

function clearForm(){
  form.reset();
  receiptInput.value = '';
  receiptPreview.innerHTML = '';
  localStorage.removeItem(STORAGE_KEY);
  if (form.elements['transport_type']?.length) {
    [...form.elements['transport_type']].forEach(r => r.checked = r.value === 'Личный автомобиль');
  }
  updateTransportSections();
}

function updateTransportSections(){
  const transport = selectedTransport();
  document.getElementById('carFields').classList.toggle('hidden', transport !== 'Личный автомобиль');
  document.getElementById('publicFields').classList.toggle('hidden', !(transport === 'Общественный транспорт' || transport === 'Такси' || transport === 'Иное'));
  document.getElementById('otherTransportWrap').classList.toggle('hidden', transport !== 'Иное');
}

async function renderReceiptPreview(){
  const files = [...receiptInput.files];
  receiptPreview.innerHTML = '';
  for (const file of files){
    const dataUrl = await fileToDataUrl(file);
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.innerHTML = `<img src="${dataUrl}" alt="${escapeHtml(file.name)}"><p>${escapeHtml(file.name)}</p>`;
    receiptPreview.appendChild(card);
  }
}

function sumText(){
  const rub = value('total_rubles') || '_____';
  const kop = (value('total_kopecks') || '').padStart(2,'0') || '__';
  return `${rub} рублей ${kop} копеек`;
}

async function buildPdfMarkup(){
  const transport = selectedTransport();
  const otherTransport = value('transport_other');
  const receiptFiles = [...receiptInput.files];
  const receiptUrls = [];
  for (const file of receiptFiles) receiptUrls.push({ name: file.name, dataUrl: await fileToDataUrl(file) });

  const pages = [];
  pages.push(`
    <section class="pdf-page">
      <div class="pdf-title">НАРЯД-ЗАДАНИЕ НА ВЫЕЗД ЭКСПЕРТА № ${escapeHtml(value('order_number') || '______')}</div>
      <div class="pdf-block"><span class="pdf-label">Дата составления:</span> «${formatDate(value('created_date'))}»</div>

      <div class="pdf-block"><span class="pdf-label">1. Информация об эксперте</span><br>
        ФИО эксперта: ${escapeHtml(value('expert_name') || '_________________________')}
      </div>

      <div class="pdf-block"><span class="pdf-label">2. Основание для выезда</span><br>
        ${escapeHtml(value('basis_type') || 'Договор')} № ${escapeHtml(value('basis_number') || '____')} от «${formatDate(value('basis_date'))}»<br>
        Объект экспертизы (краткое описание):<br>${lineBreaks(escapeHtml(value('object_desc')))}
      </div>

      <div class="pdf-block"><span class="pdf-label">3. Место и сроки выезда</span><br>
        Адрес объекта (место проведения осмотра):<br>${lineBreaks(escapeHtml(value('address')))}<br><br>
        Дата выезда: «${formatDate(value('departure_date'))}»<br>
        Дата возвращения: «${formatDate(value('return_date'))}»<br>
        Время выезда: ${escapeHtml(formatTime(value('departure_time')))}<br>
        Время возвращения: ${escapeHtml(formatTime(value('return_time')))}
      </div>

      <div class="pdf-block"><span class="pdf-label">4. Вид транспорта и расчёт расходов</span><br>
        (нужное отметить ✓, заполнить соответствующие поля)
        <div class="pdf-checks">${checkbox(transport,'Личный автомобиль')} Личный автомобиль    ${checkbox(transport,'Общественный транспорт')} Общественный транспорт (поезд, автобус, метро)    ${checkbox(transport,'Такси')} Такси    ${checkbox(transport,'Иное')} Иное: ${escapeHtml(otherTransport || '________________')}</div>
      </div>

      <div class="pdf-block"><span class="pdf-label">4.1. При использовании личного автомобиля:</span><br>
        Марка, модель: ${escapeHtml(value('car_model') || '_____________________')}<br>
        Гос. номер: ${escapeHtml(value('car_plate') || '_____________________')}<br>
        Показания одометра при выезде: ${escapeHtml(value('odo_start') || '_____')} км<br>
        Показания одометра при возвращении: ${escapeHtml(value('odo_end') || '_____')} км<br>
        Общий пробег: ${escapeHtml(value('distance_total') || '_____')} км<br>
        Норма расхода топлива (л/100 км): ${escapeHtml(value('fuel_norm') || '_____')}<br>
        Фактический расход топлива согласно чекам: ${escapeHtml(value('fuel_actual') || '_____')} л<br>
        Марка топлива: ${escapeHtml(value('fuel_brand') || '________')}
      </div>

      <div class="pdf-block"><span class="pdf-label">4.2. При использовании общественного транспорта / такси:</span><br>
        Вид билета / маршрут: ${escapeHtml(value('route_ticket') || '________________')}<br>
        Количество поездок: ${escapeHtml(value('trips_count') || '________________')}
      </div>

      <div class="pdf-block"><span class="pdf-label">5. Прилагаемые подтверждающие документы</span><br>
        Эксперт обязан приложить к наряду оригиналы или копии документов, подтверждающих расходы.<br>
        ${receiptUrls.length ? receiptUrls.map((item, index) => `${index+1}. ${escapeHtml(item.name)}`).join('<br>') : 'Фото чеков не приложены.'}
      </div>

      <div class="pdf-block"><span class="pdf-label">6. Итоговая сумма к возмещению</span><br>
        ${escapeHtml(sumText())}
      </div>

      <div class="pdf-sign-row">
        <div class="pdf-sign-box">Эксперт / __________ / «___» ____ 20___ г.<br><span class="muted">(ознакомлен, данные подтверждаю)</span></div>
        <div class="pdf-sign-box">Руководитель / __________ / «___» ____ 20___ г.<br><span class="muted">(утверждаю выезд)</span></div>
        <div class="pdf-sign-box">Бухгалтер / __________ / «___» ____ 20___ г.<br><span class="muted">(проверил расчёт)</span></div>
      </div>
    </section>
  `);

  receiptUrls.forEach((item, index) => {
    pages.push(`
      <section class="pdf-page receipt-page">
        <div class="pdf-title">Приложение ${index + 1}: ${escapeHtml(item.name)}</div>
        <img src="${item.dataUrl}" alt="${escapeHtml(item.name)}">
      </section>
    `);
  });

  pdfRoot.innerHTML = pages.join('');
}

async function downloadPdf(){
  saveDraft();
  await buildPdfMarkup();
  const filename = `travel_order_${(value('order_number') || 'draft').replace(/[^\w\-а-яА-Я]+/g, '_')}.pdf`;
  const options = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };
  await html2pdf().set(options).from(pdfRoot).save();
}

form.addEventListener('input', saveDraft);
form.addEventListener('change', (event) => {
  if (event.target.name === 'transport_type') updateTransportSections();
  saveDraft();
});
receiptInput.addEventListener('change', renderReceiptPreview);
document.getElementById('downloadPdf').addEventListener('click', () => downloadPdf().catch(err => alert(`Не удалось собрать PDF: ${err.message}`)));
document.getElementById('restoreDraft').addEventListener('click', restoreDraft);
document.getElementById('clearForm').addEventListener('click', clearForm);

restoreDraft();
updateTransportSections();
