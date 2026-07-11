"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bird, CheckCircle2, Eye, EyeOff, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (password !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => { window.location.href = "/dashboard"; }, 2500);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-leaf-700 text-white shadow-button">
            <Bird className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-leaf-700">Sistema Pollos</p>
            <p className="font-display text-lg font-black text-soil-900">Nueva contraseña</p>
          </div>
        </div>

        <div className="panel rounded-2xl p-6 sm:p-8">
          {success ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-leaf-50">
                <CheckCircle2 className="size-7 text-leaf-700" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-black text-soil-900">Contraseña actualizada</h1>
                <p className="mt-2 text-sm text-soil-600 leading-relaxed">
                  Tu contraseña fue cambiada correctamente. Redirigiendo al panel...
                </p>
              </div>
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <h1 className="font-display text-xl font-black text-soil-900">Enlace inválido</h1>
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 leading-relaxed">
                Este enlace es inválido o ha expirado. Solicita un nuevo enlace desde la pantalla de inicio de sesión.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-leaf-700 transition hover:text-leaf-900"
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-black text-soil-900" id="rp-title">
                Crear nueva contraseña
              </h1>
              <p className="mt-2 text-sm text-soil-600">Elige una contraseña segura de al menos 6 caracteres.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate aria-labelledby="rp-title">
                <div>
                  <label htmlFor="password" className="field-label">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-leaf-600" aria-hidden="true" />
                    <input
                      id="password"
                      className="field-input pl-10 pr-12"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
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

                <div>
                  <label htmlFor="confirm-password" className="field-label">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-leaf-600" aria-hidden="true" />
                    <input
                      id="confirm-password"
                      className="field-input pl-10"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={6}
                      required
                      placeholder="Repite la contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {message ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert" aria-live="polite">
                    {message}
                  </p>
                ) : null}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading
                    ? <><RefreshCw className="size-4 spin" aria-hidden="true" /> Guardando…</>
                    : "Actualizar contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
