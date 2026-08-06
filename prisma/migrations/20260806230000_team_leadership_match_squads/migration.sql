ALTER TYPE "TeamRole" RENAME VALUE 'OWNER' TO 'CAPTAIN';
ALTER TYPE "TeamRole" ADD VALUE 'COACH';

CREATE TABLE "MatchSquadPlayer" (
  "matchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "footballerId" TEXT NOT NULL,
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchSquadPlayer_pkey" PRIMARY KEY ("matchId", "teamId", "footballerId")
);
CREATE INDEX "MatchSquadPlayer_matchId_teamId_idx" ON "MatchSquadPlayer"("matchId", "teamId");
ALTER TABLE "MatchSquadPlayer" ADD CONSTRAINT "MatchSquadPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSquadPlayer" ADD CONSTRAINT "MatchSquadPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchSquadPlayer" ADD CONSTRAINT "MatchSquadPlayer_footballerId_fkey" FOREIGN KEY ("footballerId") REFERENCES "Footballer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
