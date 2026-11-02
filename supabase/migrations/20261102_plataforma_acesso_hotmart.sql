-- Aplicada no projeto Supabase "JOVEM ADV" (tgosadjncwlbdcbiixsj) em 02/11/2026.
-- A chave do conteúdo (tabela chave_conteudo) foi inserida à parte e NÃO fica no repositório.

create table public.assinaturas (
  email              text primary key check (email = lower(email)),
  nome               text,
  status             text not null default 'ativa'
                     check (status in ('ativa','atrasada','cancelada','reembolsada','chargeback','expirada','cortesia')),
  acesso_ate         timestamptz,
  hotmart_transacao  text,
  hotmart_assinante  text,
  hotmart_produto    text,
  ultimo_evento      text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create table public.eventos_hotmart (
  id           text primary key,
  evento       text not null,
  email        text,
  payload      jsonb not null,
  recebido_em  timestamptz not null default now()
);

create table public.progresso (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);

create table public.chave_conteudo (
  versao  int primary key,
  chave   text not null,
  ativa   boolean not null default true
);

create schema if not exists privado;
grant usage on schema privado to authenticated;

create or replace function privado.tem_acesso()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assinaturas a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (a.status in ('ativa','cortesia')
           or (a.status = 'cancelada' and a.acesso_ate is not null and a.acesso_ate > now()))
  );
$$;
revoke execute on function privado.tem_acesso() from public, anon;
grant execute on function privado.tem_acesso() to authenticated;

alter table public.assinaturas     enable row level security;
alter table public.eventos_hotmart enable row level security;
alter table public.progresso       enable row level security;
alter table public.chave_conteudo  enable row level security;

create policy "aluno ve a propria assinatura" on public.assinaturas
  for select to authenticated using (email = lower((select auth.jwt()) ->> 'email'));
create policy "aluno le o proprio progresso" on public.progresso
  for select to authenticated using (user_id = (select auth.uid()));
create policy "aluno cria o proprio progresso" on public.progresso
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "aluno atualiza o proprio progresso" on public.progresso
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "assinante le a chave" on public.chave_conteudo
  for select to authenticated using (ativa and privado.tem_acesso());

grant select on public.assinaturas, public.chave_conteudo to authenticated;
grant select, insert, update on public.progresso to authenticated;
revoke all on public.assinaturas, public.eventos_hotmart, public.progresso, public.chave_conteudo from anon;
revoke all on public.eventos_hotmart from authenticated;

-- Ordem dos eventos: um evento mais antigo (creation_date) nunca sobrescreve um mais novo
alter table public.assinaturas add column if not exists evento_em timestamptz;
alter table public.eventos_hotmart add column if not exists resultado jsonb;

create or replace function public.aplicar_evento_hotmart(
  p_email text, p_status text, p_evento text, p_evento_em timestamptz,
  p_nome text, p_produto text, p_transacao text, p_assinante text,
  p_define_acesso boolean, p_acesso_ate timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  insert into public.assinaturas as a
    (email, nome, status, acesso_ate, hotmart_transacao, hotmart_assinante, hotmart_produto, ultimo_evento, evento_em, atualizado_em)
  values
    (p_email, p_nome, p_status, case when p_define_acesso then p_acesso_ate end, p_transacao, p_assinante, p_produto, p_evento, p_evento_em, now())
  on conflict (email) do update set
    status            = case when a.status = 'cortesia' then 'cortesia' else excluded.status end,
    acesso_ate        = case when p_define_acesso then p_acesso_ate else a.acesso_ate end,
    nome              = coalesce(excluded.nome, a.nome),
    hotmart_transacao = coalesce(excluded.hotmart_transacao, a.hotmart_transacao),
    hotmart_assinante = coalesce(excluded.hotmart_assinante, a.hotmart_assinante),
    hotmart_produto   = coalesce(excluded.hotmart_produto, a.hotmart_produto),
    ultimo_evento     = excluded.ultimo_evento,
    evento_em         = excluded.evento_em,
    atualizado_em     = now()
  where a.evento_em is null or excluded.evento_em >= a.evento_em
  returning a.status into r;
  return r;
end $$;
revoke execute on function public.aplicar_evento_hotmart(text,text,text,timestamptz,text,text,text,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.aplicar_evento_hotmart(text,text,text,timestamptz,text,text,text,text,boolean,timestamptz) to service_role;
