import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../uploads');

const prisma = new PrismaClient();

async function downloadImage(url, timeout = 5000) {
  try {
    const response = await axios.get(url, {
      timeout,
      responseType: 'arraybuffer',
      maxRedirects: 3,
    });

    const contentType = response.headers['content-type'] || '';
    
    if (!contentType.startsWith('image/')) {
      console.log(`Not an image: ${contentType}`);
      return null;
    }

    const contentLength = response.headers['content-length'];
    if (contentLength && parseInt(contentLength) < 10) {
      console.log('Image too small');
      return null;
    }

    const extension = contentType.includes('image/svg') ? 'svg' :
                     contentType.includes('image/png') ? 'png' :
                     contentType.includes('image/jpeg') || contentType.includes('image/jpg') ? 'jpg' :
                     'ico';

    const fileName = `${crypto.randomBytes(8).toString('hex')}_${Date.now()}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    fs.writeFileSync(filePath, Buffer.from(response.data));

    return `/uploads/${fileName}`;
  } catch (err) {
    console.error(`Download failed for ${url}:`, err.message);
    return null;
  }
}

async function migrateIcons() {
  console.log('Starting icon migration...\n');

  const sites = await prisma.site.findMany({
    where: {
      icon: {
        not: null,
      },
    },
  });

  console.log(`Found ${sites.length} sites with icons\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const site of sites) {
    if (!site.icon) {
      skipped++;
      continue;
    }

    if (site.icon.startsWith('/uploads/') || site.icon.startsWith('/api/')) {
      console.log(`[SKIP] ${site.title}: already local - ${site.icon}`);
      skipped++;
      continue;
    }

    if (site.icon.startsWith('http')) {
      console.log(`[MIGRATING] ${site.title}: ${site.icon}`);
      
      const localPath = await downloadImage(site.icon);
      
      if (localPath) {
        await prisma.site.update({
          where: { id: site.id },
          data: { 
            icon: localPath,
            iconType: 'auto'
          },
        });
        console.log(`  -> SUCCESS: ${localPath}`);
        migrated++;
      } else {
        console.log(`  -> FAILED`);
        failed++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`[SKIP] ${site.title}: unknown format - ${site.icon}`);
      skipped++;
    }
  }

  console.log('\n========================================');
  console.log(`Migration complete!`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Failed:   ${failed}`);
  console.log('========================================\n');

  await prisma.$disconnect();
}

migrateIcons().catch(console.error);
