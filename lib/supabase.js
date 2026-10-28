const { createClient } = require("@supabase/supabase-js");
const { createServerClient, parseCookieHeader, serializeCookieHeader } = require("@supabase/ssr");

function clientePorPeticion(req, res) {
    return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
        cookies: {
            getAll() {
                return parseCookieHeader(req.headers.cookie ?? "");
            },
            setAll(cookiesParaGuardar, cabeceras) {
                cookiesParaGuardar.forEach(({ name, value, options }) => {
                    res.appendHeader("set-Cookie", serializeCookieHeader(name, value, {
                        ...options, httpOnly: true
                    }));
                });
                Object.entries(cabeceras).forEach(([clave, valor]) => res.setHeader(clave, valor));
            },
        },
    });
}

function clienteAdmin() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

module.exports = { clientePorPeticion, clienteAdmin };