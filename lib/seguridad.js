const LIVERELOAD = "localhost:35729";

function cabecerasSeguras({ desarrollo = false } = {}) {
    const scripts = desarrollo ? `'self' http://${LIVERELOAD}` : "'self'";
    const conexiones = desarrollo ? `'self' ws://${LIVERELOAD}` : "'self'";

    const csp = [
        "default-src 'self'",
        `script-src ${scripts}`,
        "style-src 'self'",
        `connect-src ${conexiones}`,
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join("; ");

    return {
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    };
}

module.exports = { cabecerasSeguras };