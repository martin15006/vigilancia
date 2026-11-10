const test = require("node:test");
const assert = require("node:assert/strict");
const {
    requiereAdmin, revisarDatosCuenta, generarClaveTemporal, revisarUltimoAdmin,
    revisarAutodesactivar, mensajeAlCrear, textoCuentaCreada, textoClaveRestablecida, valoresDelFormulario,
    valoresDeCuenta, avisoDeCuenta, leerActiva,
} = require("../lib/cuentas");


const PERFILES = [1, 2];
const BUENO = { nombre: "  Ana Prueba  ", correo: " Ana@Prueba.TEST ", perfil: "1", acceso: "usuario" };

function respuestaFalsa() {
    const res = { estado: null, vista: null, datos: null };
    res.status = (codigo) => { res.estado = codigo; return res; };
    res.render = (vista, datos) => { res.vista = vista; res.datos = datos; };
    return res;
}

test("HU-02.5 · alguien sin el tipo de acceso Administrador ve 'No tiene permiso para ver esto.'", () => {
    const res = respuestaFalsa();
    let siguio = false;
    requiereAdmin({ cuenta: { es_admin: false } }, res, () => { siguio = true; });
    assert.equal(siguio, false);
    assert.equal(res.estado, 403);
    assert.equal(res.vista, "error");
    assert.equal(res.datos.mensaje, "No tiene permiso para ver esto.");
});

test("HU-02.5 · si la cuenta no trae el dato es_admin, o no hay cuenta, tampoco pasa", () => {
    for (const req of [{ cuenta: { nombre: "valen" } }, {}]) {
        const res = respuestaFalsa();
        let siguio = false;
        requiereAdmin(req, res, () => { siguio = true; });
        assert.equal(siguio, false);
        assert.equal(res.estado, 403);
    }
});

test("HU-02.5 · un administrador sí pasa", () => {
    let siguio = false;
    requiereAdmin({ cuenta: { es_admin: true } }, respuestaFalsa(), () => { siguio = true; });
    assert.equal(siguio, true);
});

test("HU-02.1 · los datos buenos salen limpios: sin espacios y el correo en minúsculas", () => {
    const { errores, datos } = revisarDatosCuenta(BUENO, PERFILES);
    assert.deepEqual(errores, {});
    assert.deepEqual(datos, { nombre: "Ana Prueba", correo: "ana@prueba.test", perfil_id: 1, es_admin: false });
    assert.equal(revisarDatosCuenta({ ...BUENO, acceso: "administrador" }, PERFILES).datos.es_admin, true);
});

test("CB-12 · un nombre con solo espacios es 'Este campo es obligatorio.'", () => {
    const { errores } = revisarDatosCuenta({ ...BUENO, nombre: "   " }, PERFILES);
    assert.equal(errores.nombre, "Este campo es obligatorio.");
});

test("HU-02.1 · un correo vacío es obligatorio y uno sin forma de correo no es válido", () => {
    assert.equal(revisarDatosCuenta({ ...BUENO, correo: "" }, PERFILES).errores.correo, "Este campo es obligatorio.");
    for (const correo of ["ana", "ana@prueba", "ana prueba@x.test", "@prueba.test"]) {
        assert.equal(revisarDatosCuenta({ ...BUENO, correo }, PERFILES).errores.correo, "Ingrese un correo válido.");
    }
});

test("HU-02.1 · un correo de 254 caracteres se acepta; uno de 255, no", () => {
    const dominio = "@prueba.test";
    const de254 = "a".repeat(254 - dominio.length) + dominio;
    assert.equal(revisarDatosCuenta({ ...BUENO, correo: de254 }, PERFILES).errores.correo, undefined);
    assert.equal(revisarDatosCuenta({ ...BUENO, correo: "a" + de254 }, PERFILES).errores.correo, "Ingrese un correo válido.");
});

test("HU-02.1 · un perfil que no existe o un tipo de acceso raro no se aceptan", () => {
    const { errores } = revisarDatosCuenta({ ...BUENO, perfil: "99", acceso: "dueño" }, PERFILES);
    assert.equal(errores.perfil, "Este campo es obligatorio.");
    assert.equal(errores.acceso, "Este campo es obligatorio.");
});

test("HU-02.1 · datos que no son texto (un campo repetido) no se aceptan", () => {
    const { errores } = revisarDatosCuenta({ nombre: ["a", "b"], correo: ["a@x.test"], perfil: ["1", "2"], acceso: ["usuario"] }, PERFILES);
    assert.deepEqual(Object.keys(errores).sort(), ["acceso", "correo", "nombre", "perfil"]);
});

test("HU-02.4 · al editar, el correo no se revisa ni se cambia (D38)", () => {
    const { errores, datos } = revisarDatosCuenta({ ...BUENO, correo: undefined }, PERFILES, { conCorreo: false });
    assert.deepEqual(errores, {});
    assert.equal("correo" in datos, false);
});

test("HU-02.1 · la contraseña temporal tiene 12 caracteres, sin letras que se confundan, y cambia cada vez", () => {
    const claves = new Set();
    for (let i = 0; i < 200; i++) {
        const clave = generarClaveTemporal();
        assert.equal(clave.length, 12);
        assert.match(clave, /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/);
        claves.add(clave);
    }
    assert.equal(claves.size, 200);
    // Entre 2.400 caracteres al azar tienen que aparecer las 55 letras permitidas: si falta una, el alfabeto está mal escrito.
    assert.equal(new Set([...claves].join("")).size, 55);
});

test("CB-06 · al último administrador activo no se le puede quitar el acceso ni desactivar", () => {
    const cuentas = [
        { id: "a", es_admin: true, activa: true },
        { id: "b", es_admin: false, activa: true },
        { id: "c", es_admin: true, activa: false },
    ];
    assert.equal(revisarUltimoAdmin(cuentas, "a", { es_admin: false }), "Debe existir al menos un administrador.");
    assert.equal(revisarUltimoAdmin(cuentas, "a", { activa: false }), "Debe existir al menos un administrador.");
    assert.equal(revisarUltimoAdmin(cuentas, "c", { es_admin: false }), null);
    assert.equal(revisarUltimoAdmin(cuentas, "b", { es_admin: true }), null);
});

test("CB-06 · con dos administradores activos, a uno sí se le puede quitar", () => {
    const cuentas = [
        { id: "a", es_admin: true, activa: true },
        { id: "d", es_admin: true, activa: true },
    ];
    assert.equal(revisarUltimoAdmin(cuentas, "a", { es_admin: false }), null);
});

test("HU-02.8 · nadie se desactiva a sí mismo, pero sí puede desactivar a otro", () => {
    assert.equal(revisarAutodesactivar("a", "a", false), "No puede desactivar su propia cuenta.");
    assert.equal(revisarAutodesactivar("a", "b", false), null);
    assert.equal(revisarAutodesactivar("a", "a", true), null);
});

test("HU-02.2 · un correo que ya tiene cuenta da 'Ya existe una cuenta con ese correo.'", () => {
    for (const code of ["email_exists", "user_already_exists", "23505"]) {
        assert.equal(mensajeAlCrear({ code }), "Ya existe una cuenta con ese correo.");
    }
    assert.equal(mensajeAlCrear({ code: "otra_cosa" }), "Ocurrió un error inesperado. Intente de nuevo en un momento.");
});

test("HU-02.1 y HU-02.6 · los textos de la contraseña temporal (D37)", () => {
    assert.equal(textoCuentaCreada("Ab3dEf7hJk9m"), "Cuenta creada. Contraseña temporal: Ab3dEf7hJk9m. Solo se mostrará esta vez.");
    assert.equal(textoClaveRestablecida("Ab3dEf7hJk9m"), "Contraseña restablecida. Contraseña temporal: Ab3dEf7hJk9m. Solo se mostrará esta vez.");
});

test("HU-02 · los textos de cuentas (D37)", () => {
    const { MENSAJES } = require("../lib/acceso");
    assert.equal(MENSAJES.cambiosGuardados, "Cambios guardados.");
    assert.equal(MENSAJES.cuentaDesactivada, "Cuenta desactivada.");
    assert.equal(MENSAJES.cuentaActivada, "Cuenta activada.");
});

test("base · CL-07 · el formulario se vuelve a llenar solo con sus 4 campos y solo con texto", () => {
    const cuerpo = { nombre: "Ana", correo: ["a@x.test", "b@x.test"], perfil: "2", acceso: "usuario", settings: { "view options": {} }, _csrf: "x" };
    assert.deepEqual(valoresDelFormulario(cuerpo), {
        nombre: "Ana", correo: "", perfil: "2",
        acceso: "usuario"
    });
    assert.deepEqual(valoresDelFormulario(undefined), {
        nombre: "", correo: "", perfil: "", acceso: ""
    });
});

test("HU-02.4 · al editar, el formulario arranca con lo guardado de la cuenta", () => {
    const cuenta = {
        id: "a", nombre: "valen", correo: "valen@prueba.test", perfil_id: 1,
        es_admin: false, activa: true, debe_cambiar: false
    };
    assert.deepEqual(valoresDeCuenta(cuenta), { nombre: "valen", correo: "valen@prueba.test", perfil: "1", acceso: "usuario" });
    assert.equal(valoresDeCuenta({ ...cuenta, es_admin: true }).acceso, "administrador");
});

test("HU-02.3 y HU-02.7 · activar o desactivar solo la carpeta", () => {
    assert.equal(leerActiva({ activa: "true" }), true);
    assert.equal(leerActiva({ activa: "false" }), false);
    for (const cuerpo of [{ activa: "si" }, { activa: ["false"] }, { activa: true }, {}, undefined]) {
        assert.equal(leerActiva(cuerpo), null);
    }
});

test("HU-02 · los archivos que llegan por la dirección solo dan textos fijos", () => {
    assert.equal(avisoDeCuenta("guardado"), "Cambios guardados.");
    assert.equal(avisoDeCuenta("activada"), "Cuenta activada.");
    assert.equal(avisoDeCuenta("desactivada"), "Cuenta desactivada.");
    for (const clave of ["<script>", "constructor", "__proto__", "toString", ["guardado"], undefined]) {
        assert.equal(avisoDeCuenta(clave), null);
    }
});