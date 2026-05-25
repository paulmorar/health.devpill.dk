CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text DEFAULT 'strava' NOT NULL,
	"strava_id" bigint,
	"sport_type" text NOT NULL,
	"name" text,
	"started_at" timestamp with time zone NOT NULL,
	"timezone" text,
	"distance_m" integer,
	"moving_seconds" integer,
	"elapsed_seconds" integer,
	"calories" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"elev_gain_m" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activities_stravaId_unique" UNIQUE("strava_id")
);
--> statement-breakpoint
CREATE TABLE "strava_activities_raw" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"strava_id" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "strava_activities_raw_stravaId_unique" UNIQUE("strava_id")
);
--> statement-breakpoint
CREATE TABLE "strava_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"athlete_id" bigint NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scope" text NOT NULL,
	"athlete_first_name" text,
	"athlete_last_name" text,
	"athlete_profile" text,
	"connected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities_raw" ADD CONSTRAINT "strava_activities_raw_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;