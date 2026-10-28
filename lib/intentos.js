// limites de intentos incorrectos
const MINUTOS = 60 * 1000;
const VENTANA = 15 * MINUTOS;
const LIMITE_CORREO = 5;
const LIMITE_EQUIPO = 20;
const LIMITE_MEMORIA = 1000;

function crearRegistro() {
    return new Map();
}

function anotar(registro, clave, limite, ahora) {
    let fila = registro.get(clave);
    if (!fila || ahora - fila.desde >= VENTANA) {
        fila = { fallos: 0, desde: ahora, frenadoHasta: 0 };
        registro.set(clave, fila);
    }
    fila.fallos += 1;
    if (fila.fallos >= limite) fila.frenadoHasta = ahora + VENTANA;
}

function frenado(registro, clave, ahora) {
    const fila = registro.get(clave);
    return Boolean(fila && fila.frenadoHasta > ahora);
}



function limpiarViejos(registro, ahora) {
    for (const [clave, fila] of registro) {
        if (ahora - fila.desde >= VENTANA && fila.frenadoHasta <= ahora)
            registro.delete(clave);
    }
}

function estaFrenado(registro, equipo, correo, ahora) {
    return frenado(registro, `equipo:${equipo}`, ahora) || frenado(registro, `correo:${equipo}|${correo}`, ahora);
}


function anotarFallo(registro, equipo, correo, ahora) {
    if (registro.size > LIMITE_MEMORIA) limpiarViejos(registro, ahora);
    anotar(registro, `equipo:${equipo}`, LIMITE_EQUIPO, ahora);
    anotar(registro, `correo:${equipo}|${correo}`, LIMITE_CORREO, ahora);
}

function anotarExito(registro, equipo, correo) {
    registro.delete(`correo:${equipo}|${correo}`);
}

module.exports = { crearRegistro, estaFrenado, anotarFallo, anotarExito };