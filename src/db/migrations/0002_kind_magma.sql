ALTER TABLE "activities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "strava_activities_raw" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "activities" CASCADE;--> statement-breakpoint
DROP TABLE "strava_activities_raw" CASCADE;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "athlete_firstname" text;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "athlete_lastname" text;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "athlete_username" text;--> statement-breakpoint
ALTER TABLE "strava_connections" DROP COLUMN "athlete_first_name";--> statement-breakpoint
ALTER TABLE "strava_connections" DROP COLUMN "athlete_last_name";--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_athleteId_unique" UNIQUE("athlete_id");