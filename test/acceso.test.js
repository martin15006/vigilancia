const test = require("node:test");
const assert = require("node:assert/strict");
const { revisarFormulario, mensajeAlEntrar, revisarCuenta, sinCache, pantallaDeInicio, MENSAJES } = require("../lib/acceso");

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