    -- Variable: provider_id_to_delete
    -- Set the provider_id you want to delete below
    -- Run this script in the Supabase SQL Editor

    DO $$
    DECLARE
        -- REPLACE THIS UUID WITH THE PROVIDER ID YOU WANT TO DELETE
        target_provider_id uuid := '8072d741-f0d9-45ac-85f4-d3bcb60d33a5';
    BEGIN
        RAISE NOTICE 'Starting deletion for provider: %', target_provider_id;

        -- 1. Sever links on the provider to allow dependency deletion
        -- Sever subscription link
        UPDATE public.providers
        SET subscription_id = NULL,
            approved_by = NULL
        WHERE id = target_provider_id;
        RAISE NOTICE 'Severed provider -> subscription and approved_by dependencies';

        -- 2. Delete Service Staff links (join table between services and staff)
        DELETE FROM public.service_staff
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id)
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted service_staff';

        -- 3. Delete Staff Addresses
        DELETE FROM public.staff_addresses
        WHERE staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted staff_addresses';

        -- 4. Delete Appointments
        DELETE FROM public.appointments
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted appointments';

        -- 5. Delete Availability
        DELETE FROM public.availability
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted availability';

        -- 6. Delete Blocked Dates
        DELETE FROM public.blocked_dates
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted blocked_dates';

        -- 7. Delete Service Images
        DELETE FROM public.service_images
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted service_images';

        -- 8. Delete Services
        DELETE FROM public.services
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted services';

        -- 9. Delete Staff
        DELETE FROM public.staff
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted staff';

        -- 10. Delete Provider Addresses
        DELETE FROM public.provider_addresses
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted provider_addresses';

        -- 11. Delete Payments (linked to ANY subscription of this provider)
        DELETE FROM public.payments
        WHERE subscription_id IN (
            SELECT id FROM public.subscriptions WHERE provider_id = target_provider_id
        );
        RAISE NOTICE 'Deleted payments';

        -- 12. Delete Subscriptions
        DELETE FROM public.subscriptions
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted subscriptions';

        -- 13. Delete Provider
        DELETE FROM public.providers
        WHERE id = target_provider_id;
        RAISE NOTICE 'Deleted provider: %', target_provider_id;

    END $$;

