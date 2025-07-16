import mongoose from 'mongoose';

const savedReadingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voltageP1: Number,
  currentP1: Number,
  powerP1: Number,
  voltageP2: Number,
  currentP2: Number,
  powerP2: Number,
  voltageP3: Number,
  currentP3: Number,
  powerP3: Number,
  voltageL1L2: Number,
  voltageL1L3: Number,
  voltageL2L3: Number,
  timestamp: Date
});



export default mongoose.model('SavedReading', savedReadingSchema);
