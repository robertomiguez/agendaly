-- 1. Fix user_owns_provider helper function to reference profiles table
CREATE OR REPLACE FUNCTION public.user_owns_provider(provider_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.providers p
    JOIN public.profiles pr ON p.profile_id = pr.id
    WHERE p.id = provider_uuid
    AND pr.auth_user_id = auth.uid()
  );
END;
$$;

-- 2. Restore Subscriptions policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own subscription" ON public.subscriptions;
CREATE POLICY "Providers can view own subscription" ON public.subscriptions 
FOR SELECT TO authenticated 
USING (public.user_owns_provider(provider_id));

DROP POLICY IF EXISTS "Providers can create own subscription" ON public.subscriptions;
CREATE POLICY "Providers can create own subscription" ON public.subscriptions 
FOR INSERT TO authenticated 
WITH CHECK (public.user_owns_provider(provider_id));

DROP POLICY IF EXISTS "Providers can update own subscription" ON public.subscriptions;
CREATE POLICY "Providers can update own subscription" ON public.subscriptions 
FOR UPDATE TO authenticated 
USING (public.user_owns_provider(provider_id));

-- 3. Restore Payments policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own payments" ON public.payments;
CREATE POLICY "Providers can view own payments" ON public.payments 
FOR SELECT TO authenticated 
USING (subscription_id IN (
    SELECT id FROM public.subscriptions WHERE public.user_owns_provider(provider_id)
));

DROP POLICY IF EXISTS "Providers can create own payments" ON public.payments;
CREATE POLICY "Providers can create own payments" ON public.payments 
FOR INSERT TO authenticated 
WITH CHECK (subscription_id IN (
    SELECT id FROM public.subscriptions WHERE public.user_owns_provider(provider_id)
));

-- 4. Restore Service Images policies
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can insert service images" ON public.service_images;
CREATE POLICY "Providers can insert service images" ON public.service_images 
FOR INSERT TO authenticated 
WITH CHECK (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));

DROP POLICY IF EXISTS "Providers can update service images" ON public.service_images;
CREATE POLICY "Providers can update service images" ON public.service_images 
FOR UPDATE TO authenticated 
USING (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));

DROP POLICY IF EXISTS "Providers can delete service images" ON public.service_images;
CREATE POLICY "Providers can delete service images" ON public.service_images 
FOR DELETE TO authenticated 
USING (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));

-- 5. Restore Service Staff policies
ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can insert service_staff" ON public.service_staff;
CREATE POLICY "Providers can insert service_staff" ON public.service_staff 
FOR INSERT TO authenticated 
WITH CHECK (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));

DROP POLICY IF EXISTS "Providers can update service_staff" ON public.service_staff;
CREATE POLICY "Providers can update service_staff" ON public.service_staff 
FOR UPDATE TO authenticated 
USING (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));

DROP POLICY IF EXISTS "Providers can delete service_staff" ON public.service_staff;
CREATE POLICY "Providers can delete service_staff" ON public.service_staff 
FOR DELETE TO authenticated 
USING (service_id IN (
    SELECT id FROM public.services WHERE public.user_owns_provider(provider_id)
));
