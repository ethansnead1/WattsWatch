import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reading from './models/Reading.js';

dotenv.config();

const userId = '6824fb69933fa6179d39e935';

const seedReadings = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const readings = [];

    // Generate 20 fake readings
    for (let i = 0; i < 20; i++) {
      readings.push({
        userId,
        voltage: (110 + Math.random() * 10).toFixed(2),
        current: (5 + Math.random() * 3).toFixed(2),
        power: (500 + Math.random() * 150).toFixed(2),
        timestamp: new Date(Date.now() - i * 15 * 60 * 1000) // 15 min intervals
      });
    }

    await Reading.insertMany(readings);
    console.log('✅ 20 fake readings inserted successfully!');
    process.exit();
  } catch (err) {
    console.error('❌ Error inserting readings:', err);
    process.exit(1);
  }
};

seedReadings();
