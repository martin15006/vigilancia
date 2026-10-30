const test = require("node:test");
const assert = require("node:assert/strict");
const { cabecerasSeguras } = require("../lib/seguridad");

test("base · fuera de desarrollo, la CSP solo deja cargar desde el propio servidor", () => {
    assert.equal(
        cabecerasSeguras()["Content-Security-Policy"],
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    );
});

test("base · en desarrollo se agrega solo el livereload de este equipo", () => {
    const csp = cabecerasSeguras({ desarrollo: true })["Content-Security-Policy"];
    assert.ok(csp.includes("script-src 'self' http://localhost:35729;"));
    assert.ok(csp.includes("connect-src 'self' ws://localhost:35729;"));
});

test("base · ni en desarrollo se permiten scripts escritos dentro de la página", () => {
    for (const desarrollo of [false, true]) {
        const csp = cabecerasSeguras({ desarrollo })["Content-Security-Policy"];
        assert.ok(!csp.includes("unsafe-inline"));
        assert.ok(!csp.includes("unsafe-eval"));
    }
});

test("base · las demás cabeceras de seguridad", () => {
    const cabeceras = cabecerasSeguras();
    assert.equal(cabeceras["X-Content-Type-Options"], "nosniff");
    assert.equal(cabeceras["Referrer-Policy"], "same-origin");
    assert.equal(cabeceras["Cross-Origin-Opener-Policy"], "same-origin");
    assert.equal(cabeceras["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
});
