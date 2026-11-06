import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Field, Spinner, cx } from "../components/ui";
import { Logo } from "../layouts/AppLayout";
import { api, ApiError } from "../lib/api";
import { INVITE_RE, formatInvite } from "../lib/format";
import { isEmail, passwordStrength, required, useFormValidation, type Rules } from "../lib/validation";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" />
        <Link to="/" className="relative"><Logo light /></Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-4xl font-extrabold leading-tight tracking-tight">Finanças da casa, decididas juntos.</p>
          <ul className="mt-8 space-y-3 text-brand-100">
            {["Salários, contas fixas e parcelas num lugar só", "Limite do cartão sempre atualizado", "Previsão de quanto sobra nos próximos meses"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 size={18} className="text-white" /> {t}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <Link to="/" className="lg:hidden"><Logo /></Link>
        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx(
      "mb-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-medium",
      tone === "error" ? "bg-rose-50 text-rose-700 animate-[shake_.35s]" : "bg-brand-50 text-brand-800",
    )}>
      {tone === "error" ? <AlertCircle size={18} className="mt-px shrink-0" /> : <Info size={18} className="mt-px shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function PasswordInput(props: {
  value: string; onChange: (v: string) => void; autoComplete: string; name?: string; onBlur?: () => void; "aria-invalid"?: boolean;
}) {
  const [show, setShow] = useState(false);
  const { value, onChange, ...rest } = props;
  return (
    <div className="relative">
      <input {...rest} type={show ? "text" : "password"} className="field pr-11" value={value} maxLength={128}
        onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-faint hover:text-brand-700">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function withInvite(path: string, convite: string | null) {
  return convite ? `${path}?convite=${encodeURIComponent(convite)}` : path;
}

/* ---------------- Login ---------------- */
type LoginForm = { email: string; password: string };

export function Login() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState<LoginForm>({ email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const convite = params.get("convite");

  const rules = useMemo<Rules<LoginForm>>(() => ({
    email: (v) => required("Informe seu e-mail")(v) || (!isEmail(v) ? "E-mail inválido" : null),
    password: required("Informe sua senha"),
  }), []);
  const v = useFormValidation(f, rules);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!v.validate()) return;
    setPending(true);
    try {
      await api.post("/auth/login", { email: f.email.trim(), password: f.password });
      if (convite) {
        await api.post("/groups/join", { token: convite }).catch(() => undefined);
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/app");
    } catch (err) {
      if (!v.applyServerError(err)) setBanner(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="Bom te ver de novo 👋" subtitle={<>Não tem conta? <Link to={withInvite("/cadastro", convite)} className="font-bold text-brand-600 hover:underline">Criar conta grátis</Link></>}>
      {params.get("expirou") === "1" && !banner && <Banner tone="info">Sua sessão expirou. Entre novamente.</Banner>}
      {banner && <Banner tone="error">{banner}</Banner>}
      <form ref={v.formRef} noValidate onSubmit={submit} className="space-y-4">
        <Field label="E-mail" error={v.error("email")}>
          <input className="field" type="email" inputMode="email" autoComplete="email" autoFocus maxLength={160}
            {...v.bind("email")} value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} placeholder="voce@email.com" />
        </Field>
        <Field label="Senha" error={v.error("password")}>
          <PasswordInput autoComplete="current-password" {...v.bind("password")} value={f.password} onChange={(p) => setF((s) => ({ ...s, password: p }))} />
        </Field>
        <button type="submit" className="btn-primary w-full !py-3" disabled={pending}>
          {pending ? <><Spinner /> Entrando…</> : "Entrar"}
        </button>
      </form>
    </AuthShell>
  );
}

/* ---------------- Cadastro ---------------- */
type RegisterForm = { name: string; email: string; password: string; confirm: string; inviteToken: string };

export function Register() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState<RegisterForm>({
    name: "", email: "", password: "", confirm: "", inviteToken: formatInvite(params.get("convite") ?? ""),
  });
  const set = <K extends keyof RegisterForm>(k: K, val: RegisterForm[K]) => setF((s) => ({ ...s, [k]: val }));
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ token: string; state: "loading" | "ok" | "error"; text?: string } | null>(null);

  // Confere o convite assim que o código está completo.
  useEffect(() => {
    const token = f.inviteToken;
    if (!INVITE_RE.test(token)) {
      setInvite(null);
      return;
    }
    let alive = true;
    setInvite({ token, state: "loading" });
    api.get<{ groupName: string }>(`/invites/${token}`)
      .then((r) => alive && setInvite({ token, state: "ok", text: r.groupName }))
      .catch((e: Error) => alive && setInvite({ token, state: "error", text: e.message }));
    return () => {
      alive = false;
    };
  }, [f.inviteToken]);

  const rules = useMemo<Rules<RegisterForm>>(() => ({
    name: (val) => {
      const t = val.trim();
      if (!t) return "Informe seu nome";
      if (t.length < 2) return "Nome muito curto";
      if (t.length > 80) return "Máximo de 80 caracteres";
      return null;
    },
    email: (val) => required("Informe seu e-mail")(val) || (!isEmail(val) ? "E-mail inválido" : null),
    password: (val) => {
      if (!val) return "Crie uma senha";
      if (val.length < 8) return "Use ao menos 8 caracteres";
      if (!/[A-Za-z]/.test(val) || !/\d/.test(val)) return "Use letras e números";
      return null;
    },
    confirm: (val, all) => (!val ? "Repita a senha" : val !== all.password ? "As senhas não conferem" : null),
    inviteToken: (val) => (val && !INVITE_RE.test(val) ? "O código tem o formato ABCD-EFGH" : null),
  }), []);
  const v = useFormValidation(f, rules);
  const strength = passwordStrength(f.password);
  const inviteError = v.error("inviteToken") ?? (invite?.state === "error" ? invite.text : undefined);
  const emailError = v.error("email") ?? (emailTaken && emailTaken === f.email.trim().toLowerCase() ? "Já existe uma conta com esse e-mail" : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!v.validate()) return;
    if (invite?.state === "error") return;
    setPending(true);
    try {
      await api.post("/auth/register", {
        name: f.name.trim(), email: f.email.trim(), password: f.password, inviteToken: f.inviteToken || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/app");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setEmailTaken(f.email.trim().toLowerCase());
      else if (!v.applyServerError(err)) setBanner(err instanceof Error ? err.message : "Não foi possível criar a conta");
    } finally {
      setPending(false);
    }
  };

  const convite = f.inviteToken || params.get("convite");

  return (
    <AuthShell title="Criar sua conta" subtitle={<>Já tem conta? <Link to={withInvite("/entrar", convite)} className="font-bold text-brand-600 hover:underline">Entrar</Link></>}>
      {banner && <Banner tone="error">{banner}</Banner>}
      {invite?.state === "ok" && (
        <Banner tone="info">Você vai entrar no grupo <b>{invite.text}</b>.</Banner>
      )}
      <form ref={v.formRef} noValidate onSubmit={submit} className="space-y-4">
        <Field label="Seu nome" error={v.error("name")}>
          <input className="field" autoComplete="name" autoFocus maxLength={80} {...v.bind("name")} value={f.name}
            onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Alessandra Souza" />
        </Field>
        <Field label="E-mail" error={emailError}>
          <input className="field" type="email" inputMode="email" autoComplete="email" maxLength={160} {...v.bind("email")}
            aria-invalid={!!emailError || undefined} value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@email.com" />
        </Field>
        {emailError && emailTaken && (
          <p className="-mt-2 text-xs text-ink-soft">
            É você? <Link to={withInvite("/entrar", convite)} className="font-bold text-brand-600 hover:underline">Entre com essa conta</Link>
          </p>
        )}
        <Field label="Senha" error={v.error("password")}>
          <PasswordInput autoComplete="new-password" {...v.bind("password")} value={f.password} onChange={(p) => set("password", p)} />
        </Field>
        {f.password && (
          <div className="-mt-2" aria-live="polite">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className={cx("h-1.5 flex-1 rounded-full transition",
                  strength.score >= i ? ["", "bg-rose-500", "bg-amber-500", "bg-emerald-500"][strength.score] : "bg-brand-950/[0.08]")} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">Força: <b>{strength.label}</b> · mínimo 8 caracteres com letras e números</p>
          </div>
        )}
        <Field label="Confirmar senha" error={v.error("confirm")}>
          <PasswordInput autoComplete="new-password" {...v.bind("confirm")} value={f.confirm} onChange={(p) => set("confirm", p)} />
        </Field>
        <Field label="Código de convite" optional error={inviteError}
          hint="Recebeu um código de quem já usa? Cole aqui para entrar no mesmo grupo.">
          <div className="relative">
            <input className="field font-mono uppercase tracking-widest" autoComplete="off" maxLength={9} placeholder="ABCD-EFGH"
              {...v.bind("inviteToken")} aria-invalid={!!inviteError || undefined}
              value={f.inviteToken} onChange={(e) => set("inviteToken", formatInvite(e.target.value))} />
            {invite?.state === "loading" && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></span>}
            {invite?.state === "ok" && <CheckCircle2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />}
          </div>
        </Field>
        <button type="submit" className="btn-primary w-full !py-3" disabled={pending || invite?.state === "loading"}>
          {pending ? <><Spinner /> Criando conta…</> : "Criar conta"}
        </button>
      </form>
    </AuthShell>
  );
}
