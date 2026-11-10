const crypto = require("node:crypto");
const { MENSAJES, LARGO_MAXIMO_CORREO } = require("./acceso");

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LETRAS_CLAVE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const LARGO_CLAVE = 12;

function requiereAdmin(req, res, next) {
    if (req.cuenta?.es_admin !== true) return res.status(403).render("error", { mensaje: MENSAJES.sinPermiso });
    next();
}

function revisarDatosCuenta(formulario, idPerfiles, { conCorreo = true } = {}) {
    const { nombre, correo, perfil, acceso } = formulario ?? {};
    const errores = {};
    const datos = {};

    datos.nombre = typeof nombre === "string" ? nombre.trim() : "";
    if (!datos.nombre) errores.nombre = MENSAJES.obligatorio;

    if (conCorreo) {
        datos.correo = typeof correo === "string" ? correo.trim().toLowerCase() : "";
        if (!datos.correo) errores.correo = MENSAJES.obligatorio;
        else if (datos.correo.length > LARGO_MAXIMO_CORREO || !PATRON_CORREO.test(datos.correo)) errores.correo = MENSAJES.correoInvalido;
    }

    datos.perfil_id = Number(perfil);
    if (!idPerfiles.includes(datos.perfil_id)) errores.perfil = MENSAJES.obligatorio;

    if (acceso !== "administrador" && acceso !== "usuario") errores.acceso = MENSAJES.obligatorio;
    datos.es_admin = acceso === "administrador";

    return { errores, datos };
}

function generarClaveTemporal() {
    let clave = "";
    for (let i = 0; i < LARGO_CLAVE; i++) clave += LETRAS_CLAVE[crypto.randomInt(LETRAS_CLAVE.length)];
    return clave;
}

function revisarUltimoAdmin(cuentas, id, cambio) {
    const quedan = cuentas
        .map((cuenta) => (cuenta.id === id ? { ...cuenta, ...cambio } : cuenta))
        .filter((cuenta) => cuenta.es_admin && cuenta.activa).length;
    return quedan > 0 ? null : MENSAJES.ultimoAdmin;
}

function revisarAutodesactivar(idQuienPide, idCuenta, activa) {
    return idQuienPide === idCuenta && activa === false ? MENSAJES.noAutoDesactivar : null;
}

function mensajeAlCrear(error) {
    if (["email_exists", "user_already_exists", "23505"].includes(error?.code)) return MENSAJES.correoRepetido;
    return MENSAJES.inesperado;
}

// la contraseña se muestra una sola vez 
function textoCuentaCreada(clave) {
    return `Cuenta creada. Contraseña temporal: ${clave}. Solo se mostrará esta vez.`;
}

function textoClaveRestablecida(clave) {
    return `Contraseña restablecida. Contraseña temporal: ${clave}. Solo se mostrará esta vez.`;
}

function valoresDelFormulario(cuerpo) {
    const texto = (valor) => (typeof valor === "string" ? valor : "");
    return { nombre: texto(cuerpo?.nombre), correo: texto(cuerpo?.correo), perfil: texto(cuerpo?.perfil), acceso: texto(cuerpo?.acceso) };
}

function valoresDeCuenta(cuenta) {
    return { nombre: cuenta.nombre, correo: cuenta.correo, perfil: String(cuenta.perfil_id), acceso: cuenta.es_admin ? "administrador" : "usuario" };
}

function leerActiva(cuerpo) {
    if (cuerpo?.activa === "true") return true;
    if (cuerpo?.activa === "false") return false;
    return null;
}

const AVISOS_CUENTA = { guardado: MENSAJES.cambiosGuardados, activada: MENSAJES.cuentaActivada, desactivada: MENSAJES.cuentaDesactivada };

function avisoDeCuenta(clave) {
    return typeof clave === "string" && Object.hasOwn(AVISOS_CUENTA, clave) ? AVISOS_CUENTA[clave] : null;
}

module.exports = {
    requiereAdmin, revisarDatosCuenta, generarClaveTemporal, revisarUltimoAdmin, revisarAutodesactivar, mensajeAlCrear, textoCuentaCreada, textoClaveRestablecida,
    valoresDelFormulario, valoresDeCuenta, leerActiva, avisoDeCuenta
};