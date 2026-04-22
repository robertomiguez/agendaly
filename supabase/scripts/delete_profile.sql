-- Variable: target_profile_id
-- Set the profile_id you want to completely delete below
-- Run this script in the Supabase SQL Editor

DO $$
DECLARE
    -- REPLACE THIS UUID WITH THE PROFILE ID YOU WANT TO DELETE
    target_profile_id uuid := '10ff3f09-3c4e-4953-8f24-c53e7d12d3a6';
    
    target_auth_user_id uuid;
    target_provider_id uuid;
    target_customer_id uuid;
    target_super_admin_id uuid;
BEGIN
    RAISE NOTICE 'Starting full deletion for profile: %', target_profile_id;

    -- Fetch auth mapping
    SELECT auth_user_id INTO target_auth_user_id FROM public.profiles WHERE id = target_profile_id;
    
    -- ==========================================
    -- 1. Check and cleanup Provider role
    -- ==========================================
    SELECT id INTO target_provider_id FROM public.providers WHERE profile_id = target_profile_id;
    
    IF target_provider_id IS NOT NULL THEN
        RAISE NOTICE 'Profile acts as Provider: cleaning up dependencies...';
        
        -- Sever links on the provider to avoid circular dependencies
        UPDATE public.providers
        SET subscription_id = NULL,
            approved_by = NULL
        WHERE id = target_provider_id;

        -- Delete Service Staff links
        DELETE FROM public.service_staff
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id)
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);

        -- Delete Staff Addresses
        DELETE FROM public.staff_addresses
        WHERE staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);

        -- Delete Appointments linked to provider services
        DELETE FROM public.appointments
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);

        -- Delete Availability
        DELETE FROM public.availability
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);

        -- Delete Blocked Dates
        DELETE FROM public.blocked_dates
        WHERE provider_id = target_provider_id
        OR staff_id IN (SELECT id FROM public.staff WHERE provider_id = target_provider_id);

        -- Delete Service Images
        DELETE FROM public.service_images
        WHERE service_id IN (SELECT id FROM public.services WHERE provider_id = target_provider_id);

        -- Delete Services
        DELETE FROM public.services
        WHERE provider_id = target_provider_id;

        -- Delete Staff
        DELETE FROM public.staff
        WHERE provider_id = target_provider_id;

        -- Delete Provider Addresses
        DELETE FROM public.provider_addresses
        WHERE provider_id = target_provider_id;

        -- Delete Payments (linked to ANY subscription of this provider)
        DELETE FROM public.payments
        WHERE subscription_id IN (
            SELECT id FROM public.subscriptions WHERE provider_id = target_provider_id
        );

        -- Delete Subscriptions
        DELETE FROM public.subscriptions
        WHERE provider_id = target_provider_id;

        -- Delete Provider
        DELETE FROM public.providers
        WHERE id = target_provider_id;
        RAISE NOTICE 'Deleted provider role data';
    END IF;


    -- ==========================================
    -- 2. Check and cleanup Customer role
    -- ==========================================
    SELECT id INTO target_customer_id FROM public.customers WHERE profile_id = target_profile_id;
    
    IF target_customer_id IS NOT NULL THEN
        RAISE NOTICE 'Profile acts as Customer: cleaning up dependencies...';

        -- Delete Appointments linked to customer
        DELETE FROM public.appointments
        WHERE customer_id = target_customer_id;

        -- Delete Customer
        DELETE FROM public.customers
        WHERE id = target_customer_id;
        RAISE NOTICE 'Deleted customer role data';
    END IF;


    -- ==========================================
    -- 3. Check and cleanup Super Admin role
    -- ==========================================
    SELECT id INTO target_super_admin_id FROM public.super_admins WHERE profile_id = target_profile_id;
    
    IF target_super_admin_id IS NOT NULL THEN
        RAISE NOTICE 'Profile acts as Super Admin: cleaning up dependencies...';

        -- Delete Admin Activity Logs
        DELETE FROM public.admin_activity_logs
        WHERE admin_id = target_super_admin_id;

        -- Sever approved_by links on providers
        UPDATE public.providers
        SET approved_by = NULL
        WHERE approved_by = target_super_admin_id;

        -- Delete Super Admin
        DELETE FROM public.super_admins
        WHERE id = target_super_admin_id;
        RAISE NOTICE 'Deleted super_admin role data';
    END IF;


    -- ==========================================
    -- 4. Clean up root profile and identity
    -- ==========================================
    IF target_auth_user_id IS NOT NULL THEN
        DELETE FROM public.user_agreements WHERE user_id = target_auth_user_id;
    END IF;

    -- Delete Profile (this cascaded to any leftover roles if any, but they are already deleted)
    DELETE FROM public.profiles WHERE id = target_profile_id;
    
    -- Delete Auth User securely
    IF target_auth_user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = target_auth_user_id;
    END IF;

    RAISE NOTICE 'Successfully deleted profile and all related data.';

END $$;
