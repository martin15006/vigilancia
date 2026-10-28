const express = require("express");

const path = require("path");
const { clienteAdmin, clientePorPeticion } = require("./lib/supabase");
const { revisarFormulario, mensajeAlEntrar, revisarCuenta, MENSAJES, pantallaDeInicio, sinCache } = require("./lib/acceso");
const { crearRegistro, estaFrenado, anotarFallo, anotarExito } = require("./lib/intentos");
const intentos = crearRegistro();

const PORT = 3000;
const app = express();
app.disable("x-powered-by");
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

async function requiereSesion(req, res, next) {
    sinCache(res);
    const supabase = clientePorPeticion(req, res);

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return res.redirect(303, "/login");

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

    req.cuenta = cuenta;
    next();
}



app.get("/salud", async (req, res) => {
    const { error } = await clienteAdmin().auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
        console.error("Supabase no Responde: ", error.message);
        return res.status(503).json({ ok: false });
    }
    res.json({ ok: true });
})

app.get("/login", (req, res) => {
    res.render("login", { mensaje: null, correo: "" })
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: correoLimpio, password: contraseña });
    if (error) {
        if (error.code === "invalid_credentials") anotarFallo(intentos, equipo, correoLimpio, Date.now());
        else console.error("Supabase Auth falló:", error.code, error.message);
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

    res.redirect(303, "/inicio");
});

app.post("/cerrar-sesion", async (req, res) => {
    const supabase = clientePorPeticion(req, res);
    await supabase.auth.signOut({ scope: "local" });
    res.redirect(303, "/login");
});


app.listen(PORT, 'localhost', () => {
    console.log(`conectado a http://localhost:${PORT}`);
});