const express = require("express");

const path = require("path");
const { clienteAdmin, clientePorPeticion } = require("./lib/supabase");
const { revisarFormulario, mensajeAlEntrar, revisarCuenta, MENSAJES, pantallaDeInicio, sinCache } = require("./lib/acceso");
const { crearRegistro, estaFrenado, anotarExito, empezarIntento, terminarIntento } = require("./lib/intentos");
const intentos = crearRegistro();
const { cabecerasSeguras } = require("./lib/seguridad");
const { parseCookieHeader, serializeCookieHeader } = require("@supabase/ssr");
const { crearToken, leerToken, tokenValido } = require("./lib/csrf");
const { crearMarca, sigueActiva } = require("./lib/inactividad");

const CLAVE_FIRMA = process.env.CLAVE_FIRMA;
if (!CLAVE_FIRMA || CLAVE_FIRMA.length < 32) {
    throw new Error("Falta CLAVE_FIRMA en .env (mínimo 32 caracteres).");
};

function leerCookie(req, nombre) {
    return parseCookieHeader(req.headers.cookie ?? "").find((c) => c.name === nombre)?.value;
}

const COOKIE_ACTIVIDAD = { httpOnly: true, sameSite: "lax", path: "/" };

function ponerMarca(res) {
    res.appendHeader("set-Cookie", serializeCookieHeader("vi_actividad", crearMarca(Date.now(), CLAVE_FIRMA), COOKIE_ACTIVIDAD));
};

function borrarMarca(res) {
    res.appendHeader("Set-Cookie", serializeCookieHeader("vi_actividad", "", {
        ...COOKIE_ACTIVIDAD, maxAge: 0
    }));
};

const PORT = 3000;
const app = express();
app.disable("x-powered-by");
const CABECERAS = cabecerasSeguras({ desarrollo: process.argv.includes("--dev") });
app.use((req, res, next) => {
    res.set(CABECERAS);
    next();
})
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (process.argv.includes("--dev")) {
    const livereload = require("livereload");
    const connectLivereload = require("connect-livereload");
    livereload.createServer({ exts: ["html", "css", "js"] }).watch(path.join(__dirname, "public"));
    app.use(connectLivereload({ ignore: [/^\/api\//] }));
}

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
    const cookie = leerCookie(req, "vi_csrf");
    let valor = leerToken(cookie, CLAVE_FIRMA);
    if (!valor) {
        const nuevo = crearToken(CLAVE_FIRMA);
        valor = nuevo.valor;
        res.appendHeader("Set-Cookie", serializeCookieHeader("vi_csrf", nuevo.cookie, {
            httpOnly: true, sameSite: "lax", path: "/"
        }));
    }
    res.locals.csrf = valor;
    if (req.method === "POST" && !tokenValido(req.body?._csrf, cookie, CLAVE_FIRMA)) {
        return res.status(403).render("error", { mensaje: MENSAJES.vencido });
    }
    next();
});

async function requiereSesion(req, res, next) {
    sinCache(res);
    const supabase = clientePorPeticion(req, res);

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return res.redirect(303, "/login");

    if (!sigueActiva(leerCookie(req, "vi_actividad"), Date.now(), CLAVE_FIRMA)) {
        await supabase.auth.signOut({ scope: "local" });
        borrarMarca(res);
        return res.redirect(303, "/login?motivo=inactividad");
    }

    const { data: cuenta, error: errorCuenta } = await supabase
        .from("cuentas")
        .select("nombre, activa, perfiles (enviar_avisos, ver_casos)")
        .eq("id", data.user.id)
        .maybeSingle();
    if (errorCuenta) {
        console.error("No se pudo leer la cuenta", errorCuenta.code,
            errorCuenta.message
        );
        return res.status(503).render("login", { mensaje: MENSAJES.sinConexion, correo: "" });
    }
    if (revisarCuenta(cuenta)) {
        await supabase.auth.signOut();
        return res.redirect(303, "/login")
    }

    ponerMarca(res);
    req.cuenta = cuenta;
    next();
}



app.get("/salud", async (req, res) => {
    try {
        const respuesta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/health`, {
            headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
        });
        if (!respuesta.ok) throw new Error(`Supabase respondió: ${respuesta.status}`);
        res.json({ ok: true });
    } catch (error) {
        console.error("Supabase no responde:", error.message);
        res.status(503).json({ ok: false })
    }
});

app.get("/login", (req, res) => {
    const mensaje = req.query.motivo === "inactividad" ? MENSAJES.inactividad : null;
    res.render("login", { mensaje, correo: "" })
});

app.get("/", (req, res) => res.redirect(303, "/inicio"));

app.get("/inicio", requiereSesion, (req, res) => {
    res.render("inicio", { nombre: req.cuenta.nombre, pantalla: pantallaDeInicio(req.cuenta.perfiles) });
});

app.post("/login", async (req, res) => {
    const { correo, contraseña } = req.body ?? {};
    const correoLimpio = typeof correo === "string" ? correo.trim().toLowerCase() : "";
    const volver = (estado, mensaje) => res.status(estado).render("login", { mensaje, correo: correoLimpio });

    const faltaAlgo = revisarFormulario(correo, contraseña);
    if (faltaAlgo) return volver(400, faltaAlgo);

    const equipo = req.ip;
    if (estaFrenado(intentos, equipo, correoLimpio, Date.now())) return volver(429, MENSAJES.demasiados);

    const supabase = clientePorPeticion(req, res);
    empezarIntento(intentos, equipo, correoLimpio, Date.now());
    let respuesta;
    try {
        respuesta = await supabase.auth.signInWithPassword({ email: correoLimpio, password: contraseña });
    } finally {
        const fallo = respuesta?.error?.code === "invalid_credentials";
        terminarIntento(intentos, equipo, correoLimpio, Date.now(), fallo);
    }
    const { data, error } = respuesta;
    if (error) {
        if (error.code !== "invalid_credentials") console.error("Supabase Auth falló:", error.code, error.message);
        return volver(error.code === "invalid_credentials" ? 401 : 503, mensajeAlEntrar(error));
    }
    anotarExito(intentos, equipo, correoLimpio);

    const { data: cuenta, error: errorCuenta } = await supabase
        .from("cuentas")
        .select("activa")
        .eq("id", data.user.id)
        .maybeSingle();
    if (errorCuenta) {
        console.error("No se pudo leer la cuenta:", errorCuenta.code, errorCuenta.message);
        await supabase.auth.signOut();
        return volver(503, MENSAJES.sinConexion);
    }

    const bloqueo = revisarCuenta(cuenta);
    if (bloqueo) {
        await supabase.auth.signOut();
        return volver(403, bloqueo)
    }

    ponerMarca(res);
    res.redirect(303, "/inicio");
});

app.post("/cerrar-sesion", async (req, res) => {
    const supabase = clientePorPeticion(req, res);
    await supabase.auth.signOut({ scope: "local" });
    borrarMarca(res);
    res.redirect(303, "/login");
});

app.use((req, res) => {
    res.status(404).render("error", { mensaje: MENSAJES.noEncontrada });
});

app.use((error, req, res, next) => {
    console.error("Error inesperado:", error.message);
    if (res.headersSent) return next(error);
    const estado = error.status >= 400 && error.status < 500 ? error.status : 500;
    res.status(estado).render("error", { mensaje: MENSAJES.inesperado });
});

app.listen(PORT, 'localhost', () => {
    console.log(`conectado a http://localhost:${PORT}`);
});