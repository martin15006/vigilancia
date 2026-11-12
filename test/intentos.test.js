const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRegistro, estaFrenado, anotarFallo, anotarExito, empezarIntento, terminarIntento, TOPE_DURO } = require("../lib/intentos");

const MINUTO = 60 * 1000;
const EQUIPO = "10.0.0.5";
const CORREO = "valen@prueba.test";

function fallar(registro, veces, ahora) {
    for (let i = 0; i < veces; i++) anotarFallo(registro, EQUIPO, CORREO, ahora);
};

function llenar(registro, cuantas, ahora) {
    for (let i = 0; i < cuantas; i++) registro.set(`relleno:${i}`, { fallos: 0, enCurso: 1, desde: ahora, frenadoHasta: 0 });
};

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

test("CB-20 · con 4 intentos esperando respuesta, el quinto todavía puede intentar", () => {
    const registro = crearRegistro();
    for (let i = 0; i < 4; i++) empezarIntento(registro, EQUIPO, CORREO, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), false);
});

test("CB-20 · si 5 intentos empiezan a la vez, el sexto queda frenado aunque ninguno haya terminado", () => {
    const registro = crearRegistro();
    for (let i = 0; i < 5; i++) empezarIntento(registro, EQUIPO, CORREO, 0);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), true);
});

test("CB-20 · al terminar, los intentos se sueltan y solo los fallidos se anotan", () => {
    const registro = crearRegistro();
    for (let i = 0; i < 5; i++) empezarIntento(registro, EQUIPO, CORREO, 0);
    for (let i = 0; i < 4; i++) terminarIntento(registro, EQUIPO, CORREO, 0, true);
    terminarIntento(registro, EQUIPO, CORREO, 0, false);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), false);
    empezarIntento(registro, EQUIPO, CORREO, 0);
    terminarIntento(registro, EQUIPO, CORREO, 0, true);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 0), true);
});

test("CB-20 · la limpieza de memoria no borra intentos que esperan respuesta", () => {
    const registro = crearRegistro();
    for (let i = 0; i < 5; i++) empezarIntento(registro, EQUIPO, CORREO, 0);
    for (let i = 0; i < 600; i++) anotarFallo(registro, `10.1.${i}.1`, "x@prueba.test", 0);
    anotarFallo(registro, "10.9.9.9", "y@prueba.test", 16 * MINUTO);
    assert.equal(estaFrenado(registro, EQUIPO, CORREO, 16 * MINUTO), true);
});

test("CB-20 · con la libreta llena, un correo no puede empezar", () => {
    const registro = crearRegistro();
    llenar(registro, TOPE_DURO, 0);
    assert.equal(empezarIntento(registro, EQUIPO, CORREO, 0), false);
    assert.equal(registro.size, TOPE_DURO);
});

test("CB-20 · con espacio justo para sus dos filas, todavía puede empezar", () => {
    const registro = crearRegistro();
    llenar(registro, TOPE_DURO - 2, 0);
    assert.equal(empezarIntento(registro, EQUIPO, CORREO, 0), true);
    assert.equal(registro.size, TOPE_DURO);
});

test("CB-20 · con la libreta llena, quien ya estaba anotado sigue pudiento intentar", () => {
    const registro = crearRegistro();
    empezarIntento(registro, EQUIPO, CORREO, 0);
    terminarIntento(registro, EQUIPO, CORREO, 0, true);
    assert.equal(registro.get(`correo:${EQUIPO}|${CORREO}`).fallos, 1);
    llenar(registro, TOPE_DURO - 2, 0);
    assert.equal(empezarIntento(registro, EQUIPO, CORREO, 0), true);
});