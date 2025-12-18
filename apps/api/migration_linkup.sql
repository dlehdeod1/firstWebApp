-- Migration: Add linkup stat column to players table
-- This adds the '연계' (linkup/combination play) ability stat

ALTER TABLE players ADD COLUMN linkup INTEGER DEFAULT 5;
