-- Create accounts table (extending what's in accounts.json for unified DB)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    account_type TEXT NOT NULL, -- 'google', 'imap'
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL, -- Original path from IMAP
    role TEXT, -- 'inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'junk'
    unread_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    uid_next INTEGER,
    uid_validity INTEGER,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    UNIQUE(account_id, path)
);

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    folder_id INTEGER NOT NULL,
    remote_id TEXT NOT NULL, -- IMAP UID or Google ID
    message_id TEXT,
    in_reply_to TEXT,
    subject TEXT,
    sender_name TEXT,
    sender_address TEXT NOT NULL,
    recipient_to TEXT,
    recipient_cc TEXT,
    recipient_bcc TEXT,
    date DATETIME NOT NULL,
    body_text TEXT,
    body_html TEXT,
    snippet TEXT,
    has_attachments BOOLEAN DEFAULT FALSE,
    flags TEXT, -- JSON array of flags: \Seen, \Answered, \Flagged, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
    UNIQUE(account_id, remote_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder_id ON emails(folder_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);

-- FTS5 for full text search
CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
    subject,
    sender_name,
    sender_address,
    body_text,
    content='emails',
    content_rowid='id'
);

-- Triggers to keep FTS updated
CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, subject, sender_name, sender_address, body_text)
  VALUES (new.id, new.subject, new.sender_name, new.sender_address, new.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, sender_name, sender_address, body_text)
  VALUES('delete', old.id, old.subject, old.sender_name, old.sender_address, old.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, sender_name, sender_address, body_text)
  VALUES('delete', old.id, old.subject, old.sender_name, old.sender_address, old.body_text);
  INSERT INTO emails_fts(rowid, subject, sender_name, sender_address, body_text)
  VALUES (new.id, new.subject, new.sender_name, new.sender_address, new.body_text);
END;
