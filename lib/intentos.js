// limites de intentos incorrectos
const MINUTOS = 60 * 1000;
const VENTANA = 15 * MINUTOS;
const LIMITE_CORREO = 5;
const LIMITE_EQUIPO = 20;
const LIMITE_MEMORIA = 1000;
const TOPE_DURO = 10000;

function crearRegistro() {
    return new Map();
}

function obtener(registro, clave, ahora) {
    let fila = registro.get(clave);
    if (!fila) {
        fila = { fallos: 0, enCurso: 0, desde: ahora, frenadoHasta: 0 };
        registro.set(clave, fila);
    }
    return fila;
}

function anotar(registro, clave, limite, ahora) {
    const fila = obtener(registro, clave, ahora);
    if (ahora - fila.desde >= VENTANA) {
        fila.fallos = 0;
        fila.desde = ahora;
    }
    fila.fallos += 1;
    if (fila.fallos >= limite) fila.frenadoHasta = ahora + VENTANA;
}

function frenado(registro, clave, limite, ahora) {
    const fila = registro.get(clave);
    if (!fila) return false;
    if (fila.frenadoHasta > ahora) return true;
    const fallosRecientes = ahora - fila.desde >= VENTANA ? 0 : fila.fallos;
    return fallosRecientes + fila.enCurso >= limite;
}



function limpiarViejos(registro, ahora) {
    for (const [clave, fila] of registro) {
        if (ahora - fila.desde >= VENTANA && fila.frenadoHasta <= ahora && fila.enCurso === 0)
            registro.delete(clave)
    }
}

function estaFrenado(registro, equipo, correo, ahora) {
    return frenado(registro, `equipo:${equipo}`, LIMITE_EQUIPO, ahora)
        || frenado(registro, `correo:${equipo}|${correo}`, LIMITE_CORREO, ahora);
}


function anotarFallo(registro, equipo, correo, ahora) {
    if (registro.size > LIMITE_MEMORIA) limpiarViejos(registro, ahora);
    anotar(registro, `equipo:${equipo}`, LIMITE_EQUIPO, ahora);
    anotar(registro, `correo:${equipo}|${correo}`, LIMITE_CORREO, ahora);
}

function empezarIntento(registro, equipo, correo, ahora) {
    if (registro.size > LIMITE_MEMORIA) limpiarViejos(registro, ahora);
    const claves = [`equipo:${equipo}`, `correo:${equipo}|${correo}`];
    const nuevas = claves.filter((clave) => !registro.has(clave)).length;
    if (registro.size + nuevas > TOPE_DURO) return false;
    for (const clave of claves) obtener(registro, clave, ahora).enCurso += 1;
    return true;
}

function terminarIntento(registro, equipo, correo, ahora, fallo) {
    for (const clave of [`equipo:${equipo}`, `correo:${equipo}|${correo}`]) {
        const fila = registro.get(clave);
        if (fila && fila.enCurso > 0) fila.enCurso -= 1;
    }
    if (fallo) anotarFallo(registro, equipo, correo, ahora);
}

function anotarExito(registro, equipo, correo) {
    registro.delete(`correo:${equipo}|${correo}`);
}



module.exports = { crearRegistro, estaFrenado, anotarFallo, anotarExito, empezarIntento, terminarIntento, TOPE_DURO };