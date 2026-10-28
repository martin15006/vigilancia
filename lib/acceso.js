// reglas basicas del inicio de sesion 
const MENSAJES = {
    incorrectos: "Correo o contraseña incorrectos.",
    desactivada: "Esta cuenta está desactivada. Hable con el administrador.",
    sinConexion: "No se pudo conectar con el sistema. Intente de nuevo en un momento.",
    demasiados: "Demasiados intentos fallidos. Espere 15 minutos e intente de nuevo.",
};

function revisarFormulario(correo, contraseña) {
    if (typeof correo !== "string" || !correo.trim()) return MENSAJES.incorrectos;
    if (typeof contraseña !== "string" || !contraseña) return MENSAJES.incorrectos;
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

// al volver atras se vuelve a pedir los datos 
function sinCache(res) {
    res.setHeader("Cache-Control", "no-store");
}

module.exports = { MENSAJES, revisarFormulario, mensajeAlEntrar, revisarCuenta, pantallaDeInicio, sinCache };