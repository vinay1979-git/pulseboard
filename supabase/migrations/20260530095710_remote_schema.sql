drop extension if exists "pg_net";

drop policy "Allow read access to all" on "public"."pulse_participants";

drop index if exists "public"."idx_questions_is_completed";

drop index if exists "public"."profiles_pkey";

alter table "public"."profiles" alter column "approval_status" set default 'pending'::text;

alter table "public"."profiles" alter column "approval_status" set data type text using "approval_status"::text;

alter table "public"."profiles" alter column "created_at" set default now();

alter table "public"."profiles" alter column "created_at" drop not null;

alter table "public"."profiles" alter column "email" set data type text using "email"::text;

alter table "public"."profiles" alter column "id" set data type uuid using "id"::uuid;

alter table "public"."profiles" alter column "role" set default 'power-user'::text;

alter table "public"."profiles" alter column "role" set data type text using "role"::text;

alter table "public"."profiles" alter column "updated_at" set default now();

alter table "public"."profiles" alter column "updated_at" drop not null;

alter table "public"."profiles" enable row level security;

alter table "public"."questions" drop column "is_completed";

alter table "public"."questions" alter column "is_live" set not null;

alter table "public"."questions" alter column "options" set not null;

alter table "public"."questions" alter column "type" set data type text using "type"::text;

alter table "public"."questions" enable row level security;

alter table "public"."responses" alter column "participant_id" set data type text using "participant_id"::text;

alter table "public"."sessions" alter column "code" set data type character varying(6) using "code"::character varying(6);

alter table "public"."sessions" alter column "created_by" set data type text using "created_by"::text;

alter table "public"."sessions" alter column "status" set default 'inactive'::text;

alter table "public"."sessions" alter column "status" set not null;

alter table "public"."sessions" alter column "status" set data type text using "status"::text;

alter table "public"."sessions" alter column "title" set data type text using "title"::text;

alter table "public"."sessions" alter column "updated_by" drop default;

alter table "public"."sessions" alter column "updated_by" set data type uuid using "updated_by"::uuid;

alter table "public"."sessions" enable row level security;

CREATE INDEX idx_questions_session_id ON public.questions USING btree (session_id);

CREATE UNIQUE INDEX idx_responses_participant_question ON public.responses USING btree (question_id, participant_id);

CREATE INDEX idx_responses_question_id ON public.responses USING btree (question_id);

CREATE UNIQUE INDEX idx_sessions_code ON public.sessions USING btree (code);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

alter table "public"."profiles" add constraint "profiles_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_approval_status_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['super-admin'::text, 'power-user'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."questions" add constraint "questions_type_check" CHECK ((type = ANY (ARRAY['multiple_choice'::text, 'word_cloud'::text]))) not valid;

alter table "public"."questions" validate constraint "questions_type_check";

alter table "public"."sessions" add constraint "sessions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))) not valid;

alter table "public"."sessions" validate constraint "sessions_status_check";

alter table "public"."sessions" add constraint "sessions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."sessions" validate constraint "sessions_updated_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, approval_status)
  VALUES (NEW.id, NEW.email, 'power-user', CASE WHEN NEW.email = 'vinay1979@gmail.com' THEN 'approved' ELSE 'pending' END)
  ON CONFLICT (id) DO NOTHING;
  
  IF NEW.email = 'vinay1979@gmail.com' THEN
    UPDATE public.profiles SET role = 'super-admin', approval_status = 'approved' WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$
;


  create policy "Allow authenticated full write access"
  on "public"."profiles"
  as permissive
  for all
  to authenticated
using (true);



  create policy "Allow public read access"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public read access to pulse_participants"
  on "public"."pulse_participants"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public select on questions"
  on "public"."questions"
  as permissive
  for select
  to public
using (true);



  create policy "Allow write operations on questions"
  on "public"."questions"
  as permissive
  for all
  to public
using (true);



  create policy "Allow public delete on responses"
  on "public"."responses"
  as permissive
  for delete
  to public
using (true);



  create policy "Allow public insert on responses"
  on "public"."responses"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow public select on responses"
  on "public"."responses"
  as permissive
  for select
  to public
using (true);



  create policy "Allow public update on responses"
  on "public"."responses"
  as permissive
  for update
  to public
using (true);



  create policy "Allow public select on sessions"
  on "public"."sessions"
  as permissive
  for select
  to public
using (true);



  create policy "Allow write operations on sessions"
  on "public"."sessions"
  as permissive
  for all
  to public
using (true);


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow authenticated updates to avatars"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "Allow authenticated uploads to avatars"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'avatars'::text));



  create policy "Allow public read access to avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



