CREATE INDEX "Match_latitude_idx" ON "Match"("latitude");
CREATE INDEX "Match_longitude_idx" ON "Match"("longitude");
CREATE INDEX "Match_status_startsAt_idx" ON "Match"("status", "startsAt");
