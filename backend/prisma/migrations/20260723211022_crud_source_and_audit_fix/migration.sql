/*
  Warnings:

  - You are about to drop the column `entity_id` on the `AuditLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "asset_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "support_type" TEXT NOT NULL,
    "asset_type_id" INTEGER NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "description" TEXT,
    "po_number" TEXT,
    "location_id" INTEGER NOT NULL,
    "current_owner" TEXT,
    "lifecycle_status" TEXT NOT NULL DEFAULT 'InStock',
    "purchase_date" DATETIME,
    "warranty_expiry" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Asset_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "AssetType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("active", "asset_id", "asset_type_id", "created_at", "current_owner", "description", "id", "lifecycle_status", "location_id", "make", "model", "po_number", "purchase_date", "serial_number", "support_type", "updated_at", "warranty_expiry") SELECT "active", "asset_id", "asset_type_id", "created_at", "current_owner", "description", "id", "lifecycle_status", "location_id", "make", "model", "po_number", "purchase_date", "serial_number", "support_type", "updated_at", "warranty_expiry" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_asset_id_key" ON "Asset"("asset_id");
CREATE UNIQUE INDEX "Asset_serial_number_key" ON "Asset"("serial_number");
CREATE TABLE "new_AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entity_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field_changed" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    "asset_id" INTEGER,
    "service_request_id" INTEGER,
    CONSTRAINT "AuditLog_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "changed_at", "changed_by", "entity_type", "field_changed", "id", "new_value", "old_value", "remark") SELECT "action", "changed_at", "changed_by", "entity_type", "field_changed", "id", "new_value", "old_value", "remark" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE TABLE "new_Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "location_name" TEXT NOT NULL,
    "location_code" TEXT NOT NULL,
    "region" TEXT,
    "accountable_contact" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Location" ("accountable_contact", "created_at", "id", "location_code", "location_name", "region", "updated_at") SELECT "accountable_contact", "created_at", "id", "location_code", "location_name", "region", "updated_at" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_location_code_key" ON "Location"("location_code");
CREATE TABLE "new_ServiceRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "request_id" TEXT NOT NULL,
    "logged_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_id" INTEGER NOT NULL,
    "sub_location" TEXT,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Low',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "asset_id" INTEGER,
    "reported_by" TEXT,
    "submitter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "assigned_engineer" TEXT,
    "expected_resolution_date" DATETIME,
    "sla_flag" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ServiceRequest_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceRequest" ("active", "asset_id", "assigned_engineer", "category", "created_at", "description", "expected_resolution_date", "id", "location_id", "logged_date", "priority", "reported_by", "request_id", "sla_flag", "status", "sub_category", "sub_location", "submitter", "title", "updated_at") SELECT "active", "asset_id", "assigned_engineer", "category", "created_at", "description", "expected_resolution_date", "id", "location_id", "logged_date", "priority", "reported_by", "request_id", "sla_flag", "status", "sub_category", "sub_location", "submitter", "title", "updated_at" FROM "ServiceRequest";
DROP TABLE "ServiceRequest";
ALTER TABLE "new_ServiceRequest" RENAME TO "ServiceRequest";
CREATE UNIQUE INDEX "ServiceRequest_request_id_key" ON "ServiceRequest"("request_id");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location_id" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "User_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("created_at", "email", "id", "location_id", "name", "password", "role", "updated_at") SELECT "created_at", "email", "id", "location_id", "name", "password", "role", "updated_at" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
