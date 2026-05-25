CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"sport_type" text NOT NULL,
	"name" text,
	"started_at" timestamp with time zone NOT NULL,
	"timezone" text,
	"distance_m" integer,
	"moving_seconds" integer,
	"elapsed_seconds" integer,
	"elevation_gain_m" integer,
	"calories" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activities_raw" (
	"strava_id" bigint PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities_raw" ADD CONSTRAINT "strava_activities_raw_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_user_started_idx" ON "activities" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_source_unique_idx" ON "activities" USING btree ("user_id","source","source_id");--> statement-breakpoint
CREATE INDEX "strava_activities_raw_user_idx" ON "strava_activities_raw" USING btree ("user_id");