const test = require("node:test");
const assert = require("node:assert/strict");
const { crearToken, leerToken, tokenValido } = require("../lib/csrf");

const CLAVE = "clave-de-prueba-de-al-menos-32-caracteres";
const OTRA_CLAVE = "otra-clave-de-prueba-de-al-menos-32-caracteres";

test("base · CL-06 · el token recién creado vale con su cookie", () => {
    const { valor, cookie } = crearToken(CLAVE);
    assert.equal(leerToken(cookie, CLAVE), valor);
    assert.equal(tokenValido(valor, cookie, CLAVE), true);
});

test("base · CL-06 · sin token en el formulario, o con otro token, se rechaza", () => {
    const { valor, cookie } = crearToken(CLAVE);
    assert.equal(tokenValido(undefined, cookie, CLAVE), false);
    assert.equal(tokenValido("", cookie, CLAVE), false);
    assert.equal(tokenValido(valor + "x", cookie, CLAVE), false);
    assert.equal(tokenValido([valor + valor], cookie, CLAVE), false)
})

test("base · CL-06 · sin cookie, o con una cookie alterada, se rechaza", () => {
    const { valor, cookie } = crearToken(CLAVE);
    assert.equal(tokenValido(valor, undefined, CLAVE), false);
    assert.equal(tokenValido(valor, `${valor}.firma-inventada`, CLAVE), false);
    assert.equal(tokenValido(valor, valor, CLAVE), false);
    const ultima = cookie.at(-1);
    const alterada = cookie.slice(0, -1) + (ultima === "A" ? "B" : "A");
    assert.equal(leerToken(alterada, CLAVE), null);
});

test("base · CL-06 · una cookie firmada con otra clave no funciona", () => {
    const { valor, cookie } = crearToken(OTRA_CLAVE);
    assert.equal(tokenValido(valor, cookie, CLAVE), false);
});

test("base · CL-06 · cada token es diferente", () => {
    assert.notEqual(crearToken(CLAVE).valor, crearToken(CLAVE).valor);
});