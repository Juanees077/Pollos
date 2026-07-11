"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bird, Eye, EyeOff, Lock, Mail, RefreshCw, TrendingUp, Users, Warehouse } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const FEATURES = [
  { icon: Warehouse, label: "Control de galpones", desc: "Gestiona múltiples galpones con inventario en tiempo real" },
  { icon: TrendingUp, label: "Utilidad por galpón", desc: "Reportes de rentabilidad, costos e ingresos detallados" },
  { icon: Users, label: "Clientes y ventas", desc: "Registro de ventas y cartera de clientes integrado" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMsgType("error");
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.");
      return;
    }

    setLoading(true);
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (result.error) {
      setMsgType("error");
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMsgType("success");
      setMessage("Cuenta creada. Revisa tu correo para confirmar tu cuenta.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-dvh" aria-label="Inicio de sesión">
      {/* ── Left hero panel (hidden on mobile) ── */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[540px] shrink-0 flex-col justify-between p-10 xl:p-14"
        style={{ background: "var(--sidebar-bg)" }}
        aria-hidden="true"
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-leaf-700/40 text-white">
            <Bird className="size-5" />
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-white/70">Sistema Pollos</span>
        </div>

        {/* Headline */}
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-leaf-500">Gestión avícola</p>
          <h1 className="font-display text-4xl xl:text-5xl font-black leading-[1.1] text-white">
            Tus galpones,<br />bajo control.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-white/55">
            Administra inventario, ventas y rentabilidad de tu producción avícola desde un solo lugar.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-4">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(67,139,74,0.18)" }}>
                  <Icon className="size-4 text-leaf-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/25">© {new Date().getFullYear()} Sistema Pollos · Todos los derechos reservados</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-xl bg-leaf-700 text-white shadow-button">
              <Bird className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xs font-bold uppercase tracking-[0.2em] text-leaf-700">Sistema Pollos</p>
              <p className="font-display text-2xl font-black text-soil-900">Galpones bajo control</p>
            </div>
          </div>

          <div className="panel rounded-2xl p-6 sm:p-8">
            <h2 className="font-display text-2xl font-black text-soil-900">
              {mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta"}
            </h2>
            <p className="mt-1 text-sm text-soil-600">
              {mode === "login"
                ? "Ingresa a tu panel de administración"
                : "Configura el acceso de administrador"}
            </p>

            {/* Mode toggle */}
            <div className="mt-6 grid grid-cols-2 rounded-lg border border-soil-100 bg-soil-50/60 p-1">
              <button
                type="button"
                className={`min-h-10 rounded-md text-sm font-semibold transition ${
                  mode === "login" ? "bg-leaf-700 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"
                }`}
                onClick={() => { setMode("login"); setMessage(""); }}
              >
                Ingresar
              </button>
              <button
                type="button"
                className={`min-h-10 rounded-md text-sm font-semibold transition ${
                  mode === "signup" ? "bg-leaf-700 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"
                }`}
                onClick={() => { setMode("signup"); setMessage(""); }}
              >
                Crear admin
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="field-label">Correo electrónico</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-leaf-600" aria-hidden="true" />
                  <input
                    id="email"
                    className="field-input pl-10"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="correo@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="field-label">Contraseña</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-leaf-600" aria-hidden="true" />
                  <input
                    id="password"
                    className="field-input pl-10 pr-12"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-soil-500 transition hover:bg-leaf-50 hover:text-leaf-700"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Message */}
              {message ? (
                <p
                  className={`rounded-lg px-3 py-2.5 text-sm leading-snug ${
                    msgType === "success"
                      ? "border border-leaf-200 bg-leaf-50 text-leaf-900"
                      : "border border-red-200 bg-red-50 text-red-800"
                  }`}
                  role="alert"
                  aria-live="polite"
                >
                  {message}
                </p>
              ) : null}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-1"
              >
                {loading
                  ? <><RefreshCw className="size-4 spin" aria-hidden="true" /> Procesando…</>
                  : mode === "login" ? "Entrar al panel" : "Crear cuenta administrador"}
              </button>

              {mode === "login" ? (
                <div className="text-center pt-1">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-semibold text-leaf-700 transition hover:text-leaf-900"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              ) : null}
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-soil-500">
            Sistema de gestión avícola · Datos protegidos con Supabase
          </p>
        </div>
      </div>
    </main>
  );
}
