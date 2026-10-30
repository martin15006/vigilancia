const crypto = require("node:crypto");
const { firmar, iguales } = require("./firma");



function crearToken(clave) {
    const valor = crypto.randomBytes(32).toString("base64url");
    return { valor, cookie: `${valor}.${firmar("csrf", valor, clave)}` };
}

function leerToken(cookie, clave) {
    if (typeof cookie !== "string") return null;
    const [valor, firma] = cookie.split(".");
    if (!valor || !firma) return null;
    return iguales(firma, firmar("csrf", valor, clave)) ? valor : null;
}

function tokenValido(enviado, cookie, clave) {
    const valor = leerToken(cookie, clave);
    return valor !== null && iguales(enviado, valor);
}

module.exports = { crearToken, leerToken, tokenValido };