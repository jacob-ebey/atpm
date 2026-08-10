CREATE TABLE `package` (
	`author_did` text NOT NULL,
	`uri` text NOT NULL,
	`cursor` integer,
	`created_at` text NOT NULL,
	`indexed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT `package_unique_idx` UNIQUE(`author_did`,`uri`)
);
--> statement-breakpoint
CREATE TABLE `stage` (
	`author_did` text NOT NULL,
	`uri` text NOT NULL,
	`cursor` integer,
	`created_at` text NOT NULL,
	`indexed_at` text,
	CONSTRAINT `stage_unique_idx` UNIQUE(`author_did`,`uri`)
);
--> statement-breakpoint
CREATE INDEX `package_idx` ON `package` (`author_did`,`uri`);--> statement-breakpoint
CREATE INDEX `stage_idx` ON `stage` (`author_did`,`uri`);