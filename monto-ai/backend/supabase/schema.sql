-- Monto AI — Supabase schema
-- Run this once in the Supabase project's SQL editor (Dashboard → SQL Editor → New query).
-- Replaces: monto_memory.db (SQLite) + localStorage-only pairing.

-- ── Devices ────────────────────────────────────────────────────────────────
-- Every child box and parent phone that has ever launched the app.
create table if not exists devices (
    device_id     text primary key,
    role          text not null check (role in ('child', 'parent')),
    label         text,
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz not null default now()
);

-- ── Pairing codes ────────────────────────────────────────────────────────────
-- Short-lived code a child device generates (shown as a QR); a parent redeems
-- it once to link its device. The code carries connection info so the parent
-- never needs to read raw TURN credentials off the QR image itself.
create table if not exists pairing_codes (
    code                  text primary key,
    child_device_id       text not null references devices(device_id) on delete cascade,
    api_url               text not null,
    turn_url              text,
    turn_username         text,
    turn_password         text,
    created_at            timestamptz not null default now(),
    expires_at            timestamptz not null,
    redeemed_at           timestamptz,
    redeemed_by_device_id text references devices(device_id)
);

-- ── Pairings ─────────────────────────────────────────────────────────────────
-- Durable child <-> parent relationship. A child can have more than one
-- paired parent device (e.g. mum's phone + dad's phone).
create table if not exists pairings (
    id                uuid primary key default gen_random_uuid(),
    child_device_id   text not null references devices(device_id) on delete cascade,
    parent_device_id  text not null references devices(device_id) on delete cascade,
    paired_at         timestamptz not null default now(),
    unique (child_device_id, parent_device_id)
);

-- ── Call history ─────────────────────────────────────────────────────────────
create table if not exists call_logs (
    id                uuid primary key default gen_random_uuid(),
    child_device_id   text not null references devices(device_id) on delete cascade,
    parent_device_id  text references devices(device_id),
    started_at        timestamptz not null default now(),
    ended_at          timestamptz,
    duration_seconds  integer,
    status            text not null default 'ringing'
                       check (status in ('ringing', 'connected', 'missed', 'rejected', 'ended'))
);

-- ── Conversation memory (replaces monto_memory.db) ───────────────────────────
create table if not exists memory_messages (
    id               bigint generated always as identity primary key,
    session_id       text not null,
    role             text not null check (role in ('user', 'assistant')),
    content          text not null,
    created_at       timestamptz not null default now()
);
create index if not exists idx_memory_messages_session
    on memory_messages(session_id, created_at);

create table if not exists session_facts (
    session_id   text primary key,
    facts        jsonb not null default '{}'::jsonb,
    updated_at   timestamptz not null default now()
);

-- Prune old messages so a session table doesn't grow unbounded (mirrors the
-- MAX_STORED_MESSAGES=500 cap the old SQLite service enforced).
create or replace function prune_session_messages() returns trigger as $$
begin
    delete from memory_messages
    where session_id = new.session_id
      and id not in (
          select id from memory_messages
          where session_id = new.session_id
          order by created_at desc
          limit 500
      );
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prune_session_messages on memory_messages;
create trigger trg_prune_session_messages
    after insert on memory_messages
    for each row execute function prune_session_messages();
