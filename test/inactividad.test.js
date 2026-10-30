const test = require("node:test");
const assert = require("node:assert/strict");
const { crearMarca, sigueActiva } = require("../lib/inactividad");

const CLAVE = "clave-de-prueba-de-al-menos-32-caracteres";
const OTRA_CLAVE = "otra-clave-de-prueba-de-al-menos-32-caracteres";
const MINUTO = 60 * 1000;
const INICIO = 1_000_000_000_000;

test("RNF-09 · a las 12:59 sin uso la sesión permanece abierta", () => {
    const marca = crearMarca(INICIO, CLAVE);
    assert.equal(sigueActiva(marca, INICIO + 14 * MINUTO + 59 * 1000, CLAVE), true);
});

test("RNF-09 · a las 13:00 sin uso la sesión se cierra", () => {
    const marca = crearMarca(INICIO, CLAVE);
    assert.equal(sigueActiva(marca, INICIO + 15 * MINUTO, CLAVE), false);
});

test("RNF-09 modificar la hora no sirve para alargar la sesión", () => {
    const [, firma] = crearMarca(INICIO, CLAVE).split(".");
    const alargada = `${INICIO + 60 * MINUTO}.${firma}`;
    assert.equal(sigueActiva(alargada, INICIO + 30 * MINUTO, CLAVE), false);
});

test("RNF-09 una marca alterada o de otra clave no vale", () => {
    const marca = crearMarca(INICIO, CLAVE);
    const ultima = marca.at(-1);
    const alterada = marca.slice(0, -1) + (ultima === "A" ? "B" : "A");
    assert.equal(sigueActiva(alterada, INICIO, CLAVE), false);
    assert.equal(sigueActiva(crearMarca(INICIO, OTRA_CLAVE), INICIO, CLAVE), false);
});

test("RNF-09 · sin marca, o con algo que no es una marca, la sesión se cierra", () => {
    for (const marca of [undefined, "", "abc", String(INICIO), `${INICIO}.`, ["x"]]) {
        assert.equal(sigueActiva(marca, INICIO, CLAVE), false);
    }
});

test("RNF-09 · una marca con la hora alterada no vale", () => {
    const marca = crearMarca(INICIO + MINUTO, CLAVE);
    assert.equal(sigueActiva(marca, INICIO, CLAVE), false);
});