CREATE TABLE `status_table` (
	`uri` text NOT NULL,
	`author_did` text NOT NULL,
	`status` text,
	`created_at` text,
	`indexed_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `author_did_idx` ON `status_table` (`author_did`);