import mongoose from 'mongoose';

async function inspectProd() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  console.log('Connecting to Production MongoDB (ekdujekeliye)...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('Collections in prod:', collections.map(c => c.name));

  // Check programs & events
  for (const colName of ['programs', 'program', 'events', 'event']) {
    if (collections.some(c => c.name === colName)) {
      const items = await db.collection(colName).find({}).toArray();
      console.log(`\n=== Collection '${colName}' (Count: ${items.length}) ===`);
      items.forEach(p => {
        console.log({
          _id: p._id,
          id: p.id,
          sequenceNumber: p.sequenceNumber,
          name: p.name,
          slug: p.slug,
          date: p.date,
          time: p.time,
          venue: p.venue,
          price: p.price,
          status: p.status,
          isDateFinal: p.isDateFinal
        });
      });
    }
  }

  // Check submissions / registrations
  for (const colName of ['registrations', 'registration', 'submissions', 'submission']) {
    if (collections.some(c => c.name === colName)) {
      const count = await db.collection(colName).countDocuments({});
      console.log(`\n=== Collection '${colName}' (Total Count: ${count}) ===`);
      
      const summary = await db.collection(colName).aggregate([
        {
          $group: {
            _id: {
              programId: '$programId',
              programName: '$programName',
              programDate: '$programDate',
              programVenue: '$programVenue',
              isArchived: '$isArchived',
              isDeleted: '$isDeleted'
            },
            count: { $sum: 1 },
            sampleIds: { $push: '$inquiryId' }
          }
        }
      ]).toArray();

      summary.forEach(s => {
        console.log(JSON.stringify({
          group: s._id,
          count: s.count,
          sampleIds: s.sampleIds.slice(0, 5)
        }, null, 2));
      });
    }
  }

  // Check passes
  for (const colName of ['passes', 'pass']) {
    if (collections.some(c => c.name === colName)) {
      const count = await db.collection(colName).countDocuments({});
      console.log(`\n=== Collection '${colName}' (Total Count: ${count}) ===`);
      
      const summary = await db.collection(colName).aggregate([
        {
          $group: {
            _id: {
              eventId: '$eventId',
              programId: '$programId',
              eventDate: '$eventDate',
              eventVenue: '$eventVenue',
              eventName: '$eventName'
            },
            count: { $sum: 1 },
            samplePassIds: { $push: '$passId' }
          }
        }
      ]).toArray();

      summary.forEach(s => {
        console.log(JSON.stringify({
          group: s._id,
          count: s.count,
          samplePassIds: s.samplePassIds.slice(0, 5)
        }, null, 2));
      });
    }
  }

  process.exit(0);
}

inspectProd().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
