-- Restore M-Pesa STK Push alongside admin-reviewed manual payments.
-- Run on existing databases after 04_manual_payments.sql.
-- Safe to re-run; historical payment rows and references are preserved.
begin;

-- Compatibility with legacy databases that still use payer_id instead of agent_id.
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'payments'
          and column_name = 'payer_id'
    )
    and not exists (
        select 1
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'payments'
          and column_name = 'agent_id'
    ) then
        alter table payments rename column payer_id to agent_id;
    end if;
end $$;

alter table payments
    add column if not exists phone varchar(15),
    add column if not exists merchant_request_id varchar(60),
    add column if not exists checkout_request_id varchar(60),
    add column if not exists payment_reference varchar(100);

alter table payments
    alter column phone drop not null;

update payments
set payment_method = case
      when checkout_request_id is not null then 'mpesa'
      else 'manual'
    end
where payment_method is null;

alter table payments
    alter column payment_method set default 'manual',
    alter column payment_method set not null;

alter table payments
    drop constraint if exists payments_payment_method_check,
    add constraint payments_payment_method_check
      check (payment_method in ('manual', 'mpesa'));

alter table payments
    drop constraint if exists payments_mpesa_needs_phone,
    add constraint payments_mpesa_needs_phone
      check (payment_method <> 'mpesa' or phone is not null);

create unique index if not exists uq_payments_checkout_request
    on payments (checkout_request_id) where checkout_request_id is not null;

commit;
