CREATE TYPE "PlayerPosition" AS ENUM ('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'STRIKER');

ALTER TABLE "Footballer"
ALTER COLUMN "position" TYPE "PlayerPosition"
USING (
  CASE LOWER(TRIM("position"))
    WHEN 'goalkeeper' THEN 'GOALKEEPER'
    WHEN 'goalie' THEN 'GOALKEEPER'
    WHEN 'defender' THEN 'DEFENDER'
    WHEN 'midfielder' THEN 'MIDFIELDER'
    WHEN 'striker' THEN 'STRIKER'
    WHEN 'forward' THEN 'STRIKER'
    ELSE NULL
  END
)::"PlayerPosition";
