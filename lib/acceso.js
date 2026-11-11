// reglas basicas del inicio de sesion 
const MENSAJES = {
    incorrectos: "Correo o contraseña incorrectos.",
    desactivada: "Esta cuenta está desactivada. Hable con el administrador.",
    sinConexion: "No se pudo conectar con el sistema. Intente de nuevo en un momento.",
    demasiados: "Demasiados intentos fallidos. Espere 15 minutos e intente de nuevo.",
    noEncontrada: "No se encontró esta página.",
    inesperado: "Ocurrió un error inesperado. Intente de nuevo en un momento.",
    vencido: "El formulario venció. Recargue la página e intente de nuevo.",
    inactividad: "Su sesión se cerró después de 15 minutos sin uso. Vuelva a entrar.",
    sinPermiso: "No tiene permiso para ver esto.",
    obligatorio: "Este campo es obligatorio.",
    correoInvalido: "Ingrese un correo válido.",
    correoRepetido: "Ya existe una cuenta con ese correo.",
    ultimoAdmin: "Debe existir al menos un administrador.",
    noAutoDesactivar: "No puede desactivar su propia cuenta.",
    cambiosGuardados: "Cambios guardados.",
    cuentaDesactivada: "Cuenta desactivada.",
    cuentaActivada: "Cuenta activada.",
    claveTemporal: "Por seguridad, cambie su contraseña temporal antes de continuar.",
    claveCorta: "La contraseña debe tener al menos 8 caracteres.",
    claveLarga: "La contraseña puede tener como máximo 72 caracteres.",
    claveNoCoincide: "Las contraseñas no coinciden.",
    claveIgual: "La nueva contraseña debe ser distinta de la temporal.",
    claveCambiada: "Contraseña cambiada.",
};

const LARGO_MAXIMO_CORREO = 254;

function revisarFormulario(correo, contraseña) {
    if (typeof correo !== "string" || !correo.trim()) return MENSAJES.incorrectos;
    if (typeof contraseña !== "string" || !contraseña) return MENSAJES.incorrectos;
    if (correo.trim().length > LARGO_MAXIMO_CORREO) return MENSAJES.incorrectos;
    return null;
}

// credenciales invalidas 
function mensajeAlEntrar(error) {
    if (error.code === "invalid_credentials") return MENSAJES.incorrectos;
    return MENSAJES.sinConexion;
}

// una cuenta desactivada no entra asi el formulario este correcto 
function revisarCuenta(cuenta) {
    if (!cuenta || !cuenta.activa) return MENSAJES.desactivada;
    return null;
}


function pantallaDeInicio(perfil) {
    if (perfil.ver_casos) return "resumen";
    if (perfil.enviar_avisos) return "avisos";
    return null;
}

// se pregunta !== false a propósito: si el dato no llega, se trata como si tuviera que cambiarla. 
function revisarPrimerIngreso(cuenta, paraCambiarClave) {
    const debeCambiar = cuenta?.debe_cambiar !== false;
    if (debeCambiar && !paraCambiarClave) return "/cambiar-contrasena";
    if (!debeCambiar && paraCambiarClave) return "/inicio";
    return null;
}

// se revisa la contraseña nueva antes de enviarla a supabase 
const CLAVE_MINIMA = 8;
const CLAVE_MAXIMA_BYTES = 72;

function revisarClaveNueva(cuerpo) {
    const nueva = cuerpo?.nueva;
    const repetida = cuerpo?.repetida;
    if (typeof nueva !== "string" || [...nueva].length < CLAVE_MINIMA) return { errores: { nueva: MENSAJES.claveCorta } };
    // las tildes y la ñ cuenta como 2 bytes en supabase 
    if (Buffer.byteLength(nueva, "utf8") > CLAVE_MAXIMA_BYTES) return { errores: { nueva: MENSAJES.claveLarga } };
    if (typeof repetida !== "string" || repetida !== nueva) return { errores: { repetida: MENSAJES.claveNoCoincide } };
    return { errores: {}, clave: nueva };
}

// supabase compara las contraseñas 
function mensajeAlCambiarClave(error) {
    if (error.code === "same_password") return { nueva: MENSAJES.claveIgual };
    return { general: MENSAJES.inesperado };
}

const AVISOS_INICIO = { "clave-cambiada": MENSAJES.claveCambiada };
function avisoDeInicio(clave) {
    return typeof clave === "string" && Object.hasOwn(AVISOS_INICIO, clave) ? AVISOS_INICIO[clave] : null;
}

// al volver atras se vuelve a pedir los datos 
function sinCache(res) {
    res.setHeader("Cache-Control", "no-store");
}

module.exports = {
    MENSAJES, revisarFormulario, mensajeAlEntrar, revisarCuenta, pantallaDeInicio, sinCache, LARGO_MAXIMO_CORREO, revisarPrimerIngreso, revisarClaveNueva,
    mensajeAlCambiarClave, avisoDeInicio,
};