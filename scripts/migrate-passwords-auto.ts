/**
 * Password Migration Script (Non-Interactive)
 * Automatically migrates existing SHA-256 password hashes to bcrypt
 * Generates temporary passwords that users must reset
 * 
 * Usage: pnpm ts-node scripts/migrate-passwords-auto.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Old password hashing function (for verification)
function oldHashPassword(password: string): string {
  return createHash('sha256')
    .update(password + 'skills-library-salt')
    .digest('hex');
}

// Check if hash is old SHA-256 format (64 hex characters)
function isOldHash(hash: string | null): boolean {
  if (!hash) return false;
  return /^[a-f0-9]{64}$/i.test(hash);
}

// Generate a secure random password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function migratePasswords() {
  console.log('🔐 Password Migration Script (Auto Mode)');
  console.log('==========================================\n');

  // Find all users with old password hashes
  const users = await prisma.user.findMany({
    where: {
      passwordHash: { not: null },
      authProvider: 'LOCAL',
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  const usersWithOldHashes = users.filter((user) => isOldHash(user.passwordHash));

  if (usersWithOldHashes.length === 0) {
    console.log('✅ No users with old password hashes found. Migration not needed.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${usersWithOldHashes.length} user(s) with old password hashes:\n`);
  usersWithOldHashes.forEach((user) => {
    console.log(`  - ${user.email} (${user.name || 'No name'})`);
  });

  console.log('\n⚠️  IMPORTANT: Temporary passwords will be generated.');
  console.log('   Users MUST reset their passwords on next login.\n');

  let migrated = 0;
  const tempPasswords: Array<{ email: string; password: string }> = [];

  for (const user of usersWithOldHashes) {
    console.log(`Processing: ${user.email}`);

    // Generate temporary password
    const newPassword = generateTempPassword();

    // Hash with bcrypt
    const bcryptHash = await bcrypt.hash(newPassword, 12);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcryptHash },
    });

    console.log(`  ✅ Password migrated successfully`);
    migrated++;
    tempPasswords.push({ email: user.email, password: newPassword });
  }

  console.log('\n==========================================');
  console.log(`✅ Migration complete!`);
  console.log(`   Migrated: ${migrated} user(s)\n`);

  if (tempPasswords.length > 0) {
    console.log('📝 Temporary Passwords (SAVE THESE SECURELY):');
    console.log('==========================================\n');
    tempPasswords.forEach(({ email, password }) => {
      console.log(`Email: ${email}`);
      console.log(`Temp Password: ${password}`);
      console.log('');
    });
    console.log('⚠️  IMPORTANT:');
    console.log('   1. Send these passwords to users securely');
    console.log('   2. Users MUST reset their passwords on next login');
    console.log('   3. Consider implementing a password reset flow');
    console.log('   4. Delete this output after saving passwords securely\n');
  }

  await prisma.$disconnect();
}

migratePasswords().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
