/**
 * Password Migration Script
 * Migrates existing SHA-256 password hashes to bcrypt
 * 
 * Usage: pnpm ts-node scripts/migrate-passwords.ts
 * 
 * This script:
 * 1. Finds all users with SHA-256 hashed passwords
 * 2. Prompts for new password or generates a temporary one
 * 3. Hashes with bcrypt and updates the database
 * 
 * IMPORTANT: Users will need to reset their passwords after migration
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import * as readline from 'readline';

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

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function migratePasswords() {
  console.log('🔐 Password Migration Script');
  console.log('============================\n');

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

  console.log('\n⚠️  IMPORTANT: After migration, users will need to reset their passwords.');
  const confirm = await askQuestion('\nContinue with migration? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    await prisma.$disconnect();
    return;
  }

  const migrationMode = await askQuestion(
    '\nMigration mode:\n  1. Set temporary passwords (users must reset)\n  2. Prompt for new password for each user\n  3. Skip migration (just mark for reset)\n\nEnter choice (1/2/3): '
  );

  let migrated = 0;
  let skipped = 0;

  for (const user of usersWithOldHashes) {
    console.log(`\nProcessing: ${user.email}`);

    let newPassword: string | null = null;

    if (migrationMode === '1') {
      // Generate temporary password
      newPassword = generateTempPassword();
      console.log(`  Generated temporary password: ${newPassword}`);
      console.log('  ⚠️  User must reset password on next login');
    } else if (migrationMode === '2') {
      // Prompt for new password
      const password = await askQuestion(`  Enter new password for ${user.email}: `);
      if (password && password.length >= 8) {
        newPassword = password;
      } else {
        console.log('  ⚠️  Password too short, skipping...');
        skipped++;
        continue;
      }
    } else {
      // Skip migration - just mark for reset
      console.log('  ⚠️  Skipping - user must reset password');
      skipped++;
      continue;
    }

    if (newPassword) {
      // Hash with bcrypt
      const bcryptHash = await bcrypt.hash(newPassword, 12);

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: bcryptHash },
      });

      console.log(`  ✅ Password migrated successfully`);
      migrated++;

      // If temporary password was generated, log it
      if (migrationMode === '1') {
        console.log(`  📝 Temporary password: ${newPassword}`);
      }
    }
  }

  console.log('\n============================');
  console.log(`✅ Migration complete!`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log('\n⚠️  Next steps:');
  console.log('   1. Notify users to reset their passwords');
  console.log('   2. If temporary passwords were generated, send them securely');
  console.log('   3. Consider implementing a password reset flow');

  await prisma.$disconnect();
}

migratePasswords().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
