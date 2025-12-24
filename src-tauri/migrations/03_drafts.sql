-- Create drafts table
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    to_address TEXT,
    subject TEXT,
    body_html TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS drafts_updated_at 
AFTER UPDATE ON drafts
FOR EACH ROW
BEGIN
    UPDATE drafts SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
END;
