window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
        document.documentElement.hidden = true;
        location.reload();
    }
});