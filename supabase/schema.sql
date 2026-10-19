-- =====================================================================
--  Dönerliste – Datenbankschema für Supabase
--
--  Supabase-Dashboard -> SQL Editor -> New query -> alles einfügen -> Run.
--  Kann gefahrlos mehrmals ausgeführt werden.
--
--  Wer darf was (Row Level Security):
--    Profile      lesen: alle         ändern: nur das eigene (Rolle nur durch Admins), Profilbild im eigenen Ordner
--    Kriterien    lesen: alle         anlegen/ändern: Admins
--    Läden        lesen: alle         anlegen/ändern/löschen: Admins
--    Bewertungen  lesen: alle         anlegen/ändern/löschen: nur die eigene (1 pro Laden)
--                                     löschen zusätzlich: Admins (Moderation)
--    Vorschläge   lesen: eigene + Admins   anlegen: eingeloggte Nutzer   bearbeiten: Admins
--    Fotos        lesen: alle         Titelfoto: Admins   Community-Fotos: jeder eingeloggte Nutzer
--                                     (max. 5 pro Laden), löschen: eigene + Admins
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Profile (1:1 zu auth.users, wird beim Registrieren automatisch angelegt)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null check (username ~ '^[A-Za-z0-9_.]{3,24}$'),
  display_name text check (char_length(display_name) <= 40),
  bio          text check (char_length(bio) <= 500),
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text;
  base text;
  candidate text;
  display text;
  n int := 1;
begin
  -- Registrierung per Formular: Nutzername kommt mit
  wanted := nullif(trim(meta ->> 'username'), '');
  -- Google & Co.: Name aus dem Google-Konto
  display := coalesce(nullif(trim(meta ->> 'full_name'), ''), nullif(trim(meta ->> 'name'), ''), wanted);

  if wanted is not null then
    candidate := wanted;
  else
    -- Aus "Max Müller" / max.mueller@gmail.com einen gültigen, freien Nutzernamen bauen
    base := coalesce(meta ->> 'full_name', meta ->> 'name', split_part(coalesce(new.email, ''), '@', 1), '');
    base := translate(lower(base), 'äöüß ', 'aous_');
    base := left(regexp_replace(base, '[^a-z0-9_.]', '', 'g'), 20);
    if char_length(base) < 3 then
      base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 6);
    end if;
    candidate := base;
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      n := n + 1;
      candidate := base || n;
    end loop;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, left(display, 40));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rolle ändern dürfen über die API nur Admins. Im SQL-Editor (auth.uid() ist
-- dort leer) geht es immer – so wird der erste Admin gemacht, siehe README.
create or replace function public.protect_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Nur Admins dürfen Rollen ändern';
  end if;
  return new;
end $$;

drop trigger if exists protect_role on public.profiles;
create trigger protect_role
  before update on public.profiles
  for each row execute function public.protect_role();

-- ---------------------------------------------------------------------
--  Kriterien (erweiterbar, ohne Code zu ändern)
-- ---------------------------------------------------------------------
create table if not exists public.criteria (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  label       text not null,
  description text,
  sort_order  int not null default 0,
  active      boolean not null default true
);

insert into public.criteria (key, label, description, sort_order) values
  ('preis',   'Preis',   'Was bekommt man fürs Geld?',                 1),
  ('auswahl', 'Auswahl', 'Fleisch, Brot, Beilagen, Extras',            2),
  ('sosse',   'Soße(n)', 'Geschmack, Menge, selbstgemacht oder Eimer', 3),
  ('fleisch', 'Fleisch', 'Qualität, Würzung, saftig oder trocken',     4)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
--  Läden
-- ---------------------------------------------------------------------
create table if not exists public.shops (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null check (char_length(name) between 1 and 80),
  address      text not null,
  district     text,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  maps_url     text not null check (maps_url ~* '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)'),
  doener_price numeric(5, 2) check (doener_price > 0),
  notes        text check (char_length(notes) <= 300),
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
--  Bewertungen: eine pro Nutzer und Laden, später änderbar
--  scores = {"preis": 8, "auswahl": 7.5, "sosse": 9, "fleisch": 8}
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  scores     jsonb not null,
  fazit      text check (char_length(fazit) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);
create index if not exists ratings_user on public.ratings (user_id);

create or replace function public.validate_rating()
returns trigger language plpgsql set search_path = public as $$
declare
  k text;
  v jsonb;
  n numeric;
begin
  if jsonb_typeof(new.scores) <> 'object' or new.scores = '{}'::jsonb then
    raise exception 'Bewertung ist leer';
  end if;
  for k, v in select * from jsonb_each(new.scores) loop
    if not exists (select 1 from public.criteria c where c.key = k) then
      raise exception 'Unbekanntes Kriterium: %', k;
    end if;
    if jsonb_typeof(v) <> 'number' then
      raise exception 'Wert für % ist keine Zahl', k;
    end if;
    n := (v #>> '{}')::numeric;
    if n < 1 or n > 10 or mod(n * 2, 1) <> 0 then
      raise exception 'Wert für % muss zwischen 1 und 10 liegen (halbe Punkte erlaubt)', k;
    end if;
  end loop;
  if tg_op = 'INSERT' then
    -- Über die API gibt's kein Rückdatieren; im SQL-Editor (Seed) schon
    if auth.uid() is not null then
      new.created_at := now();
    end if;
    new.updated_at := new.created_at;
  else
    new.created_at := old.created_at;
    new.user_id := old.user_id;
    new.shop_id := old.shop_id;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists ratings_validate on public.ratings;
create trigger ratings_validate before insert or update on public.ratings
  for each row execute function public.validate_rating();

-- ---------------------------------------------------------------------
--  Vorschläge für neue Läden
-- ---------------------------------------------------------------------
create table if not exists public.suggestions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  address      text check (char_length(address) <= 160),
  maps_url     text check (char_length(maps_url) <= 500),
  note         text check (char_length(note) <= 1000),
  suggested_by uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note   text check (char_length(admin_note) <= 500),
  shop_id      uuid references public.shops (id) on delete set null,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (address is not null or maps_url is not null)
);

-- Vorschläge dürfen nur echte Google-Maps-Links enthalten (werden im Admin anklickbar angezeigt)
alter table public.suggestions drop constraint if exists suggestions_maps_url_google;
alter table public.suggestions add constraint suggestions_maps_url_google check (
  maps_url is null
  or maps_url ~* '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)'
);

-- ---------------------------------------------------------------------
--  Spam-Schutz (Rate-Limits) – greift auch, wenn jemand die Webseite
--  umgeht und die Supabase-API direkt anspricht
-- ---------------------------------------------------------------------
create or replace function public.limit_rating_writes()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (
    select count(*) from public.ratings
    where user_id = auth.uid() and updated_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'Zu viele Bewertungen in kurzer Zeit. Bitte warte ein paar Minuten.';
  end if;
  return new;
end $$;

drop trigger if exists ratings_limit on public.ratings;
create trigger ratings_limit before insert or update on public.ratings
  for each row execute function public.limit_rating_writes();

create or replace function public.limit_suggestions()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if (select count(*) from public.suggestions
        where suggested_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Maximal 5 Vorschläge pro Tag. Morgen geht wieder was.';
    end if;
    if (select count(*) from public.suggestions
        where suggested_by = auth.uid() and status = 'pending') >= 10 then
      raise exception 'Du hast schon 10 offene Vorschläge. Warte, bis die bearbeitet sind.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists suggestions_limit on public.suggestions;
create trigger suggestions_limit before insert on public.suggestions
  for each row execute function public.limit_suggestions();

-- ---------------------------------------------------------------------
--  Rechte
-- ---------------------------------------------------------------------
-- Supabase vergibt standardmäßig alle Rechte an anon/authenticated. Wir setzen
-- erst alles zurück und geben dann nur frei, was gebraucht wird – RLS
-- (weiter unten) schränkt zusätzlich auf einzelne Zeilen ein.
revoke all on public.profiles, public.criteria, public.shops, public.ratings, public.suggestions from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.criteria, public.shops, public.ratings to anon, authenticated;
-- Nutzer dürfen nur Anzeigename und Bio ändern (Rolle schützt zusätzlich der Trigger protect_role)
grant update (display_name, bio, role) on public.profiles to authenticated;
grant insert, update, delete on public.criteria, public.shops, public.ratings to authenticated;
grant select, insert, update, delete on public.suggestions to authenticated;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
-- Trigger-Funktionen sind nicht direkt aufrufbar
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles    enable row level security;
alter table public.criteria    enable row level security;
alter table public.shops       enable row level security;
alter table public.ratings     enable row level security;
alter table public.suggestions enable row level security;

-- Profile
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- Kriterien
drop policy if exists "criteria_select" on public.criteria;
drop policy if exists "criteria_admin" on public.criteria;
create policy "criteria_select" on public.criteria for select using (true);
create policy "criteria_admin" on public.criteria for all
  using (public.is_admin()) with check (public.is_admin());

-- Läden
drop policy if exists "shops_select" on public.shops;
drop policy if exists "shops_admin" on public.shops;
create policy "shops_select" on public.shops for select using (true);
create policy "shops_admin" on public.shops for all
  using (public.is_admin()) with check (public.is_admin());

-- Bewertungen
drop policy if exists "ratings_select" on public.ratings;
drop policy if exists "ratings_insert_own" on public.ratings;
drop policy if exists "ratings_update_own" on public.ratings;
drop policy if exists "ratings_delete_own_or_admin" on public.ratings;
create policy "ratings_select" on public.ratings for select using (true);
create policy "ratings_insert_own" on public.ratings for insert
  with check (auth.uid() = user_id);
create policy "ratings_update_own" on public.ratings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ratings_delete_own_or_admin" on public.ratings for delete
  using (auth.uid() = user_id or public.is_admin());

-- Vorschläge
drop policy if exists "suggestions_select" on public.suggestions;
drop policy if exists "suggestions_insert" on public.suggestions;
drop policy if exists "suggestions_update_admin" on public.suggestions;
drop policy if exists "suggestions_delete" on public.suggestions;
create policy "suggestions_select" on public.suggestions for select
  using (suggested_by = auth.uid() or public.is_admin());
create policy "suggestions_insert" on public.suggestions for insert
  with check (
    suggested_by = auth.uid()
    and status = 'pending'
    and admin_note is null and shop_id is null and reviewed_by is null and reviewed_at is null
  );
create policy "suggestions_update_admin" on public.suggestions for update
  using (public.is_admin()) with check (public.is_admin());
create policy "suggestions_delete" on public.suggestions for delete
  using (public.is_admin() or (suggested_by = auth.uid() and status = 'pending'));


-- ---------------------------------------------------------------------
--  Fotos: öffentlicher Storage-Bucket 'shop-images'
--  Die Fotos werden schon im Browser verkleinert (max. 900 px, JPEG).
--    <shop_id>/…                         Titelfoto, nur Admins (shops.image_url)
--    community/<shop_id>/<user_id>/…     Community-Fotos, jeder eingeloggte
--                                        Nutzer in seinen eigenen Ordner
--  Lesen: alle (öffentliche URL)
-- ---------------------------------------------------------------------
alter table public.shops add column if not exists image_url text check (char_length(image_url) <= 500);

create table if not exists public.shop_photos (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  path       text not null unique check (char_length(path) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists shop_photos_shop on public.shop_photos (shop_id, created_at desc);

-- Spam-Schutz: max. 5 Fotos pro Nutzer und Laden, max. 30 pro Tag
create or replace function public.limit_shop_photos()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if (select count(*) from public.shop_photos where user_id = auth.uid() and shop_id = new.shop_id) >= 5 then
      raise exception 'Maximal 5 Fotos pro Laden. Lösch erst ein altes.';
    end if;
    if (select count(*) from public.shop_photos
        where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
      raise exception 'Zu viele Fotos heute. Morgen geht wieder was.';
    end if;
    new.created_at := now();
  end if;
  return new;
end $$;

drop trigger if exists shop_photos_limit on public.shop_photos;
create trigger shop_photos_limit before insert on public.shop_photos
  for each row execute function public.limit_shop_photos();

revoke all on public.shop_photos from anon, authenticated;
grant select on public.shop_photos to anon, authenticated;
grant insert, delete on public.shop_photos to authenticated;
alter table public.shop_photos enable row level security;

drop policy if exists "shop_photos_select" on public.shop_photos;
drop policy if exists "shop_photos_insert_own" on public.shop_photos;
drop policy if exists "shop_photos_delete_own_or_admin" on public.shop_photos;
create policy "shop_photos_select" on public.shop_photos for select using (true);
-- Nur in den eigenen Ordner, und nur für diesen Laden
create policy "shop_photos_insert_own" on public.shop_photos for insert
  with check (user_id = auth.uid() and path like 'community/' || shop_id || '/' || auth.uid() || '/%.jpg');
create policy "shop_photos_delete_own_or_admin" on public.shop_photos for delete
  using (user_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-images', 'shop-images', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop_images_admin_insert" on storage.objects;
drop policy if exists "shop_images_admin_update" on storage.objects;
drop policy if exists "shop_images_admin_delete" on storage.objects;
drop policy if exists "shop_images_admin_select" on storage.objects;
drop policy if exists "shop_images_select" on storage.objects;
drop policy if exists "shop_images_insert" on storage.objects;
drop policy if exists "shop_images_update" on storage.objects;
drop policy if exists "shop_images_delete" on storage.objects;
-- Öffentliche Bucket-URLs brauchen keine Select-Policy; die hier ist fürs Auflisten/Löschen
create policy "shop_images_select" on storage.objects for select to authenticated
  using (bucket_id = 'shop-images' and (public.is_admin() or (storage.foldername(name))[3] = auth.uid()::text));
-- Admins überall; Nutzer nur in den eigenen Community-Ordner und nur, wenn es dazu
-- schon eine Zeile in shop_photos gibt (dort greifen die Limits)
create policy "shop_images_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-images' and (
      public.is_admin()
      or exists (select 1 from public.shop_photos p where p.path = name and p.user_id = auth.uid())
    )
  );
create policy "shop_images_update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-images' and public.is_admin()) with check (bucket_id = 'shop-images' and public.is_admin());
create policy "shop_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'shop-images' and (
      public.is_admin()
      or ((storage.foldername(name))[1] = 'community' and (storage.foldername(name))[3] = auth.uid()::text)
    )
  );

-- ---------------------------------------------------------------------
--  Profilbilder: öffentlicher Bucket 'avatars', Ordner = eigene user_id
--  In profiles steht nur der Pfad; der Check sorgt dafür, dass jeder nur
--  auf Dateien in seinem eigenen Ordner zeigen kann.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_own;
alter table public.profiles add constraint profiles_avatar_path_own
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9]+\.jpg$'));
grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
-- Lesen geht über die öffentliche URL; die Select-Policy braucht es fürs Auflisten alter Bilder
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- Admins dürfen zur Moderation auch fremde Bilder löschen
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
