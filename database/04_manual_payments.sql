-- Migrate existing databases to admin-reviewed manual payments.
-- Historical M-Pesa rows are kept as legacy records; pending legacy requests
-- are closed because their callbacks and polling are no longer available.
alter table payments
    add column if not exists payment_method varchar(20),
    add column if not exists payment_reference varchar(100);

update payments
set payment_method = 'mpesa'
where payment_method is null;

do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'payments'
          and column_name = 'mpesa_receipt'
    ) then
        execute 'update payments set payment_reference = coalesce(payment_reference, mpesa_receipt) where payment_reference is null';
    end if;
end
$$;

alter table payments
    alter column payment_method set default 'manual',
    alter column payment_method set not null,
    alter column phone drop not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'payments'::regclass
          and conname = 'payments_payment_method_check'
    ) then
        alter table payments
            add constraint payments_payment_method_check
            check (payment_method in ('manual', 'mpesa'));
    end if;
end
$$;

update payments
set payment_status = 'failed',
    result_desc = coalesce(result_desc, 'M-Pesa payments are no longer supported.')
where payment_status = 'pending'
  and payment_method = 'mpesa';
