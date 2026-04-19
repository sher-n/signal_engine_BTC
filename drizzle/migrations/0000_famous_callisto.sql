CREATE TABLE `market_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`timeframe` text NOT NULL,
	`closed_at` integer NOT NULL,
	`open` text NOT NULL,
	`high` text NOT NULL,
	`low` text NOT NULL,
	`close` text NOT NULL,
	`volume` text NOT NULL,
	`sma99` text,
	`ema14` text,
	`ema60` text,
	`atr20` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_snapshot_lookup` ON `market_snapshots` (`symbol`,`timeframe`,`closed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_snapshot` ON `market_snapshots` (`symbol`,`timeframe`,`closed_at`);--> statement-breakpoint
CREATE TABLE `signal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_signal` ON `signal_events` (`signal_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_type` ON `signal_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `signal_fills` (
	`id` text PRIMARY KEY NOT NULL,
	`signal_id` text NOT NULL,
	`type` text NOT NULL,
	`price` text NOT NULL,
	`quantity` text NOT NULL,
	`pnl` text NOT NULL,
	`filled_at` integer,
	FOREIGN KEY (`signal_id`) REFERENCES `signals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_fills_signal` ON `signal_fills` (`signal_id`);--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`entry_price` text NOT NULL,
	`stop_loss` text NOT NULL,
	`initial_sl` text NOT NULL,
	`tp1` text NOT NULL,
	`tp2` text NOT NULL,
	`atr_at_entry` text NOT NULL,
	`quantity` text NOT NULL,
	`remaining_qty` text NOT NULL,
	`trail_anchor` text,
	`bias_snapshot_id` text,
	`entry_snapshot_id` text,
	`opened_at` integer,
	`closed_at` integer,
	`realized_pnl` text
);
--> statement-breakpoint
CREATE INDEX `idx_signals_status` ON `signals` (`symbol`,`status`);--> statement-breakpoint
CREATE INDEX `idx_signals_opened` ON `signals` (`opened_at`);