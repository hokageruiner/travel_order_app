
const STORAGE_KEY = "order_v6";

function saveDraft(){
    const data = {};
    document.querySelectorAll("input, select").forEach(el=>{
        if(el.type !== "file"){
            data[el.id] = el.value;
        }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadDraft(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const data = JSON.parse(raw);

    Object.keys(data).forEach(k=>{
        const el = document.getElementById(k);
        if(el) el.value = data[k];
    });
}

document.addEventListener("input", saveDraft);
window.onload = loadDraft;

function updateTransport(){
    const val = document.querySelector('input[name="transport"]:checked')?.value;
    document.getElementById("car_block").style.display = val==="car"?"block":"none";
}

document.querySelectorAll('input[name="transport"]').forEach(el=>{
    el.addEventListener("change", updateTransport);
});

async function fileToBase64(file){
    return new Promise((res)=>{
        const reader = new FileReader();
        reader.onload = ()=>res(reader.result);
        reader.readAsDataURL(file);
    });
}

async function sendOrder(){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.text("НАРЯД", 20,20);
    pdf.text("ФИО: "+document.getElementById("fio").value,20,40);

    const files = document.getElementById("receipts").files;

    for(let f of files){
        if(f.type.startsWith("image/")){
            const img = await fileToBase64(f);
            pdf.addPage();
            pdf.addImage(img, "JPEG", 10,10,180,250);
        }
    }

    const blob = pdf.output("blob");

    const reader = new FileReader();
    reader.onload = function(){
        Telegram.WebApp.sendData(JSON.stringify({
            type:"order",
            pdf: reader.result.split(",")[1]
        }));
    };
    reader.readAsDataURL(blob);
}
