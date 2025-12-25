-- Add is_personal_email and is_automated_mailer to senders table
ALTER TABLE senders ADD COLUMN is_personal_email BOOLEAN DEFAULT NULL;
ALTER TABLE senders ADD COLUMN is_automated_mailer BOOLEAN DEFAULT NULL;
