import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const statuses = await mongoose.connection.db.collection('submission').aggregate([
    { $match: { programId: 'prog-1785566789678' } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  
  console.log("Statuses count:", statuses);
  
  await mongoose.disconnect();
}

check();
