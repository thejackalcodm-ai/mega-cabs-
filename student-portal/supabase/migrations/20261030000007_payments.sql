-- =============================================================================
-- 0007 · Invoices & payments (provider-agnostic; no card data is ever stored)
-- =============================================================================

create sequence public.invoice_number_seq start 1;
create sequence public.receipt_number_seq start 1;

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
                 default ('INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0')),
  student_id     uuid not null references public.students(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  title          text not null,
  description    text,
  currency       text not null default 'GBP',
  subtotal       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  amount_paid    numeric(12,2) not null default 0,
  status         public.invoice_status not null default 'open',
  issued_at      timestamptz not null default now(),
  due_date       date,
  paid_at        timestamptz,
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index invoices_student_idx on public.invoices(student_id);
create index invoices_status_idx on public.invoices(status);
create trigger invoices_updated before update on public.invoices for each row execute function public.set_updated_at();

create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount numeric(12,2) not null check (unit_amount >= 0),
  amount      numeric(12,2) generated always as (round(quantity * unit_amount, 2)) stored,
  position    int not null default 0
);
create index invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- Payment rows record the outcome reported by a provider (Stripe, bank transfer, manual).
-- Only provider references are kept: never PAN / CVC / card data.
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  invoice_id         uuid references public.invoices(id) on delete set null,
  amount             numeric(12,2) not null check (amount > 0),
  currency           text not null default 'GBP',
  status             public.payment_status not null default 'pending',
  method             text check (method in ('card', 'bank_transfer', 'cash', 'other')),
  provider           text not null default 'manual',     -- 'stripe', 'manual', ...
  provider_reference text,                                -- e.g. Stripe payment_intent id
  receipt_number     text unique,
  paid_at            timestamptz,
  notes              text,
  recorded_by        uuid references public.profiles(id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index payments_student_idx on public.payments(student_id);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_status_idx on public.payments(status);
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.recompute_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub numeric; v_paid numeric; inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if inv.id is null then return; end if;
  select coalesce(sum(amount), 0) into v_sub from public.invoice_items where invoice_id = p_invoice_id;
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = p_invoice_id and status = 'paid';
  update public.invoices set
    subtotal = v_sub, total = v_sub + tax, amount_paid = v_paid,
    status = case when status in ('cancelled', 'draft') then status
                  when v_paid >= v_sub + tax and v_sub + tax > 0 then 'paid'
                  when status = 'paid' and v_paid < v_sub + tax then 'open'
                  else status end,
    paid_at = case when v_paid >= v_sub + tax and v_sub + tax > 0 then coalesce(paid_at, now()) end
  where id = p_invoice_id;
end $$;
revoke execute on function public.recompute_invoice(uuid) from public, anon, authenticated;

create or replace function public.on_invoice_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
create trigger invoice_items_recompute after insert or update or delete on public.invoice_items
  for each row execute function public.on_invoice_item_change();

create or replace function public.on_invoice_issued()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status = 'draft') then
    perform public.notify(public.student_profile_id(new.student_id), 'payment_due', 'Invoice ' || new.invoice_number || ' issued',
      new.title || coalesce(' — due ' || to_char(new.due_date, 'DD Mon YYYY'), ''), '/payments/invoices/' || new.id);
    perform public.emit_event('invoice.issued', 'invoice', new.id, jsonb_build_object('student_id', new.student_id));
  end if;
  return new;
end $$;
create trigger invoices_issued after insert or update of status on public.invoices
  for each row execute function public.on_invoice_issued();

create or replace function public.on_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    new.paid_at := coalesce(new.paid_at, now());
    new.receipt_number := coalesce(new.receipt_number,
      'RCT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 5, '0'));
  end if;
  return new;
end $$;
create trigger payments_before before insert or update on public.payments
  for each row execute function public.on_payment_change();

create or replace function public.after_payment_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_id is not null then perform public.recompute_invoice(new.invoice_id); end if;
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id and old.invoice_id is not null then
    perform public.recompute_invoice(old.invoice_id);
  end if;
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    perform public.write_audit('payment.' || new.status::text, 'payment', new.id, new.student_id,
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'provider', new.provider));
    perform public.emit_event('payment.' || new.status::text, 'payment', new.id,
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'student_id', new.student_id));
    if new.status = 'paid' then
      perform public.notify(public.student_profile_id(new.student_id), 'payment_received', 'Payment received',
        new.currency || ' ' || to_char(new.amount, 'FM999,999,990.00') || ' — receipt ' || new.receipt_number,
        '/payments');
    end if;
  end if;
  return null;
end $$;
create trigger payments_after after insert or update on public.payments
  for each row execute function public.after_payment_change();

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy invoices_select on public.invoices for select to authenticated
  using (public.can_access_student(student_id) and (status <> 'draft' or public.is_staff()));
create policy invoices_write on public.invoices for all to authenticated
  using (public.has_permission('payments.manage')) with check (public.has_permission('payments.manage'));

create policy invoice_items_select on public.invoice_items for select to authenticated using (
  exists (select 1 from public.invoices i where i.id = invoice_id and public.can_access_student(i.student_id)
          and (i.status <> 'draft' or public.is_staff()))
);
create policy invoice_items_write on public.invoice_items for all to authenticated
  using (public.has_permission('payments.manage')) with check (public.has_permission('payments.manage'));

create policy payments_select on public.payments for select to authenticated using (public.can_access_student(student_id));
-- Payments are recorded by finance staff or by the payment-provider webhook (service role).
create policy payments_write on public.payments for all to authenticated
  using (public.has_permission('payments.manage')) with check (public.has_permission('payments.manage'));
