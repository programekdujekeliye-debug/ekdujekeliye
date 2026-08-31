import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String },
  seq: { type: Number, default: 0 }
}, {
  collection: 'counter',
  autoIndex: false
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

export const getNextSequence = async (name) => {
  const cleanName = String(name).trim();
  try {
    const result = await Counter.findOneAndUpdate(
      { $or: [{ _id: cleanName }, { name: cleanName }] },
      {
        $inc: { seq: 1 },
        $set: { name: cleanName }
      },
      { returnDocument: 'after', upsert: true }
    );
    return result.seq;
  } catch (err) {
    // If legacy unique index 'name_1' caused duplicate key error on null, drop the stale index and retry
    if (err.code === 11000 || String(err.message).includes('E11000') || String(err.message).includes('name_1')) {
      try {
        await Counter.collection.dropIndex('name_1');
      } catch (_) {}

      const retryResult = await Counter.findOneAndUpdate(
        { _id: cleanName },
        {
          $inc: { seq: 1 },
          $set: { name: cleanName }
        },
        { returnDocument: 'after', upsert: true }
      );
      return retryResult.seq;
    }

    throw err;
  }
};
