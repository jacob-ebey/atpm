CREATE TABLE `package` (
	`author_did` text NOT NULL,
	`uri` text NOT NULL,
	`cursor` integer,
	`tags` text NOT NULL,
	`versions` text NOT NULL,
	`created_at` text NOT NULL,
	`indexed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `unique_idx` UNIQUE(`author_did`,`uri`)
);
--> statement-breakpoint
CREATE INDEX `package_idx` ON `package` (`author_did`,`uri`);