import express from 'express';
import jwt from 'jsonwebtoken';
import Reading from '../models/Reading.js';
import SavedReading from '../models/SavedReading.js';
import pdf from 'pdfkit';
import { generateLineChart } from '../utils/chartGenerator.js';
import dayjs from 'dayjs';


const router = express.Router();

// Route: Accept readings from ESP32
router.post('/readings', async (req, res) => {
  try {
    const {
      userId,
      voltageP1, currentP1, powerP1,
      voltageP2, currentP2, powerP2,
      voltageP3, currentP3, powerP3,
      voltageL1L2, voltageL1L3, voltageL2L3,
      timestamp
    } = req.body;

    const reading = new Reading({
      userId,
      voltageP1, currentP1, powerP1,
      voltageP2, currentP2, powerP2,
      voltageP3, currentP3, powerP3,
      voltageL1L2, voltageL1L3, voltageL2L3,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await reading.save();
    res.status(201).json({ message: 'Reading saved successfully' });
  } catch (err) {
    console.error("❌ Error saving ESP32 reading:", err);
    res.status(500).json({ message: 'Failed to save reading' });
  }
});

// Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

// Route: Accept 15-min peak readings from ESP32
router.post('/savedReadings', async (req, res) => {
  try {
    const {
      userId,
      voltageP1, currentP1, powerP1,
      voltageP2, currentP2, powerP2,
      voltageP3, currentP3, powerP3,
      voltageL1L2, voltageL1L3, voltageL2L3,
      timestamp
    } = req.body;

    const reading = new SavedReading({
      userId,
      voltageP1, currentP1, powerP1,
      voltageP2, currentP2, powerP2,
      voltageP3, currentP3, powerP3,
      voltageL1L2, voltageL1L3, voltageL2L3,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await reading.save();
    res.status(201).json({ message: '15-Min Peak Reading saved successfully' });
  } catch (err) {
    console.error("❌ Error saving ESP32 reading:", err);
    res.status(500).json({ message: 'Failed to save reading' });
  }
});

// Route: Get all readings
router.get('/readings', authenticate, async (req, res) => {
  try {
    const readings = await Reading.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching readings' });
  }
});

// Route: Get all readings
router.get('/savedReadings', authenticate, async (req, res) => {
  try {
    const readings = await SavedReading.find({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching readings' });
  }
});

// Route: Get latest reading
router.get('/readings/latest', authenticate, async (req, res) => {
  try {
    const latest = await Reading.findOne({ userId: req.userId }).sort({ timestamp: -1 });
    console.log("📡 latest reading:", latest);
    if (!latest) return res.status(404).json({ message: "No readings found." });
    res.json(latest);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reading", error: err.message });
  }
});

// Route: Download PDF report
router.get('/download', authenticate, async (req, res) => {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);

   
    const savedReadings = await SavedReading.find({ userId: req.userId, timestamp: { $gte: start, $lte: end } }).sort({ timestamp: 1 });

    if (savedReadings.length === 0) return res.status(404).json({ message: 'No readings found in last 30 days' });

    const phases = ['P1', 'P2', 'P3'];
    const dailyPeaks = {};
    const allTime = { voltage: { P1: 0, P2: 0, P3: 0 }, current: { P1: 0, P2: 0, P3: 0 }, power: { P1: 0, P2: 0, P3: 0 }, L1L2: 0, L1L3: 0, L2L3: 0 };

    for (const r of savedReadings) {
      const date = dayjs(r.timestamp).format('YYYY-MM-DD');
      if (!dailyPeaks[date]) dailyPeaks[date] = { voltage: { P1: 0, P2: 0, P3: 0 }, current: { P1: 0, P2: 0, P3: 0 }, power: { P1: 0, P2: 0, P3: 0 }, L1L2: 0, L1L3: 0, L2L3: 0 };
      for (const p of phases) {
        const v = r[`voltage${p}`] ?? 0;
        const c = r[`current${p}`] ?? 0;
        const w = r[`power${p}`] ?? 0;
        dailyPeaks[date].voltage[p] = Math.max(dailyPeaks[date].voltage[p], v);
        dailyPeaks[date].current[p] = Math.max(dailyPeaks[date].current[p], c);
        dailyPeaks[date].power[p] = Math.max(dailyPeaks[date].power[p], w);
        allTime.voltage[p] = Math.max(allTime.voltage[p], v);
        allTime.current[p] = Math.max(allTime.current[p], c);
        allTime.power[p] = Math.max(allTime.power[p], w);
      }
      dailyPeaks[date].L1L2 = Math.max(dailyPeaks[date].L1L2, r.voltageL1L2 ?? 0);
      dailyPeaks[date].L1L3 = Math.max(dailyPeaks[date].L1L3, r.voltageL1L3 ?? 0);
      dailyPeaks[date].L2L3 = Math.max(dailyPeaks[date].L2L3, r.voltageL2L3 ?? 0);
      allTime.L1L2 = Math.max(allTime.L1L2, r.voltageL1L2 ?? 0);
      allTime.L1L3 = Math.max(allTime.L1L3, r.voltageL1L3 ?? 0);
      allTime.L2L3 = Math.max(allTime.L2L3, r.voltageL2L3 ?? 0);
    }

    const dates = Object.keys(dailyPeaks);
    const doc = new pdf();
    res.setHeader('Content-Disposition', 'attachment; filename=wattswatch_report.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).text('WattsWatch NEC 30-Day Report', { align: 'center' });
    doc.fontSize(12).text(`Generated on: ${dayjs().format('MMMM D, YYYY')}`, { align: 'center' }).moveDown();
    doc.fontSize(16).text('All-Time Peak Values (Last 30 Days)', { align: 'center' }).moveDown();
    for (const p of phases) doc.fontSize(12).text(`Phase ${p[1]} → Max V: ${allTime.voltage[p]} V | Max A: ${allTime.current[p]} A | Max W: ${allTime.power[p]} W`);
    doc.moveDown();
    doc.text(`Line Voltages → L1–L2: ${allTime.L1L2} V | L1–L3: ${allTime.L1L3} V | L2–L3: ${allTime.L2L3} V`);
    // Calculate All-Time Peaks (Ever)
const allReadings = await SavedReading.find({ userId: req.userId });

const allTimeEver = {
  voltage: { P1: 0, P2: 0, P3: 0 },
  current: { P1: 0, P2: 0, P3: 0 },
  power: { P1: 0, P2: 0, P3: 0 },
  L1L2: 0,
  L1L3: 0,
  L2L3: 0
};

for (const r of allReadings) {
  for (const p of phases) {
    allTimeEver.voltage[p] = Math.max(allTimeEver.voltage[p], r[`voltage${p}`] ?? 0);
    allTimeEver.current[p] = Math.max(allTimeEver.current[p], r[`current${p}`] ?? 0);
    allTimeEver.power[p]   = Math.max(allTimeEver.power[p], r[`power${p}`] ?? 0);
  }
  allTimeEver.L1L2 = Math.max(allTimeEver.L1L2, r.voltageL1L2 ?? 0);
  allTimeEver.L1L3 = Math.max(allTimeEver.L1L3, r.voltageL1L3 ?? 0);
  allTimeEver.L2L3 = Math.max(allTimeEver.L2L3, r.voltageL2L3 ?? 0);
}

// Add to PDF below 30-day peaks
doc.moveDown();
doc.fontSize(16).text('All-Time Peak Values (Ever)', { align: 'center' }).moveDown();

for (const p of phases) {
  doc.fontSize(12).text(
    `Phase ${p[1]} → Max V: ${allTimeEver.voltage[p]} V | Max A: ${allTimeEver.current[p]} A | Max W: ${allTimeEver.power[p]} W`
  );
}
doc.moveDown();
doc.text(`Line Voltages → L1–L2: ${allTimeEver.L1L2} V | L1–L3: ${allTimeEver.L1L3} V | L2–L3: ${allTimeEver.L2L3} V`);

    doc.addPage();

    // Voltage, Current, Power Charts (1 page each)
    for (const { field, label, color } of [
      { field: 'voltage', label: 'Voltage', color: 'blue' },
      { field: 'current', label: 'Current', color: 'green' },
      { field: 'power', label: 'Power', color: 'red' },
    ]) {
      doc.fontSize(16).text(`${label} (P1–P3)`, { align: 'center' }).moveDown();
      for (const p of phases) {
        const values = dates.map(d => dailyPeaks[d][field][p]);
        const chart = await generateLineChart({ labels: dates, data: values, label: `${label} ${p}`, color });
        doc.image(chart, { width: 400 }).moveDown();
      }
      doc.addPage();
    }

    // Line-to-Line Voltage Charts (all on one page)
    const linePairs = [
      { key: 'L1L2', label: 'Voltage L1–L2', color: 'purple' },
      { key: 'L1L3', label: 'Voltage L1–L3', color: 'orange' },
      { key: 'L2L3', label: 'Voltage L2–L3', color: 'teal' },
    ];
    doc.fontSize(16).text('Line-to-Line Voltage', { align: 'center' }).moveDown();
    for (const { key, label, color } of linePairs) {
      const data = dates.map(d => dailyPeaks[d][key]);
      const chart = await generateLineChart({ labels: dates, data, label, color });
      doc.image(chart, { width: 400 }).moveDown();
    }
    doc.addPage();

    // Daily Peak Summary Table (Keep original format)
    doc.fontSize(16).text('Daily Peaks Summary', { align: 'center' });
    doc.moveDown();
    for (const d of dates) {
      doc.fontSize(12).text(`${d}`);
      for (const p of phases) doc.text(`  Phase ${p[1]} → V: ${dailyPeaks[d].voltage[p]} V | A: ${dailyPeaks[d].current[p]} A | W: ${dailyPeaks[d].power[p]} W`);
      doc.text(`  L1–L2: ${dailyPeaks[d].L1L2} V | L1–L3: ${dailyPeaks[d].L1L3} V | L2–L3: ${dailyPeaks[d].L2L3} V`).moveDown();
    }
    doc.addPage();

    // 15-Minute Peak Readings (paginate if needed)
    doc.fontSize(16).text('15-Minute Peak Readings (Last 30 Days)', { align: 'center' }).moveDown();
    let count = 0;
    for (const r of savedReadings) {
      const time = dayjs(r.timestamp).format('YYYY-MM-DD HH:mm');
      doc.fontSize(10).text(`${time} → P1: V=${r.voltageP1}V, A=${r.currentP1}A, W=${r.powerP1}W | P2: V=${r.voltageP2}V, A=${r.currentP2}A, W=${r.powerP2}W | P3: V=${r.voltageP3}V, A=${r.currentP3}A, W=${r.powerP3}W | L1–L2: ${r.voltageL1L2}V | L1–L3: ${r.voltageL1L3}V | L2–L3: ${r.voltageL2L3}V`).moveDown(0.5);
      count++;
      if (count % 40 === 0) doc.addPage();
    }

    doc.end();
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    res.status(500).json({ message: 'Error generating PDF', error: err.message });
  }
});

export default router;
