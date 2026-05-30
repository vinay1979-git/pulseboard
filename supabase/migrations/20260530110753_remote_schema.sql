drop extension if exists "pg_net";

drop policy "Allow read access to all" on "public"."pulse_participants";

drop index if exists "public"."idx_questions_is_completed";

alter table "public"."profiles" enable row level security;

alter table "public"."questions" drop column "is_completed";

alter table "public"."questions" enable row level security;

alter table "public"."sessions" enable row level security;

CREATE INDEX idx_questions_session_id ON public.questions USING btree (session_id);

CREATE UNIQUE INDEX idx_responses_participant_question ON public.responses USING btree (question_id, participant_id);

CREATE INDEX idx_responses_question_id ON public.responses USING btree (question_id);

CREATE UNIQUE INDEX idx_sessions_code ON public.sessions USING btree (code);

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



