CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_date` text NOT NULL,
	`plan_day` text NOT NULL,
	`session_type` text NOT NULL,
	`started_at_utc` text NOT NULL,
	`started_at_local` text NOT NULL,
	`ended_at_utc` text,
	`duration_minutes` integer,
	`pain_before` integer,
	`pain_after` integer,
	`worse_next_morning` text DEFAULT 'unknown' NOT NULL,
	`exercise_log` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
