


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'power-user'::"text",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text",
    CONSTRAINT "profiles_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['super-admin'::"text", 'power-user'::"text", 'participant'::"text", 'voter'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pulse_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pulse_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "options" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_live" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "order_index" integer DEFAULT 0,
    "updated_at" timestamp with time zone,
    "correct_option" integer,
    CONSTRAINT "questions_type_check" CHECK (("type" = ANY (ARRAY['multiple_choice'::"text", 'word_cloud'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "participant_id" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pulse_participant_id" "uuid",
    "session_id" "uuid",
    "user_email" character varying(255),
    "user_name" character varying(255),
    "selected_option" character varying(255),
    "is_correct" boolean DEFAULT false,
    "points_awarded" integer DEFAULT 0
);


ALTER TABLE "public"."responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(6) NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_by" "uuid",
    "last_live_at" timestamp with time zone,
    "auth_mode" character varying(50) DEFAULT 'anonymous'::character varying,
    "auto_launch" boolean DEFAULT false,
    "timer_seconds" integer DEFAULT 0,
    CONSTRAINT "sessions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_participants"
    ADD CONSTRAINT "pulse_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulse_participants"
    ADD CONSTRAINT "unique_session_email" UNIQUE ("session_id", "email");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "unique_user_question" UNIQUE ("session_id", "question_id", "user_email");



CREATE INDEX "idx_pulse_participants_session" ON "public"."pulse_participants" USING "btree" ("session_id");



CREATE INDEX "idx_questions_session_id" ON "public"."questions" USING "btree" ("session_id");



CREATE UNIQUE INDEX "idx_responses_participant_question" ON "public"."responses" USING "btree" ("question_id", "participant_id");



CREATE INDEX "idx_responses_question_id" ON "public"."responses" USING "btree" ("question_id");



CREATE INDEX "idx_responses_session" ON "public"."responses" USING "btree" ("session_id");



CREATE UNIQUE INDEX "idx_sessions_code" ON "public"."sessions" USING "btree" ("code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pulse_participants"
    ADD CONSTRAINT "pulse_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pulse_participant_id_fkey" FOREIGN KEY ("pulse_participant_id") REFERENCES "public"."pulse_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Allow authenticated full write access" ON "public"."profiles" TO "authenticated" USING (true);



CREATE POLICY "Allow public delete on responses" ON "public"."responses" FOR DELETE USING (true);



CREATE POLICY "Allow public insert access to pulse_participants" ON "public"."pulse_participants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to responses" ON "public"."responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert on responses" ON "public"."responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to pulse_participants" ON "public"."pulse_participants" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to responses" ON "public"."responses" FOR SELECT USING (true);



CREATE POLICY "Allow public select on questions" ON "public"."questions" FOR SELECT USING (true);



CREATE POLICY "Allow public select on responses" ON "public"."responses" FOR SELECT USING (true);



CREATE POLICY "Allow public select on sessions" ON "public"."sessions" FOR SELECT USING (true);



CREATE POLICY "Allow public update access to pulse_participants" ON "public"."pulse_participants" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Allow public update on responses" ON "public"."responses" FOR UPDATE USING (true);



CREATE POLICY "Allow write operations on questions" ON "public"."questions" USING (true);



CREATE POLICY "Allow write operations on sessions" ON "public"."sessions" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulse_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pulse_participants" TO "anon";
GRANT ALL ON TABLE "public"."pulse_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."pulse_participants" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."responses" TO "anon";
GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































