CREATE TABLE `status_table` (
	`uri` text NOT NULL,
	`author_did` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`indexed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `author_did_idx` ON `status_table` (`author_did`);