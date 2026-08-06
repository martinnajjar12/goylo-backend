CREATE TABLE "TeamSquadPlayer" (
  "teamId" TEXT NOT NULL,
  "footballerId" TEXT NOT NULL,
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamSquadPlayer_pkey" PRIMARY KEY ("teamId", "footballerId")
);
ALTER TABLE "TeamSquadPlayer" ADD CONSTRAINT "TeamSquadPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamSquadPlayer" ADD CONSTRAINT "TeamSquadPlayer_footballerId_fkey" FOREIGN KEY ("footballerId") REFERENCES "Footballer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
