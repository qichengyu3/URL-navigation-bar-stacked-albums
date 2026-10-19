-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "iconType" TEXT NOT NULL DEFAULT 'auto',
    "categoryId" INTEGER,
    "categoryIds" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Site_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Site" ("categoryId", "createdAt", "description", "icon", "iconType", "id", "sortOrder", "title", "updatedAt", "url") SELECT "categoryId", "createdAt", "description", "icon", "iconType", "id", "sortOrder", "title", "updatedAt", "url" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
