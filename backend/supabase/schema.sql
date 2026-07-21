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

-- ── Reminders ─────────────────────────────────────────────────────────────────
-- Parent-configured reminders, delivered to the child device by polling.
create table if not exists reminders (
    id                uuid primary key default gen_random_uuid(),
    child_device_id   text not null references devices(device_id) on delete cascade,
    label             text not null,
    time              text not null,
    days_of_week      jsonb not null default '[]'::jsonb,
    active            boolean not null default true,
    created_at        timestamptz not null default now()
);
create index if not exists idx_reminders_device on reminders(child_device_id);

-- ── Bedtime schedule ──────────────────────────────────────────────────────────
-- Schedule storage only — no child-side lock/enforcement yet.
create table if not exists bedtime_schedules (
    child_device_id   text primary key references devices(device_id) on delete cascade,
    start_time        text not null,
    end_time          text not null,
    enabled           boolean not null default true,
    updated_at        timestamptz not null default now()
);

-- ── AI box usage events ───────────────────────────────────────────────────────
-- One row per voice interaction; the dashboard's weekly chart buckets these by
-- day and estimates hours from the interaction count.
create table if not exists usage_events (
    id                bigint generated always as identity primary key,
    child_device_id   text references devices(device_id) on delete cascade,
    created_at        timestamptz not null default now()
);
create index if not exists idx_usage_events_device
    on usage_events(child_device_id, created_at);

-- ── Call signaling (HTTP polling) ─────────────────────────────────────────────
-- Backs /call/{room_id}/signal and /call/{room_id}/poll — replaces the old
-- persistent-WebSocket signaling for actual call ring/accept/offer/answer/
-- ice-candidate exchange, which was prone to silently dropping mid-message
-- on some networks. See routes/call_signal.py.
create table if not exists call_signals (
    id          bigint generated always as identity primary key,
    room_id     text not null,
    role        text not null check (role in ('child', 'parent')),
    type        text not null,
    payload     jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists idx_call_signals_room on call_signals(room_id, id);

-- One row per (room, role) — last_seen_at refreshed on every poll, which
-- doubles as that side's heartbeat (see PRESENCE_FRESH_SECONDS).
create table if not exists call_presence (
    room_id       text not null,
    role          text not null check (role in ('child', 'parent')),
    last_seen_at  timestamptz not null default now(),
    primary key (room_id, role)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Every client (parent app, child app) talks to this backend's own REST API,
-- never to Supabase directly — the backend (using SUPABASE_SERVICE_KEY) is the
-- only thing that ever touches this database. RLS has no client to protect
-- against here, and Supabase's dashboard auto-enables it with zero policies
-- the first time a table is opened in the Table Editor, which silently blocks
-- every write (including the backend's own). Keep it off on every app table.
alter table devices             disable row level security;
alter table pairing_codes       disable row level security;
alter table pairings            disable row level security;
alter table call_logs           disable row level security;
alter table memory_messages     disable row level security;
alter table session_facts       disable row level security;
alter table reminders           disable row level security;
alter table bedtime_schedules   disable row level security;
alter table usage_events        disable row level security;
alter table call_signals        disable row level security;
alter table call_presence       disable row level security;
