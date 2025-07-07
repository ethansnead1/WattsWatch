import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import readingRoutes from './routes/readings.js';

dotenv.config();

const app = express(); // ✅ Declare app FIRST
app.use(cors());
app.use(bodyParser.json());

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../client')));

// Register routes AFTER app is declared
app.use('/api', authRoutes);
app.use('/api', readingRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  app.listen(5000, () => console.log('Server running on port 5000'));
})
.catch(err => console.error(err));
