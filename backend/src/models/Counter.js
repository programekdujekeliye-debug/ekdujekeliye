import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, {
  collection: 'counter'
});

export const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

export const getNextSequence = async (name) => {
  const result = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
};
