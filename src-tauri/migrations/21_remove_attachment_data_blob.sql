-- Migration to remove data BLOB from attachments and use file-based storage with hashing
-- 1. Create the new table
CREATE TABLE attachments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER,
    draft_id INTEGER,
    filename TEXT,
    mime_type TEXT,
    size INTEGER,
    content_id TEXT,
    file_hash TEXT, -- SHA-256 hash to identify the file on disk
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE,
    FOREIGN KEY (draft_id) REFERENCES drafts (id) ON DELETE CASCADE
);

-- 2. Copy data from old table (ignoring the 'data' blob)
INSERT INTO attachments_new (id, email_id, draft_id, filename, mime_type, size, content_id)
SELECT id, email_id, draft_id, filename, mime_type, size, content_id FROM attachments;

-- 3. Drop old table
DROP TABLE attachments;

-- 4. Rename new table
ALTER TABLE attachments_new RENAME TO attachments;
