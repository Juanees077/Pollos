"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try { return createClient(); } catch { return null; }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura las variables de entorno de Supabase.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    } else {
      setSuccess(true);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover shadow-button" />
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.2em] text-leaf-700">Sistema Pollos</p>
            <p className="font-display text-lg font-black text-soil-900">Recuperar acceso</p>
          </div>
        </div>

        <div className="panel rounded-2xl p-6 sm:p-8">
          {success ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint-50">
                <CheckCircle2 className="size-7 text-mint-700" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-black text-soil-900">Correo enviado</h1>
                <p className="mt-2 text-sm text-soil-600 leading-relaxed">
                  Te enviamos un enlace de restablecimiento. Revisa tu bandeja de entrada y carpeta de spam.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-leaf-700 transition hover:text-leaf-900"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-black text-soil-900" id="fp-title">
                Restablecer contraseña
              </h1>
              <p className="mt-2 text-sm text-soil-600 leading-relaxed">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate aria-labelledby="fp-title">
                <div>
                  <label htmlFor="email" className="field-label">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-leaf-600" aria-hidden="true" />
                    <input
                      id="email"
                      className="field-input !pl-10"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="correo@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    ? <><RefreshCw className="size-4 spin" aria-hidden="true" /> Enviando…</>
                    : "Enviar enlace de recuperación"}
                </button>

                <div className="text-center">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf-700 transition hover:text-leaf-900">
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
