const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRegistro, estaFrenado, anotarFallo, anotarExito } = require("../lib/intentos");

const MINUTO = 60 * 1000;
const EQUIPO = "10.0.0.5";
const CORREO = "valen@prueba.test";

function fallar(registro, veces, ahora) {
    for (let i = 0; i < veces; i++) anotarFallo(registro, EQUIPO, CORREO, ahora);
}

test("CB-20 · con 4 fallos seguidos el correo todavía puede intentar", () => {
    const registro = crearRegistro();
    fallar(registro, 4, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), false);
});

test("CB-20 · con 5 fallos seguidos el correo queda frenado, solo en ese equipo", () => {
    const registro = crearRegistro();
    fallar(registro, 5, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), true);
    assert.equal(estaFrenado(registro, "10.0.0.9", CORREO, 0), false);
});

test("CB-20 · el freno dura 15 minutos: a los 14:59 sigue, a los 15:00 se suelta", () => {
    const registro = crearRegistro();
    fallar(registro, 5, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 14 * MINUTO + 59 * 1000), true);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 15 * MINUTO), false);
});

test("CB-20 · los fallos se suman dentro de 15 minutos, no después", () => {
    const dentro = crearRegistro();
    fallar(dentro, 4, 0);
    fallar(dentro, 1, 14 * MINUTO + 59 * 1000);
    assert.equal(estaFrenado(dentro, EQUIPO, CORREO, 14 * MINUTO + 59 * 1000), true);

    const fuera = crearRegistro();
    fallar(fuera, 4, 0);
    fallar(fuera, 1, 15 * MINUTO);
    assert.equal(estaFrenado(fuera, EQUIPO, CORREO, 15 * MINUTO), false);
});

test("CB-20 · entrar bien borra los fallos de ese correo", () => {
    const registro = crearRegistro();
    fallar(registro, 4, 0);
    anotarExito(registro, EQUIPO, CORREO);
    fallar(registro, 1, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), false);
});

test("CB-20 · un equipo con 19 fallos sigue; con 20 queda frenado para cualquier correo", () => {
    const registro = crearRegistro();
    for (let i = 1; i <= 19; i++) anotarFallo(registro, EQUIPO, `persona${i}@prueba.test`, 0);
    assert.equal(estaFrenado(registro, EQUIPO, "otra@prueba.test", 0), false);
    anotarFallo(registro, EQUIPO, "persona20@prueba.test", 0);
    assert.equal(estaFrenado(registro, EQUIPO, "otra@prueba.test", 0), true);
});

test("CB-20 · los registros viejos se borran para no llenar la memoria", () => {
    const registro = crearRegistro();
    for (let i = 0; i < 600; i++) anotarFallo(registro, `10.1.${i}.1`, "x@prueba.test", 0);
    anotarFallo(registro, EQUIPO, CORREO, 16 * MINUTO);
    assert.equal(registro.size, 2);
});

