const readline = require("node:readline/promises");
const { clienteAdmin } = require("../lib/supabase");

const PERFILES = { j: "Jefe", e: "Epidemiólogo" };

async function preguntarDatos() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        const nombre = (await rl.question("Nombre: ")).trim();
        if (!nombre) throw new Error("El nombre es Obligatorio.");


        const correo = (await rl.question("Correo (termina en @prueba.test): ")).trim().toLowerCase();
        if (!correo.endsWith("@prueba.test")) throw new Error("El correo debe terminar en @prueba.test (CL-01).");

        const perfil = PERFILES[(await rl.question("perfil (j = Jefe, e= Epidemiólogo):")).trim().toLowerCase()];
        if (!perfil) throw new Error("Escriba j o e.");

        const esAdmin = (await rl.question("¿Es administrador? (s/n): ")).trim().toLowerCase() === "s";
        const activa = (await rl.question("¿Cuenta activa? (s/n): ")).trim().toLowerCase() === "s";

        const contraseña = await rl.question("Contraseña (minimo 8 caracteres): ");
        if (contraseña.length < 8) throw new Error("La contraseña debe tener minimo 8 caracteres (RNF-04).");

        return { nombre, correo, perfil, esAdmin, activa, contraseña };
    } finally {
        rl.close();
    }
}

async function main() {
    const datos = await preguntarDatos();
    const supabase = clienteAdmin();

    const { data: filaPerfil, error: errorPerfil } = await supabase.from("perfiles").select("id").eq("nombre", datos.perfil).single();
    if (errorPerfil) throw new Error(`No se encontro el perfil ${datos.perfil}: ${errorPerfil.message}`);

    const { data: creado, error: errorAuth } = await supabase.auth.admin.createUser({
        email: datos.correo,
        password: datos.contraseña,
        email_confirm: true,
    });
    if (errorAuth) throw new Error(`No se pudo crear el usuario: ${errorAuth.message}`);

    const { error: errorCuenta } = await supabase.from("cuentas").insert({
        id: creado.user.id,
        nombre: datos.nombre,
        correo: datos.correo,
        perfil_id: filaPerfil.id,
        es_admin: datos.esAdmin,
        activa: datos.activa,
        debe_cambiar: true,
    });
    if (errorCuenta) {
        await supabase.auth.admin.deleteUser(creado.user.id);
        throw new Error(`No se guardó la cuenta, se ha eliminado la cuenta: ${errorCuenta.message}`);
    }

    const { error: errorEvento } = await supabase.from("eventos").insert({
        accion: "crear", cuenta: creado.user.id, detalle: { origen: "script" },
    });
    if (errorEvento) console.error("La cuenta se creó, pero no quedó en el registro:", errorEvento.code, errorEvento.message);


    console.log(`Cuenta creada: ${datos.nombre} · ${datos.perfil} · ${datos.esAdmin ? "Administrador" : "Usuario"} · ${datos.activa ? "activa" : "desactivada"}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});