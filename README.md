# UPSO-1 Integrated IT Asset Inventory & Service Request Management System

This repository contains a full-stack web application for UPSO-1 IT asset inventory and service request management.

## Structure

- `/backend` - Node.js + Express backend with Prisma ORM
- `/frontend` - React + Vite frontend
- `Inventory Detail (1).xlsx` - legacy asset master file
- `Location code (2).xlsx` - location master file
- `ServiceRequestReport-639195597679312838 (2).xlsx` - sample service request export
- `image001.png`, `image002.png`, `image003.png` - reference screenshots

## Setup

### Backend

1. Open a terminal in `/backend`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run database migration and seed locations:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Run the import script:
   ```bash
   node scripts/import-data.js
   ```
5. Start backend server:
   ```bash
   npm run dev
   ```

### Frontend

1. Open a terminal in `/frontend`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start frontend dev server:
   ```bash
   npm run dev
   ```

## Notes

- The import script reads the provided Excel attachments and seeds the local database.
- Authentication is JWT-based with role-based access control.
- No hard deletes are allowed for assets or service requests.
