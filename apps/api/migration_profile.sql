-- Migration: Add birth_year and photo_url columns to players table

ALTER TABLE players ADD COLUMN birth_year INTEGER;
ALTER TABLE players ADD COLUMN photo_url TEXT;
