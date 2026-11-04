-- =====================================================================
--  KejaLink: SCRIPT 2 of 3: lock down the tables and create photo storage
--  Run AFTER 01_schema.sql.
--
--  WHY ROW LEVEL SECURITY (RLS)?
--  Supabase automatically publishes every table in the "public" schema
--  through its REST API, and the "anon" key used by browsers can call it.
--  KejaLink's browser code never talks to the database directly: all data
--  goes through our Express backend, which connects with the database
--  password (postgres role) and bypasses RLS.
--  So we switch RLS ON and add NO policies: the public API gets nothing,
--  and only our backend can read or write.
-- =====================================================================

alter table users            enable row level security;
alter table agent_profiles   enable row level security;
alter table properties       enable row level security;
alter table property_images  enable row level security;
alter table favourites       enable row level security;
alter table inquiries        enable row level security;
alter table viewings         enable row level security;
alter table admin_actions    enable row level security;
alter table audit_logs       enable row level security;
alter table payments         enable row level security;
alter table notifications    enable row level security;
alter table listing_reports  enable row level security;

-- ---------------------------------------------------------------------
-- Photo storage: a public bucket for listing photos.
-- Anyone can VIEW a photo by its URL; only the backend (service role key)
-- can upload or delete. Limit: 3 MB, JPG/PNG/WebP only.
-- The IF check lets this file also run on a plain PostgreSQL (no Supabase).
-- ---------------------------------------------------------------------
do $$
begin
    if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values ('property-images', 'property-images', true, 3145728,
                array['image/jpeg', 'image/png', 'image/webp'])
        on conflict (id) do update
            set public = excluded.public,
                file_size_limit = excluded.file_size_limit,
                allowed_mime_types = excluded.allowed_mime_types;
        raise notice 'Storage bucket "property-images" is ready.';
    else
        raise notice 'No storage schema (not Supabase): skipped bucket creation.';
    end if;
end
$$;

-- Quick check: every KejaLink table should show rls_enabled = true
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
