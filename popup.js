// Escuta mensagens do Iframe (App React)
window.addEventListener('message', async (event) => {
    // Segurança: Garantir que a mensagem vem do iframe esperado (ou self neste caso simples)
    if (!event.data || !event.data.type) return;

    // Repassa o pedido para o background.js do Chrome
    try {
        chrome.runtime.sendMessage(event.data, (response) => {
            // Devolve a resposta para o Iframe
            // Adicionamos o ID da mensagem original para o React saber qual promessa resolver
            const iframe = document.getElementById('app-frame');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    requestId: event.data.requestId,
                    success: response ? response.success : false,
                    data: response ? response.data : null,
                    error: response ? response.error : 'Sem resposta do background'
                }, '*');
            }
        });
    } catch (e) {
        console.error("Erro na ponte popup:", e);
    }
});