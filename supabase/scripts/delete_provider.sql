    -- Variable: provider_id_to_delete
    -- Set the provider_id you want to delete below
    -- Run this script in the Supabase SQL Editor

    DO $$
    DECLARE
        -- REPLACE THIS UUID WITH THE PROVIDER ID YOU WANT TO DELETE
        target_provider_id uuid := '9bca88ad-92b4-4cea-a8f7-8bdf59a94da2';
        target_subscription_id uuid;
    BEGIN
        RAISE NOTICE 'Starting deletion for provider: %', target_provider_id;

        -- Get the subscription_id for this provider (if any)
        SELECT subscription_id INTO target_subscription_id 
        FROM public.providers 
        WHERE id = target_provider_id;

        -- 1. Delete Service Staff links (join table between services and staff)
        -- Dependencies: Service, Staff
        DELETE FROM public.service_staff
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted service_staff';

        -- 2. Delete Staff Addresses
        -- Dependencies: Staff
        DELETE FROM public.staff_addresses
        WHERE staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted staff_addresses';

        -- 3. Delete Appointments
        -- Dependencies: Service, Staff, Customer
        -- Deleting appointments linked to the provider's services
        DELETE FROM public.appointments
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted appointments';

        -- 4. Delete Availability
        -- Dependencies: Provider (optional), Staff
        -- We delete availability linked explicitly to provider OR to staff of the provider
        DELETE FROM public.availability
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted availability';

        -- 5. Delete Blocked Dates
        -- Dependencies: Provider (optional), Staff
        DELETE FROM public.blocked_dates
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);
        RAISE NOTICE 'Deleted blocked_dates';

        -- 6. Delete Services
        -- Dependencies: Provider
        DELETE FROM public.services
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted services';

        -- 7. Delete Staff
        -- Dependencies: Provider
        DELETE FROM public.staff
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted staff';

        -- 8. Delete Provider Addresses
        -- Dependencies: Provider
        DELETE FROM public.provider_addresses
        WHERE provider_id = target_provider_id;
        RAISE NOTICE 'Deleted provider_addresses';

        -- 9. Delete Payments (linked to subscription)
        -- Dependencies: Subscription
        IF target_subscription_id IS NOT NULL THEN
            DELETE FROM public.payments
            WHERE subscription_id = target_subscription_id;
            RAISE NOTICE 'Deleted payments';
        END IF;

        -- 10. Break Circular Dependency
        -- Set subscription_id to NULL on the provider to allow subscription deletion
        IF target_subscription_id IS NOT NULL THEN
            UPDATE public.providers
            SET subscription_id = NULL
            WHERE id = target_provider_id;
            RAISE NOTICE 'Severed provider -> subscription dependency';
        END IF;

        -- 11. Delete Subscription
        -- Dependencies: Plan (FK, but we don't delete plans)
        IF target_subscription_id IS NOT NULL THEN
            DELETE FROM public.subscriptions
            WHERE id = target_subscription_id;
            RAISE NOTICE 'Deleted subscription: %', target_subscription_id;
        END IF;

        -- 12. Delete Provider
        -- With subscription deleted, we can safely delete the provider
        DELETE FROM public.providers
        WHERE id = target_provider_id;
        RAISE NOTICE 'Deleted provider: %', target_provider_id;

    END $$;
