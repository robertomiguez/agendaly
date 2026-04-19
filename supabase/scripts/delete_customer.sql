-- Variable: customer_id_to_delete
-- Set the customer_id you want to delete below
-- Run this script in the Supabase SQL Editor

DO $$
DECLARE
    -- REPLACE THIS UUID WITH THE CUSTOMER ID YOU WANT TO DELETE
    target_customer_id uuid := '82bf1fc6-5e4f-4894-b1c6-13dc8e30fcf7';
BEGIN
    RAISE NOTICE 'Starting deletion for customer: %', target_customer_id;

    -- 1. Delete Appointments
    -- Dependencies: Customer
    -- Deleting appointments linked to the customer
    DELETE FROM public.appointments
    WHERE customer_id = target_customer_id;
    RAISE NOTICE 'Deleted appointments';

    -- 2. Delete Customer
    -- Root
    DELETE FROM public.customers
    WHERE id = target_customer_id;
    RAISE NOTICE 'Deleted customer: %', target_customer_id;

END $$;
