-- Migration to support draft attachments in the main attachments table
-- We need to make email_id nullable and add draft_id

-- 1. Create the new table
CREATE TABLE attachments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER, -- Now nullable
    draft_id INTEGER, -- New column
    filename TEXT,
    mime_type TEXT,
    size INTEGER,
    content_id TEXT,
    data BLOB,
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE,
    FOREIGN KEY (draft_id) REFERENCES drafts (id) ON DELETE CASCADE
);

-- 2. Copy data from old table
INSERT INTO attachments_new (id, email_id, filename, mime_type, size, content_id, data)
SELECT id, email_id, filename, mime_type, size, content_id, data FROM attachments;

-- 3. Drop old table
DROP TABLE attachments;

-- 4. Rename new table
ALTER TABLE attachments_new RENAME TO attachments;
