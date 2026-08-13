import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import assetTypeRoutes from './routes/assetTypes.js';
import locationRoutes from './routes/locations.js';
import serviceRequestRoutes from './routes/serviceRequests.js';
import dashboardRoutes from './routes/dashboard.js';
import auditRoutes from './routes/auditLogs.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/asset-types', assetTypeRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'UPSO-1 Inventory API' });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
