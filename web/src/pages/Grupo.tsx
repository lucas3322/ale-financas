import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Crown, LogIn, Plus, Share2, Trash2, UserMinus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Empty, Field, Modal, MoneyInput, PageHeader, PageLoading, cx, useToast } from "../components/ui";
import { api } from "../lib/api";
import { INVITE_RE, formatInvite, money } from "../lib/format";
import { useAction, useMe } from "../lib/queries";
import { MAX_CENTS, useFormValidation, type Rules } from "../lib/validation";

type Invite = { id: string; token: string; expiresAt: string; createdAt: string };
function Section({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function useCopy() {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (text: string, what = "Copiado!") => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(text);
        toast(what);
        setTimeout(() => setCopied(null), 1800);
      } catch {
        toast("Não foi possível copiar", "error");
      }
    },
  };
}

export default function Grupo() {
  const { data: me } = useMe();
  if (!me?.activeGroup) return <PageLoading />;
  const isOwner = me.activeGroup.role === "OWNER";

  return (
    <>
      <PageHeader title="Grupo" subtitle="Quem compartilha as finanças com você e como convidar mais gente." />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <GroupSettings key={me.activeGroup.id} isOwner={isOwner} />
          <Members isOwner={isOwner} />
        </div>
        <div className="space-y-5">
          <Invites />
          <MyGroups />
        </div>
      </div>
    </>
  );
}

/* ---------- Nome + saldo inicial ---------- */
type SettingsForm = { name: string; initialBalanceCents: number };

function GroupSettings({ isOwner }: { isOwner: boolean }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const g = me!.activeGroup!;
  const [f, setF] = useState<SettingsForm>({ name: g.name, initialBalanceCents: g.initialBalanceCents });
  const rules = useMemo<Rules<SettingsForm>>(() => ({
    name: (v) => (!v.trim() ? "Dê um nome ao grupo" : v.trim().length < 2 ? "Nome muito curto" : v.length > 60 ? "Máximo de 60 caracteres" : null),
    initialBalanceCents: (v) => (Math.abs(v) > MAX_CENTS ? "Valor alto demais" : null),
  }), []);
  const v = useFormValidation(f, rules);
  const dirty = f.name.trim() !== g.name || f.initialBalanceCents !== g.initialBalanceCents;

  const save = useAction(
    () => api.patch("/group", isOwner ? { name: f.name.trim(), initialBalanceCents: f.initialBalanceCents } : { initialBalanceCents: f.initialBalanceCents }),
    "Grupo atualizado",
    () => qc.invalidateQueries({ queryKey: ["me"] }),
    v.applyServerError,
  );

  return (
    <Section title="Dados do grupo">
      <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) save.mutate(undefined); }}>
        <Field label="Nome do grupo" error={v.error("name")} hint={!isOwner ? "Só o dono do grupo pode renomear." : undefined}>
          <input className="field" maxLength={60} disabled={!isOwner} {...v.bind("name")} value={f.name}
            onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
        </Field>
        <Field label="Saldo inicial" error={v.error("initialBalanceCents")}
          hint="Quanto vocês têm hoje guardado — a previsão parte daqui.">
          <MoneyInput {...v.bind("initialBalanceCents")} value={f.initialBalanceCents}
            onChange={(c) => setF((s) => ({ ...s, initialBalanceCents: c }))} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!dirty || save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Section>
  );
}

/* ---------- Membros ---------- */
function Members({ isOwner }: { isOwner: boolean }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const members = me!.members;

  const remove = useAction(
    (userId: string) => api.del(`/group/members/${userId}`),
    undefined,
    async () => {
      await qc.resetQueries();
    },
  );
  const setRole = useAction(
    ({ userId, role }: { userId: string; role: "OWNER" | "MEMBER" }) => api.patch(`/group/members/${userId}`, { role }),
    "Papel atualizado",
    () => qc.invalidateQueries({ queryKey: ["me"] }),
  );

  const leave = () => {
    if (!confirm(`Sair do grupo "${me!.activeGroup!.name}"? Você deixa de ver as finanças dele.`)) return;
    remove.mutate(me!.user.id, { onSuccess: () => nav("/app") });
  };

  return (
    <Section title={`Membros (${members.length})`}>
      <ul className="divide-y divide-brand-950/[0.06]">
        {members.map((m) => {
          const isMe = m.id === me!.user.id;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar name={m.name} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{m.name}{isMe && <span className="font-normal text-ink-faint"> (você)</span>}</p>
                <p className="truncate text-xs text-ink-faint">{m.email}</p>
              </div>
              <span className={cx("chip", m.role === "OWNER" ? "bg-brand-50 text-brand-700" : "bg-brand-950/[0.05] text-ink-soft")}>
                {m.role === "OWNER" ? <><Crown size={11} /> Dono</> : "Membro"}
              </span>
              {isOwner && !isMe && (
                <div className="flex">
                  <button className="btn-ghost !p-2" title={m.role === "OWNER" ? "Tornar membro" : "Tornar dono"}
                    aria-label={m.role === "OWNER" ? `Tornar ${m.name} membro` : `Tornar ${m.name} dono`}
                    disabled={setRole.isPending}
                    onClick={() => setRole.mutate({ userId: m.id, role: m.role === "OWNER" ? "MEMBER" : "OWNER" })}>
                    <Crown size={16} />
                  </button>
                  <button className="btn-danger !p-2" aria-label={`Remover ${m.name}`} title="Remover do grupo" disabled={remove.isPending}
                    onClick={() => confirm(`Remover ${m.name} do grupo?`) && remove.mutate(m.id, { onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) })}>
                    <UserMinus size={16} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {me!.members.length > 1 && (
        <div className="mt-4 border-t border-brand-950/[0.06] pt-4">
          <button className="btn-danger !px-3" onClick={leave} disabled={remove.isPending}>Sair do grupo</button>
        </div>
      )}
    </Section>
  );
}

/* ---------- Convites ---------- */
function Invites() {
  const invites = useQuery({ queryKey: ["invites"], queryFn: () => api.get<Invite[]>("/group/invites") });
  const { copy, copied } = useCopy();
  const [fresh, setFresh] = useState<Invite | null>(null);

  const create = useAction(() => api.post<Invite>("/group/invites"), "Código gerado", (inv) => setFresh(inv));
  const revoke = useAction((id: string) => api.del(`/group/invites/${id}`), "Convite cancelado", () => setFresh(null));

  const link = (t: string) => `${location.origin}/cadastro?convite=${t}`;
  const share = async (t: string) => {
    const text = `Entre no nosso grupo do Nosso Caixa com o código ${t}`;
    if (navigator.share) {
      await navigator.share({ title: "Nosso Caixa", text, url: link(t) }).catch(() => undefined);
    } else {
      copy(`${text}: ${link(t)}`, "Mensagem copiada");
    }
  };

  return (
    <Section title="Convidar pessoas" subtitle="Gere um código e mande para quem vai dividir as finanças. Vale por 7 dias e para uma pessoa.">
      {fresh ? (
        <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">Código de convite</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="whitespace-nowrap font-mono text-2xl font-extrabold tracking-[.12em] sm:text-3xl sm:tracking-[.2em]">{fresh.token}</p>
            <button className="btn bg-white/15 !p-2.5 text-white hover:bg-white/25" aria-label="Copiar código" onClick={() => copy(fresh.token, "Código copiado")}>
              {copied === fresh.token ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <p className="mt-3 break-all rounded-lg bg-white/10 px-3 py-2 text-xs">{link(fresh.token)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn bg-white text-brand-700 hover:bg-brand-50" onClick={() => copy(link(fresh.token), "Link copiado")}>
              <Copy size={16} /> Copiar link
            </button>
            <button className="btn bg-white/15 text-white hover:bg-white/25" onClick={() => share(fresh.token)}>
              <Share2 size={16} /> Compartilhar
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => create.mutate(undefined)} disabled={create.isPending}>
          <Plus size={18} /> {create.isPending ? "Gerando…" : "Gerar código de convite"}
        </button>
      )}

      {invites.data && invites.data.length > 0 && (
        <div className="mt-5">
          <p className="label">Convites ativos</p>
          <ul className="space-y-2">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-xl border border-brand-950/[0.08] px-3 py-2">
                <span className="font-mono text-sm font-bold tracking-wider">{i.token}</span>
                <span className="flex-1 text-xs text-ink-faint">expira {new Date(i.expiresAt).toLocaleDateString("pt-BR")}</span>
                <button className="btn-ghost !p-2" aria-label={`Copiar link do convite ${i.token}`} onClick={() => copy(link(i.token), "Link copiado")}>
                  {copied === link(i.token) ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button className="btn-danger !p-2" aria-label={`Cancelar convite ${i.token}`} disabled={revoke.isPending}
                  onClick={() => confirm("Cancelar este convite? O código deixa de funcionar.") && revoke.mutate(i.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/* ---------- Meus grupos / entrar / criar ---------- */
type JoinForm = { token: string };
type NewGroupForm = { name: string };

function MyGroups() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [join, setJoin] = useState<JoinForm>({ token: "" });
  const [creating, setCreating] = useState(false);

  const joinRules = useMemo<Rules<JoinForm>>(() => ({
    token: (v) => (!v ? "Cole o código que você recebeu" : !INVITE_RE.test(v) ? "O código tem o formato ABCD-EFGH" : null),
  }), []);
  const jv = useFormValidation(join, joinRules);

  const after = async () => {
    await qc.resetQueries();
    nav("/app");
  };
  const doJoin = useAction(() => api.post("/groups/join", { token: join.token }), "Você entrou no grupo! 🎉", after, jv.applyServerError);
  const doSwitch = useAction((groupId: string) => api.post("/groups/switch", { groupId }), "Grupo trocado", after);

  return (
    <Section title="Seus grupos" subtitle="Você pode participar de mais de um grupo e alternar entre eles."
      actions={<button className="btn-outline !px-3 !py-2" onClick={() => setCreating(true)}><Plus size={16} /> Novo grupo</button>}>
      {me!.groups.length === 0 ? (
        <Empty icon="👥" title="Nenhum grupo" />
      ) : (
        <ul className="space-y-2">
          {me!.groups.map((g) => {
            const active = g.id === me!.activeGroup?.id;
            return (
              <li key={g.id} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5",
                active ? "border-brand-300 bg-brand-50/60" : "border-brand-950/[0.08]")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{g.name}</p>
                  <p className="text-xs text-ink-faint">{g.role === "OWNER" ? "Dono" : "Membro"}</p>
                </div>
                {active ? (
                  <span className="chip bg-brand-600 text-white">Ativo</span>
                ) : (
                  <button className="btn-outline !px-3 !py-1.5 !text-xs" disabled={doSwitch.isPending} onClick={() => doSwitch.mutate(g.id)}>
                    Usar este
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form ref={jv.formRef} noValidate className="mt-5 border-t border-brand-950/[0.06] pt-5"
        onSubmit={(e) => { e.preventDefault(); if (jv.validate()) doJoin.mutate(undefined); }}>
        <Field label="Entrar em outro grupo" error={jv.error("token")} hint="Cole o código de convite que alguém te mandou.">
          <div className="flex gap-2">
            <input className="field font-mono uppercase tracking-widest" placeholder="ABCD-EFGH" maxLength={9} autoComplete="off"
              {...jv.bind("token")} value={join.token} onChange={(e) => setJoin({ token: formatInvite(e.target.value) })} />
            <button type="submit" className="btn-primary shrink-0" disabled={doJoin.isPending}>
              <LogIn size={16} /> {doJoin.isPending ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </Field>
      </form>

      <NewGroupModal open={creating} onClose={() => setCreating(false)} onCreated={after} />
      {me!.activeGroup && (
        <p className="mt-4 text-xs text-ink-faint">
          Saldo inicial do grupo ativo: <b className="tabular">{money(me!.activeGroup.initialBalanceCents)}</b>
        </p>
      )}
    </Section>
  );
}

function NewGroupModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Criar novo grupo">
      {open && <NewGroupForm onDone={() => { onClose(); onCreated(); }} />}
    </Modal>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState<NewGroupForm>({ name: "" });
  const rules = useMemo<Rules<NewGroupForm>>(() => ({
    name: (v) => (!v.trim() ? "Dê um nome ao grupo" : v.trim().length < 2 ? "Nome muito curto" : v.length > 60 ? "Máximo de 60 caracteres" : null),
  }), []);
  const v = useFormValidation(f, rules);
  const create = useAction(() => api.post("/groups", { name: f.name.trim() }), "Grupo criado", onDone, v.applyServerError);
  return (
    <form ref={v.formRef} noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (v.validate()) create.mutate(undefined); }}>
      <Field label="Nome do grupo" error={v.error("name")} hint="Ex.: Casa, Viagem 2027, Pais. Você será o dono.">
        <input className="field" autoFocus maxLength={60} {...v.bind("name")} value={f.name} onChange={(e) => setF({ name: e.target.value })} />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={create.isPending}>{create.isPending ? "Salvando…" : "Criar grupo"}</button>
    </form>
  );
}
