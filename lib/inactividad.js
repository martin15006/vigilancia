const { firmar, iguales } = require("./firma");

const LIMITE = 15 * 60 * 1000;

function crearMarca(ahora, clave) {
    return `${ahora}.${firmar("actividad", ahora, clave)}`;
}

function sigueActiva(marca, ahora, clave) {
    if (typeof marca !== "string") return false;
    const [texto, firma] = marca.split(".");
    const momento = Number(texto);
    if (!Number.isSafeInteger(momento) || momento > ahora) return false;
    if (!iguales(firma, firmar("actividad", texto, clave))) return false;
    return ahora - momento < LIMITE;
}

module.exports = { crearMarca, sigueActiva };