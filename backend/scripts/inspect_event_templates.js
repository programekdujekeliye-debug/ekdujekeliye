import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import { MongoClient } from 'mongodb';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  const client = new MongoClient(prodUri, { family: 4 });
  await client.connect();
  const db = client.db('ekdujekeliye');

  console.log('=== INSPECTING EVENT INVITATION TEMPLATES ===\n');

  const events = await db.collection('program').find({}).toArray();

  for (const e of events) {
    console.log(`Event ID: ${e.id} | Slug: ${e.slug} | Name: ${e.name} | Date: ${e.date}`);
    console.log(`  cardTemplate type/length: ${typeof e.cardTemplate} (Length: ${e.cardTemplate?.length || 0})`);
    if (typeof e.cardTemplate === 'string') {
      console.log(`  cardTemplate preview: ${e.cardTemplate.substring(0, 80)}...`);
    }
    console.log(`  flyerImage: ${e.flyerImage?.substring(0, 80)}`);
    console.log(`  heartX: ${e.heartX}, heartY: ${e.heartY}, heartWidth: ${e.heartWidth}, heartHeight: ${e.heartHeight}\n`);
  }

  await client.close();
  process.exit(0);
}

main().catch(console.error);
