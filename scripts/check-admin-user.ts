import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  console.log('🔍 Checking admin user...\n');

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@puzzel.com';
  
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.log('❌ Admin user not found!');
    return;
  }

  console.log(`✅ User found: ${user.email}`);
  console.log(`   Name: ${user.name || 'N/A'}`);
  console.log(`   Has password: ${user.passwordHash ? 'Yes' : 'No'}`);
  console.log(`   Roles count: ${user.roles.length}\n`);

  if (user.roles.length === 0) {
    console.log('❌ PROBLEM: User has NO roles assigned!');
    console.log('   This will cause login to fail.\n');
    
    // Check if admin role exists
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    if (adminRole) {
      console.log('✅ Admin role exists in database');
      console.log('   Fix: Run the seed script to assign roles: pnpm db:seed');
    } else {
      console.log('❌ Admin role does NOT exist in database');
      console.log('   Fix: Run the seed script: pnpm db:seed');
    }
    return;
  }

  console.log('📋 Roles:');
  const permissionSet = new Set<string>();
  
  for (const userRole of user.roles) {
    const role = userRole.role;
    console.log(`   - ${role.name}`);
    
    for (const rolePerm of role.permissions) {
      permissionSet.add(rolePerm.permission.name);
    }
  }

  console.log(`\n📋 Total Permissions: ${permissionSet.size}`);
  
  // Check for workspace permissions
  const workspacePerms = Array.from(permissionSet).filter(p => p.startsWith('workspaces:'));
  if (workspacePerms.length > 0) {
    console.log(`\n✅ Workspace permissions found:`);
    workspacePerms.forEach(p => console.log(`   - ${p}`));
  } else {
    console.log(`\n⚠️  No workspace permissions found!`);
    console.log('   This means the "Workspaces" nav item won\'t appear.');
    console.log('   Fix: Run the seed script: pnpm db:seed');
  }

  await prisma.$disconnect();
}

checkAdminUser().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
