-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "location_name" TEXT NOT NULL,
    "location_code" TEXT NOT NULL,
    "region" TEXT,
    "accountable_contact" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Asset" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Asset_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "AssetType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ServiceRequest_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "field_changed" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    CONSTRAINT "AuditLog_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "ServiceRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "User_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_location_code_key" ON "Location"("location_code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_code_key" ON "AssetType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_asset_id_key" ON "Asset"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serial_number_key" ON "Asset"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_request_id_key" ON "ServiceRequest"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
