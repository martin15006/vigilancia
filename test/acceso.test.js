const test = require("node:test");
const assert = require("node:assert/strict");
const { revisarFormulario, mensajeAlEntrar, revisarCuenta, sinCache, pantallaDeInicio, MENSAJES, revisarPrimerIngreso, revisarClaveNueva, mensajeAlCambiarClave, avisoDeInicio } = require("../lib/acceso");

test("HU-01.1 · El jefe entra a enviar aviso", () => {
    assert.equal(pantallaDeInicio({ enviar_avisos: true, ver_casos: false }),
        "avisos");
});

test("HU-01.1 · El epidemiologo entra al resumen", () => {
    assert.equal(pantallaDeInicio({ enviar_avisos: false, ver_casos: true }),
        "resumen");
});

test("HU-01.2 · No decir que credenciales fallo", () => {
    assert.equal(mensajeAlEntrar({ code: "invalid_credentials", status: 400 }),
        "Correo o contraseña incorrectos.");
});

test("HU-01.2 · informacion faltantes o espacios cuentan como incorrecto", () => {
    assert.equal(revisarFormulario("", "clave-de-prueba"), "Correo o contraseña incorrectos.");
    assert.equal(revisarFormulario(" ", "clave-de-prueba"), "Correo o contraseña incorrectos.");
    assert.equal(revisarFormulario("valen@prueba.test", ""), "Correo o contraseña incorrectos.");
    assert.equal(revisarFormulario(undefined, undefined), "Correo o contraseña incorrectos.");
    assert.equal(revisarFormulario("valen@prueba.test", "clave-de-prueba"), null);
});

test("HU-01.2 · datos que no es texto cuenta como incorrecto", () => {
    assert.equal(revisarFormulario(["@prueba.test", "b@prueba.test"], "clave-de-prueba"), "Correo o contraseña incorrectos.");
    assert.equal(revisarFormulario("valen@prueba.test", ["x", "y"]), "Correo o contraseña incorrectos.");
});

test("HU-01.3 · cuenta desactivada no puede ingresar", () => {
    assert.equal(revisarCuenta({ activa: false }), "Esta cuenta está desactivada. Hable con el administrador.");
    assert.equal(revisarCuenta(null), "Esta cuenta está desactivada. Hable con el administrador.");
    assert.equal(revisarCuenta({ activa: true }), null);
});

test("HU-01.4 · El navegador no guarda", () => {
    const cabeceras = {};
    const res = { setHeader: (nombre, valor) => { cabeceras[nombre] = valor; } };
    sinCache(res);
    assert.equal(cabeceras["Cache-Control"], "no-store");
});

test("CB-19 · Si supabase falla no culpa a nadie", () => {
    const sinInternet = { name: "authRetryableFetchError", status: 0, message: "fetch failed" };
    const muchosIntentos = { code: "over_request_rate_limit", status: 429 };
    assert.equal(mensajeAlEntrar(sinInternet), "No se pudo conectar con el sistema. Intente de nuevo en un momento.");
    assert.equal(mensajeAlEntrar(muchosIntentos), "No se pudo conectar con el sistema. Intente de nuevo en un momento.");
})

test("CB-20 · El mensaje de freno dice cuanto tiempo esperar", () => {
    assert.equal(MENSAJES.demasiados, "Demasiados intentos fallidos. Espere 15 minutos e intente de nuevo.");
})

test("base · textos en la pagina de error", () => {
    assert.equal(MENSAJES.noEncontrada, "No se encontró esta página.");
    assert.equal(MENSAJES.inesperado, "Ocurrió un error inesperado. Intente de nuevo en un momento.");
    assert.equal(MENSAJES.vencido, "El formulario venció. Recargue la página e intente de nuevo.");
})

test("RNF-09 · el aviso de inactividad", () => {
    assert.equal(MENSAJES.inactividad, "Su sesión se cerró después de 15 minutos sin uso. Vuelva a entrar.");
});

test("CB-20 · un correo de 254 caracteres se acepta; uno de 255, No", () => {
    const dominio = "@prueba.test";
    const de254 = "a".repeat(254 - dominio.length) + dominio;
    const de255 = "a" + de254;
    assert.equal(de254.length, 254);
    assert.equal(revisarFormulario(de254, "clave-de-prueba"), null);
    assert.equal(revisarFormulario(de255, "clave-de-prueba"), "Correo o contraseña incorrectos.");
});

test("HU-02.1 · con la contraseña temporal, cualquier página lleva a cambiarla", () => {
    assert.equal(revisarPrimerIngreso({ debe_cambiar: true }, false), "/cambiar-contrasena");
});

test("HU-02.1 · con la contraseña temporal, la pantalla para cambiar sí se abre", () => {
    assert.equal(revisarPrimerIngreso({ debe_cambiar: true }, true), null);
});

test("HU-02.1 · sin la contraseña temporal, las páginas se abren normal y la de cambiarla lleva a inicio", () => {
    assert.equal(revisarPrimerIngreso({ debe_cambiar: false }, false), null);
    assert.equal(revisarPrimerIngreso({ debe_cambiar: false }, true), "/inicio");
});

test("HU-02.1 · si el dato no llega o viene raro, se trata como contraseña temporal", () => {
    assert.equal(revisarPrimerIngreso({}, false), "/cambiar-contrasena");
    assert.equal(revisarPrimerIngreso({ debe_cambiar: null }, false), "/cambiar-contrasena");
    assert.equal(revisarPrimerIngreso({ debe_cambiar: "false" }, false), "/cambiar-contrasena");
    assert.equal(revisarPrimerIngreso(null, false), "/cambiar-contrasena");
});

test("HU-02.1 · el aviso de la contraseña temporal", () => {
    assert.equal(MENSAJES.claveTemporal, "Por seguridad, cambie su contraseña temporal antes de continuar.");
});

const iguales = (clave) => ({ nueva: clave, repetida: clave });

test("RNF-04 · 7 caracteres no alcanzan; 8 sí", () => {
    assert.deepEqual(revisarClaveNueva(iguales("abcdefg")).errores, { nueva: "La contraseña debe tener al menos 8 caracteres." });
    assert.deepEqual(revisarClaveNueva(iguales("abcdefgh")), { errores: {}, clave: "abcdefgh" });
});

test("RNF-04 · el mínimo cuenta caracteres reales: 4 emojis no son 8 caracteres", () => {
    assert.equal("😀".repeat(4).length, 8);
    assert.deepEqual(revisarClaveNueva(iguales("😀".repeat(4))).errores, { nueva: "La contraseña debe tener al menos 8 caracteres." });
    assert.deepEqual(revisarClaveNueva(iguales("😀".repeat(8))).errores, {});
});

test("D40 · 72 bytes se aceptan; 73, no", () => {
    assert.deepEqual(revisarClaveNueva(iguales("a".repeat(72))).errores, {});
    assert.deepEqual(revisarClaveNueva(iguales("a".repeat(73))).errores, { nueva: "La contraseña puede tener como máximo 72 caracteres." });
});

test("D40 · una ñ ocupa 2 bytes: 36 ñ se aceptan; 37, no", () => {
    assert.deepEqual(revisarClaveNueva(iguales("ñ".repeat(36))).errores, {});
    assert.deepEqual(revisarClaveNueva(iguales("ñ".repeat(37))).errores, { nueva: "La contraseña puede tener como máximo 72 caracteres." });
});

test("HU-02.1 · las 2 contraseñas tienen que ser iguales, sin recortar espacios", () => {
    assert.deepEqual(revisarClaveNueva({ nueva: "clave-de-prueba", repetida: "clave-de-pruebA" }).errores, { repetida: "Las contraseñas no coinciden." });
    assert.deepEqual(revisarClaveNueva({ nueva: "clave-de-prueba", repetida: "clave-de-prueba " }).errores, { repetida: "Las contraseñas no coinciden." });
    assert.deepEqual(revisarClaveNueva({ nueva: " clave-de-prueba", repetida: " clave-de-prueba" }), { errores: {}, clave: " clave-de-prueba" });
});

test("HU-02.1 · campos que faltan o llegan repetidos no pasan", () => {
    assert.deepEqual(revisarClaveNueva({}).errores, { nueva: "La contraseña debe tener al menos 8 caracteres." });
    assert.deepEqual(revisarClaveNueva(undefined).errores, { nueva: "La contraseña debe tener al menos 8 caracteres." });
    assert.deepEqual(revisarClaveNueva({ nueva: ["clave-de-prueba", "otra-clave-x"], repetida: "clave-de-prueba" }).errores, { nueva: "La contraseña debe tener al menos 8 caracteres." });
    assert.deepEqual(revisarClaveNueva({ nueva: "clave-de-prueba", repetida: ["clave-de-prueba"] }).errores, { repetida: "Las contraseñas no coinciden." });
    assert.deepEqual(revisarClaveNueva({ nueva: "clave-de-prueba", }).errores, { repetida: "Las contraseñas no coinciden." });
});

test("HU-02.1 · si supabase dice que es igual a la guardada, se pide otra", () => {
    assert.deepEqual(mensajeAlCambiarClave({ code: "same_password" }), { nueva: "La nueva contraseña debe ser distinta de la temporal." });
    assert.deepEqual(mensajeAlCambiarClave({ code: "weak_password" }), { general: "Ocurrió un error inesperado. Intente de nuevo en un momento." });
    assert.deepEqual(mensajeAlCambiarClave({ code: "session_not_found" }), { general: "Ocurrió un error inesperado. Intente de nuevo en un momento." });
});

test("D41 · inicio solo muestra el aviso de la contraseña cambiada", () => {
    assert.equal(avisoDeInicio("clave-cambiada"), "Contraseña cambiada.");
    assert.equal(avisoDeInicio("<script>"), null);
    assert.equal(avisoDeInicio("constructor"), null);
    assert.equal(avisoDeInicio("__proto__"), null);
    assert.equal(avisoDeInicio(["clave-cambiada"]), null);
    assert.equal(avisoDeInicio(undefined), null);
});