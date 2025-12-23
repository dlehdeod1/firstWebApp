-- Migration: Add clearances column to player_match_stats table
-- This fixes the "기록 실패" error when recording CLEARANCE events

ALTER TABLE player_match_stats ADD COLUMN clearances INTEGER DEFAULT 0;
