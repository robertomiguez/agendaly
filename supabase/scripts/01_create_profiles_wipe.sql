-- ==============================================================================
-- 01_create_profiles_wipe.sql
-- WARNING: THIS SCRIPT WIPES CUSTOMER, PROVIDER, AND ADMIN DATA (CASCADE)
-- ==============================================================================

-- 1. Wipe invalid state data
TRUNCATE TABLE customers, providers, super_admins CASCADE;

-- 2. Create the central profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Turn on RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile."
    ON public.profiles FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert their own profile."
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can update their own profile."
    ON public.profiles FOR UPDATE
    USING (auth.uid() = auth_user_id);

CREATE POLICY "Public can view basic profiles." 
    ON public.profiles FOR SELECT 
    USING (true);

-- 3. Modify `customers` table
ALTER TABLE public.customers 
  DROP COLUMN IF EXISTS auth_user_id CASCADE,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE public.customers
  ADD COLUMN profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE;

-- 4. Modify `providers` table
ALTER TABLE public.providers
  DROP COLUMN IF EXISTS auth_user_id CASCADE,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE public.providers
  ADD COLUMN profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE;

-- 5. Modify `super_admins` table
ALTER TABLE public.super_admins
  DROP COLUMN IF EXISTS auth_user_id CASCADE,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS name;

ALTER TABLE public.super_admins
  ADD COLUMN profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE;

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- ==============================================================================
-- 7. RECREATE DESTROYED RLS POLICIES DUE TO CASCADING COLUMN DROPS
-- ==============================================================================

-- Appointments Policies
CREATE POLICY "Allow auth users to insert own appointments" ON appointments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers JOIN profiles ON customers.profile_id = profiles.id
      WHERE customers.id = appointments.customer_id AND profiles.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow authenticated users to update own appointments" ON appointments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM customers JOIN profiles ON customers.profile_id = profiles.id
      WHERE customers.id = appointments.customer_id AND profiles.auth_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM services JOIN providers ON services.provider_id = providers.id JOIN profiles ON providers.profile_id = profiles.id
      WHERE services.id = appointments.service_id AND profiles.auth_user_id = auth.uid()
    )
  );

-- Customers Policies
CREATE POLICY "Authenticated users can view allowed customers" ON customers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = customers.profile_id AND profiles.auth_user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN services s ON a.service_id = s.id
      JOIN providers p ON s.provider_id = p.id
      JOIN profiles pr ON p.profile_id = pr.id
      WHERE a.customer_id = customers.id AND pr.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own profile" ON customers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update their own profile" ON customers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  );

-- Providers Policies
CREATE POLICY "Users can delete their own provider profile" ON providers
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own provider profile" ON providers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update their own provider profile" ON providers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profile_id AND profiles.auth_user_id = auth.uid())
  );

-- Update is_super_admin Helper Function
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.super_admins sa
        JOIN public.profiles pr ON sa.profile_id = pr.id
        WHERE pr.auth_user_id = auth.uid()
    );
END;
$function$;
