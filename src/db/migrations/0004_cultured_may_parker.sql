CREATE TABLE "food_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"barcode" text,
	"serving_grams" double precision NOT NULL,
	"kcal" double precision NOT NULL,
	"protein_g" double precision,
	"carbs_g" double precision,
	"fat_g" double precision,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wellness_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_kg" double precision,
	"sleep_hours" double precision,
	"sleep_score" integer,
	"vo2max" double precision,
	"mood" integer,
	"energy" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellness_logs" ADD CONSTRAINT "wellness_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_logs_user_consumed_idx" ON "food_logs" USING btree ("user_id","consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wellness_logs_user_date_idx" ON "wellness_logs" USING btree ("user_id","date");