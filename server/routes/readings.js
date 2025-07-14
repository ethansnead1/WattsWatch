import express from 'express';
import jwt from 'jsonwebtoken';
import Reading from '../models/Reading.js';
import pdfkit from 'pdfkit';
import { generateLineChart } from '../utils/chartGenerator.js';
import dayjs from 'dayjs';

const router = express.Router();

// Middleware to verify JWT and attach user ID
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

router.get('/readings/latest', authenticate, async (req, res) => {
  try {
    const latest = await Reading.findOne({ userId: req.userId }).sort({ timestamp: -1 });
    res.json(latest);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch latest reading', error: err.message });
  }
});

router.get('/download', authenticate, async (req, res) => {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);

    const readings = await Reading.find({
      userId: req.userId,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 });

    if (readings.length === 0) {
      return res.status(404).json({ message: 'No readings found in the last 30 days' });
    }

    const phases = ['P1', 'P2', 'P3'];
    const dailyPeaks = {};
    const allTime = {
      voltage: { P1: 0, P2: 0, P3: 0 },
      current: { P1: 0, P2: 0, P3: 0 },
      power: { P1: 0, P2: 0, P3: 0 },
      L1L2: 0, L1L3: 0, L2L3: 0
    };

    for (const r of readings) {
      const date = dayjs(r.timestamp).format('YYYY-MM-DD');
      if (!dailyPeaks[date]) {
        dailyPeaks[date] = {
          voltage: { P1: 0, P2: 0, P3: 0 },
          current: { P1: 0, P2: 0, P3: 0 },
          power: { P1: 0, P2: 0, P3: 0 },
          L1L2: 0, L1L3: 0, L2L3: 0
        };
      }

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

    const doc = new pdfkit({ margin: 50 });
    res.setHeader('Content-Disposition', 'attachment; filename=wattswatch_report.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const dates = Object.keys(dailyPeaks);

    doc.fontSize(20).text('WattsWatch 30-Day Report', { align: 'center' }).moveDown();

    const chartDefs = [
      { field: 'voltage', label: 'Voltage', color: 'blue' },
      { field: 'current', label: 'Current', color: 'green' },
      { field: 'power', label: 'Power', color: 'red' },
    ];

    for (const { field, label, color } of chartDefs) {
      for (let i = 0; i < 3; i += 2) {
        doc.addPage();
        for (let j = 0; j < 2; j++) {
          if (i + j < 3) {
            const p = phases[i + j];
            const values = dates.map(d => dailyPeaks[d][field][p]);
            const chart = await generateLineChart({
              labels: dates,
              data: values,
              label: `${label} ${p}`,
              color
            });
            doc.fontSize(16).text(`${label} ${p}`, { align: 'center' });
            doc.image(chart, { width: 450 });
            doc.moveDown();
          }
        }
      }
      // Third graph alone on new page
      const p = phases[2];
      const values = dates.map(d => dailyPeaks[d][field][p]);
      const chart = await generateLineChart({
        labels: dates,
        data: values,
        label: `${label} ${p}`,
        color
      });
      doc.addPage();
      doc.fontSize(16).text(`${label} ${p}`, { align: 'center' });
      doc.image(chart, { width: 450 });
      doc.moveDown();
    }

    // Line-to-Line graphs
    const lineVoltages = ['L1L2', 'L1L3', 'L2L3'];
    const colors = ['purple', 'orange', 'teal'];

    for (let i = 0; i < lineVoltages.length; i++) {
      const label = `Voltage ${lineVoltages[i].replace('L', 'L–')}`;
      const data = dates.map(d => dailyPeaks[d][lineVoltages[i]]);
      const chart = await generateLineChart({
        labels: dates,
        data,
        label,
        color: colors[i]
      });
      doc.addPage();
      doc.fontSize(16).text(label, { align: 'center' });
      doc.image(chart, { width: 450 }).moveDown();
    }

    // Daily peaks table
    doc.addPage();
    doc.fontSize(16).text('📊 Daily Peak Summary', { align: 'center' }).moveDown(0.5);

    doc.fontSize(10);
    for (const d of dates) {
      doc.text(`${d}`, { underline: true });
      for (const p of phases) {
        doc.text(
          `  Phase ${p[1]}: V = ${dailyPeaks[d].voltage[p]} V | A = ${dailyPeaks[d].current[p]} A | W = ${dailyPeaks[d].power[p]} W`
        );
      }
      doc.text(
        `  L1–L2: ${dailyPeaks[d].L1L2} V | L1–L3: ${dailyPeaks[d].L1L3} V | L2–L3: ${dailyPeaks[d].L2L3} V`
      ).moveDown();
    }

    // All-time peak summary table
    doc.addPage();
    doc.fontSize(16).text('🏆 All-Time Peak Summary', { align: 'center' }).moveDown(0.5);
    for (const p of phases) {
      doc.text(
        `Phase ${p[1]}: V = ${allTime.voltage[p]} V | A = ${allTime.current[p]} A | W = ${allTime.power[p]} W`
      );
    }
    doc.text(`L1–L2: ${allTime.L1L2} V`);
    doc.text(`L1–L3: ${allTime.L1L3} V`);
    doc.text(`L2–L3: ${allTime.L2L3} V`);

    doc.end();
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    res.status(500).json({ message: 'Error generating PDF', error: err.message });
  }
});

export default router;
