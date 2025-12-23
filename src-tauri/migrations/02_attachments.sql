-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    filename TEXT,
    mime_type TEXT,
    size INTEGER,
    content_id TEXT,
    data BLOB,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);
