-- Migration: Contacts and Senders FTS
ALTER TABLE senders ADD COLUMN is_contact BOOLEAN DEFAULT 0;
ALTER TABLE senders ADD COLUMN account_email TEXT;
ALTER TABLE senders ADD COLUMN last_synced_at DATETIME;

-- Create FTS table for senders
CREATE VIRTUAL TABLE IF NOT EXISTS senders_fts USING fts5(
    address,
    name,
    content='senders'
);

-- Triggers to keep senders_fts in sync
CREATE TRIGGER IF NOT EXISTS senders_ai AFTER INSERT ON senders BEGIN
  INSERT INTO senders_fts(rowid, address, name) VALUES (new.rowid, new.address, new.name);
END;

CREATE TRIGGER IF NOT EXISTS senders_ad AFTER DELETE ON senders BEGIN
  INSERT INTO senders_fts(senders_fts, rowid, address, name) VALUES('delete', old.rowid, old.address, old.name);
END;

CREATE TRIGGER IF NOT EXISTS senders_au AFTER UPDATE ON senders BEGIN
  INSERT INTO senders_fts(senders_fts, rowid, address, name) VALUES('delete', old.rowid, old.address, old.name);
  INSERT INTO senders_fts(rowid, address, name) VALUES (new.rowid, new.address, new.name);
END;

-- Initial population of FTS
INSERT INTO senders_fts(rowid, address, name)
SELECT rowid, address, name FROM senders;