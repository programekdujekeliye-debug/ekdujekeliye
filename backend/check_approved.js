import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const approved = await mongoose.connection.db.collection('submission')
    .find({ programId: 'prog-1785566789678', status: 'approved' })
    .project({ inquiryId: 1, husbandName: 1, wifeName: 1, updatedAt: 1 })
    .toArray();
    
  console.log(`Approved submissions (${approved.length}):`);
  console.log(approved);
  
  await mongoose.disconnect();
}

check();
