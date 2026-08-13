import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

async function run() {
  // Seed Administrator
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const adminLocation = await prisma.location.findFirst({ where: { location_code: '1400' } });
  if (!adminLocation) {
    console.error('Location UPSO-1 not found. Run import first.');
    process.exit(1);
  }
  await prisma.user.upsert({
    where: { email: 'admin@upso1.in' },
    update: { name: 'Administrator', password: adminPassword, role: 'Administrator', location_id: adminLocation.id },
    create: { name: 'Administrator', email: 'admin@upso1.in', password: adminPassword, role: 'Administrator', location_id: adminLocation.id },
  });
  console.log('Seeded admin user: admin@upso1.in / Admin@123');

  // Seed SATYANSHU SINGH
  const userPassword = await bcrypt.hash('User@123', 10);
  const userLocation = await prisma.location.findFirst({ where: { location_code: '1449' } }); // Ambabai Depot
  if (!userLocation) {
    console.error('Location for Ambabai Depot (1449) not found. Run import first.');
    process.exit(1);
  }
  
  const satyanshu = await prisma.user.upsert({
    where: { email: 'satyanshu@upso1.in' },
    update: { name: 'SATYANSHU SINGH', password: userPassword, role: 'User', location_id: userLocation.id },
    create: { name: 'SATYANSHU SINGH', email: 'satyanshu@upso1.in', password: userPassword, role: 'User', location_id: userLocation.id },
  });
  console.log('Seeded user: satyanshu@upso1.in / User@123');

  // Associate assets where current_owner matches "SATYANSHU SINGH"
  const updatedAssets = await prisma.asset.updateMany({
    where: { current_owner: 'SATYANSHU SINGH' },
    data: { owner_user_id: satyanshu.id }
  });
  console.log(`Associated ${updatedAssets.count} assets to SATYANSHU SINGH (owner_user_id: ${satyanshu.id})`);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
