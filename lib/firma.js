const crypto = require("node:crypto");

function firmar(proposito, texto, clave) {
    return crypto.createHmac("sha256", clave).update(`${proposito}:${texto}`).digest("base64url");
}

// comparar 2 textos sin dar pistas en el tiempo que tarda 
function iguales(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { firmar, iguales };