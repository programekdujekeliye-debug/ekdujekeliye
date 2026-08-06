import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const sub = await mongoose.connection.db.collection('submission').findOne({ inquiryId: 'CPL-617' });
  console.log("Submission details:", sub);
  
  if (sub && sub.programId) {
    const prog = await mongoose.connection.db.collection('program').findOne({ id: sub.programId });
    console.log("Program details:", prog);
  }
  
  await mongoose.disconnect();
}

check();
