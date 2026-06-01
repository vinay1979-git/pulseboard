-- Drop old check constraint on public.profiles and recreate to include 'participant' and 'voter'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['super-admin'::text, 'power-user'::text, 'participant'::text, 'voter'::text]));

-- Re-create handle_new_user PL/pgSQL database trigger function to support frictionless voter registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'is_participant')::boolean = true OR NEW.raw_user_meta_data->>'role' = 'participant' OR NEW.raw_user_meta_data->>'role' = 'voter' THEN
    -- Frictionless participant attendee flow
    INSERT INTO public.profiles (id, email, role, approval_status)
    VALUES (NEW.id, NEW.email, 'participant', 'approved')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Normal power-user / super-admin flow
    INSERT INTO public.profiles (id, email, role, approval_status)
    VALUES (NEW.id, NEW.email, 'power-user', CASE WHEN NEW.email = 'vinay1979@gmail.com' THEN 'approved' ELSE 'pending' END)
    ON CONFLICT (id) DO NOTHING;
    
    IF NEW.email = 'vinay1979@gmail.com' THEN
      UPDATE public.profiles SET role = 'super-admin', approval_status = 'approved' WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
