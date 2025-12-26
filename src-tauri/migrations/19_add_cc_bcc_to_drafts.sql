-- Add cc_address and bcc_address to drafts table
ALTER TABLE drafts ADD COLUMN cc_address TEXT;
ALTER TABLE drafts ADD COLUMN bcc_address TEXT;
