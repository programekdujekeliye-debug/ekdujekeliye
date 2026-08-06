import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const prog = await mongoose.connection.db.collection('program').findOne({ id: 'prog-1785566789678' });
  console.log("Program details:", prog);
  
  const approvedCount = await mongoose.connection.db.collection('submission').countDocuments({
    programId: 'prog-1785566789678',
    status: 'approved'
  });
  console.log("Approved count in DB:", approvedCount);
  
  await mongoose.disconnect();
}

check();
