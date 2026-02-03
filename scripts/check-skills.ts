import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Searching for skills...\n');

  // Search for skills with "formatter" or "document" in the name
  const skills = await prisma.skill.findMany({
    where: {
      OR: [
        { name: { contains: 'formatter', mode: 'insensitive' } },
        { name: { contains: 'document', mode: 'insensitive' } },
        { description: { contains: 'format', mode: 'insensitive' } },
      ],
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      versions: {
        orderBy: { version: 'desc' },
        include: {
          metadata: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${skills.length} skill(s):\n`);

  for (const skill of skills) {
    console.log(`📋 Skill: ${skill.name}`);
    console.log(`   ID: ${skill.id}`);
    console.log(`   Status: ${skill.status}`);
    console.log(`   Category: ${skill.category || 'N/A'}`);
    console.log(`   Owner: ${skill.owner.name} (${skill.owner.email})`);
    console.log(`   Visibility: ${skill.visibility}`);
    console.log(`   Versions: ${skill.versions.length}`);
    
    if (skill.versions.length > 0) {
      const latestVersion = skill.versions[0];
      if (latestVersion) {
        console.log(`   Latest Version: ${latestVersion.version} (${latestVersion.status})`);
        
        // Check for variables in content
        const variablePattern = /\{\{(\w+)\}\}/g;
        const variables = new Set<string>();
        let match;
        const content = latestVersion.content || '';
        while ((match = variablePattern.exec(content)) !== null) {
          if (match[1]) {
            variables.add(match[1]);
          }
        }
        
        if (variables.size > 0) {
          console.log(`   Variables found: ${Array.from(variables).join(', ')}`);
        } else {
          console.log(`   Variables found: none`);
        }
        
        // Show first 200 chars of content
        const contentPreview = content ? content.substring(0, 200) : '(no content)';
        console.log(`   Content preview: ${contentPreview}${content && content.length > 200 ? '...' : ''}`);
      }
    }
    
    console.log('');
  }

  // Also list all skills to see what's there
  console.log('\n📊 All skills in database:\n');
  const allSkills = await prisma.skill.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      category: true,
      owner: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const skill of allSkills) {
    console.log(`- ${skill.name} (${skill.status}) - ${skill.category || 'No category'} - Owner: ${skill.owner.email}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
