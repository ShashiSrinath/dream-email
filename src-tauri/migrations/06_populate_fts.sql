-- Populate emails_fts with existing data
INSERT INTO emails_fts(rowid, subject, sender_name, sender_address, body_text)
SELECT id, subject, sender_name, sender_address, body_text FROM emails
WHERE id NOT IN (SELECT rowid FROM emails_fts);
