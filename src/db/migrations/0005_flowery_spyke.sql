CREATE TABLE "goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_kcal" integer,
	"daily_protein_g" integer,
	"daily_carbs_g" integer,
	"daily_fat_g" integer,
	"weekly_active_km" double precision,
	"weekly_active_minutes" integer,
	"weekly_activities_count" integer,
	"target_weight_kg" double precision,
	"daily_sleep_hours" double precision,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;