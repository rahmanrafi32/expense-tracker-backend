-- CreateEnum
CREATE TYPE "BookType" AS ENUM ('OPERATING', 'ESCROW');

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "type" "BookType" NOT NULL DEFAULT 'OPERATING';
