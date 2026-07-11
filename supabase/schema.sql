create extension if not exists "pgcrypto";

create type public.payment_method as enum ('efectivo', 'transferencia');
create type public.sale_mode as enum ('lote', 'individual');
create type public.shed_status as enum ('activo', 'pausado', 'cerrado');
create type public.movement_type as enum ('entry', 'sale', 'adjustment', 'loss');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.sheds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text not null,
  status public.shed_status not null default 'activo',
  entry_date date not null,
  initial_quantity integer not null check (initial_quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  document text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shed_id uuid not null references public.sheds(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  sale_date date not null,
  payment_method public.payment_method not null,
  sale_mode public.sale_mode not null default 'lote',
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  total numeric(14, 2) generated always as (quantity * unit_price) stored,
  notes text,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  shed_id uuid not null references public.sheds(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  bird_tag text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shed_id uuid not null references public.sheds(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  movement_type public.movement_type not null,
  quantity integer not null check (quantity <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.shed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shed_id uuid not null references public.sheds(id) on delete cascade,
  cost_date date not null,
  concept text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index sheds_user_id_idx on public.sheds(user_id);
create index customers_user_id_idx on public.customers(user_id);
create index sales_user_id_date_idx on public.sales(user_id, sale_date desc);
create index sales_shed_id_idx on public.sales(shed_id);
create index inventory_movements_shed_id_idx on public.inventory_movements(shed_id);
create index shed_costs_shed_id_idx on public.shed_costs(shed_id);

alter table public.profiles enable row level security;
alter table public.sheds enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.shed_costs enable row level security;

create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "sheds own rows" on public.sheds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "customers own rows" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sales own rows" on public.sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sale_items own rows" on public.sale_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "inventory own rows" on public.inventory_movements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "costs own rows" on public.shed_costs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.shed_available(p_shed_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(quantity), 0)::integer
  from public.inventory_movements
  where shed_id = p_shed_id
    and user_id = auth.uid();
$$;

create or replace function public.create_shed_with_entry(
  p_name text,
  p_code text,
  p_entry_date date,
  p_initial_quantity integer,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_shed_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_initial_quantity <= 0 then
    raise exception 'La cantidad inicial debe ser mayor que cero.';
  end if;

  insert into public.sheds (user_id, name, code, entry_date, initial_quantity, notes)
  values (v_user_id, trim(p_name), trim(p_code), p_entry_date, p_initial_quantity, p_notes)
  returning id into v_shed_id;

  insert into public.inventory_movements (user_id, shed_id, movement_type, quantity, reason)
  values (v_user_id, v_shed_id, 'entry', p_initial_quantity, 'Ingreso inicial del galpón');

  return v_shed_id;
end;
$$;

create or replace function public.register_sale(
  p_shed_id uuid,
  p_customer_id uuid,
  p_sale_date date,
  p_payment_method public.payment_method,
  p_sale_mode public.sale_mode,
  p_quantity integer,
  p_unit_price numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_available integer;
  v_sale_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  if p_unit_price < 0 then
    raise exception 'El valor unitario no puede ser negativo.';
  end if;

  perform 1 from public.sheds where id = p_shed_id and user_id = v_user_id;
  if not found then
    raise exception 'El galpón no existe o no pertenece a este usuario.';
  end if;

  perform 1 from public.customers where id = p_customer_id and user_id = v_user_id;
  if not found then
    raise exception 'El cliente no existe o no pertenece a este usuario.';
  end if;

  select public.shed_available(p_shed_id) into v_available;
  if v_available < p_quantity then
    raise exception 'No hay suficientes pollos disponibles. Disponibles: %', v_available;
  end if;

  insert into public.sales (
    user_id, shed_id, customer_id, sale_date, payment_method, sale_mode, quantity, unit_price, notes
  )
  values (
    v_user_id, p_shed_id, p_customer_id, p_sale_date, p_payment_method, p_sale_mode, p_quantity, p_unit_price, p_notes
  )
  returning id into v_sale_id;

  insert into public.sale_items (user_id, sale_id, shed_id, quantity, unit_price)
  values (v_user_id, v_sale_id, p_shed_id, p_quantity, p_unit_price);

  insert into public.inventory_movements (user_id, shed_id, sale_id, movement_type, quantity, reason)
  values (v_user_id, p_shed_id, v_sale_id, 'sale', -p_quantity, 'Venta registrada');

  return v_sale_id;
end;
$$;

create or replace function public.add_inventory_movement(
  p_shed_id uuid,
  p_movement_type public.movement_type,
  p_quantity integer,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer;
  v_movement_id uuid;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_movement_type = 'sale' then
    raise exception 'Las ventas se registran desde el módulo de ventas.';
  end if;

  perform 1 from public.sheds where id = p_shed_id and user_id = v_user_id;
  if not found then
    raise exception 'El galpón no existe o no pertenece a este usuario.';
  end if;

  v_quantity := case
    when p_movement_type = 'loss' then -abs(p_quantity)
    when p_movement_type = 'entry' then abs(p_quantity)
    else p_quantity
  end;

  if v_quantity = 0 then
    raise exception 'La cantidad no puede ser cero.';
  end if;

  insert into public.inventory_movements (user_id, shed_id, movement_type, quantity, reason)
  values (v_user_id, p_shed_id, p_movement_type, v_quantity, trim(p_reason))
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- UPDATE / DELETE FUNCTIONS
-- ────────────────────────────────────────────────────────────

create or replace function public.update_shed(
  p_shed_id uuid,
  p_name text,
  p_code text,
  p_entry_date date,
  p_notes text default null
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  update public.sheds
  set name = trim(p_name), code = trim(p_code), entry_date = p_entry_date, notes = p_notes
  where id = p_shed_id and user_id = v_user_id;
  if not found then raise exception 'Galpón no encontrado.'; end if;
end;
$$;

create or replace function public.change_shed_status(
  p_shed_id uuid,
  p_status public.shed_status
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  update public.sheds set status = p_status
  where id = p_shed_id and user_id = v_user_id;
  if not found then raise exception 'Galpón no encontrado.'; end if;
end;
$$;

create or replace function public.delete_shed(p_shed_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  select count(*) into v_count from public.sales
  where shed_id = p_shed_id and user_id = v_user_id;
  if v_count > 0 then
    raise exception 'No se puede eliminar un galpón con ventas registradas.';
  end if;
  delete from public.sheds where id = p_shed_id and user_id = v_user_id;
  if not found then raise exception 'Galpón no encontrado.'; end if;
end;
$$;

create or replace function public.update_customer(
  p_customer_id uuid,
  p_name text,
  p_phone text default null,
  p_document text default null,
  p_notes text default null
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  update public.customers
  set name = trim(p_name), phone = p_phone, document = p_document, notes = p_notes
  where id = p_customer_id and user_id = v_user_id;
  if not found then raise exception 'Cliente no encontrado.'; end if;
end;
$$;

create or replace function public.delete_customer(p_customer_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  select count(*) into v_count from public.sales
  where customer_id = p_customer_id and user_id = v_user_id;
  if v_count > 0 then
    raise exception 'No se puede eliminar un cliente con ventas registradas.';
  end if;
  delete from public.customers where id = p_customer_id and user_id = v_user_id;
  if not found then raise exception 'Cliente no encontrado.'; end if;
end;
$$;

create or replace function public.delete_sale(p_sale_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  perform 1 from public.sales where id = p_sale_id and user_id = v_user_id;
  if not found then raise exception 'Venta no encontrada.'; end if;
  -- sale_items and inventory_movements cascade automatically
  delete from public.sales where id = p_sale_id and user_id = v_user_id;
end;
$$;

create or replace function public.update_shed_cost(
  p_cost_id uuid,
  p_shed_id uuid,
  p_cost_date date,
  p_concept text,
  p_amount numeric,
  p_notes text default null
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  update public.shed_costs
  set shed_id = p_shed_id, cost_date = p_cost_date, concept = trim(p_concept), amount = p_amount, notes = p_notes
  where id = p_cost_id and user_id = v_user_id;
  if not found then raise exception 'Costo no encontrado.'; end if;
end;
$$;

create or replace function public.delete_shed_cost(p_cost_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  delete from public.shed_costs where id = p_cost_id and user_id = v_user_id;
  if not found then raise exception 'Costo no encontrado.'; end if;
end;
$$;

create or replace function public.delete_inventory_movement(p_movement_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  perform 1 from public.inventory_movements
  where id = p_movement_id and user_id = v_user_id and sale_id is null;
  if not found then raise exception 'Movimiento no encontrado o vinculado a una venta.'; end if;
  delete from public.inventory_movements where id = p_movement_id and user_id = v_user_id;
end;
$$;

create or replace function public.update_profile(p_full_name text)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  update public.profiles set full_name = trim(p_full_name) where id = v_user_id;
end;
$$;
