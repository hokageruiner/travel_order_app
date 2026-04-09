
function sendOrder(base64pdf){
    Telegram.WebApp.sendData(JSON.stringify({
        type: "order",
        pdf: base64pdf
    }));
}
