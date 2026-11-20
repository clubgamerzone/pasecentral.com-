-- NULL means no configured limit/end; never a sentinel date or artificial capacity.
ALTER TABLE events ALTER COLUMN capacity DROP NOT NULL;
ALTER TABLE events ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE events ALTER COLUMN admission_ends_at DROP NOT NULL;
