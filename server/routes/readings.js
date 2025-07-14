import PDFDocument from 'pdfkit';
import pkg from 'pdfkit-table';
const { Table } = pkg; 
import pdfTable from 'pdfkit-table';
import fs from 'fs';
import { generateLineChart } from '../utils/chartGenerator.js';
import Reading from '../models/Reading.js';
import dayjs from 'dayjs';
import express from 'express';
import jwt from 'jsonwebtoken';


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

// Route: Get all readings
router.get('/readings', authenticate, async (req, res) => {
  try {
    const readings = await Reading.find({ userId: req.userId }).sort({ timestamp: -1 });
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

// PDF Report
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

    const dayjs = await import('dayjs');
    const pdfkit = (await import('pdfkit')).default;
    const { generateLineChart } = await import('../utils/chartGenerator.js');
    const phases = ['P1', 'P2', 'P3'];
    const dailyPeaks = {};
    const allTime = {
      voltage: { P1: 0, P2: 0, P3: 0 },
      current: { P1: 0, P2: 0, P3: 0 },
      power: { P1: 0, P2: 0, P3: 0 },
      L1L2: 0, L1L3: 0, L2L3: 0
    };

    for (const r of readings) {
      const date = dayjs.default(r.timestamp).format('YYYY-MM-DD');
      dailyPeaks[date] ||= {
        voltage: { P1: 0, P2: 0, P3: 0 },
        current: { P1: 0, P2: 0, P3: 0 },
        power: { P1: 0, P2: 0, P3: 0 },
        L1L2: 0, L1L3: 0, L2L3: 0
      };
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
    const doc = new pdfkit();
    res.setHeader('Content-Disposition', 'attachment; filename=wattswatch_report.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).text('WattsWatch 30-Day Report', { align: 'center' }).moveDown();

    // Charts — 2 per page
    const chartDefs = [
      { field: 'voltage', label: 'Voltage', color: 'blue' },
      { field: 'current', label: 'Current', color: 'green' },
      { field: 'power', label: 'Power', color: 'red' }
    ];

    for (const { field, label, color } of chartDefs) {
      for (let i = 0; i < phases.length; i += 2) {
        const phase1 = phases[i];
        const phase2 = phases[i + 1];

        const values1 = dates.map(d => dailyPeaks[d][field][phase1]);
        const values2 = dates.map(d => dailyPeaks[d][field][phase2]);

        const chart1 = await generateLineChart({ labels: dates, data: values1, label: `${label} ${phase1}`, color });
        const chart2 = await generateLineChart({ labels: dates, data: values2, label: `${label} ${phase2}`, color });

        doc.addPage();
        doc.fontSize(16).text(`${label} ${phase1} & ${phase2}`, { align: 'center' });
        doc.image(chart1, 50, 80, { width: 240 });
        doc.image(chart2, 300, 80, { width: 240 });
      }

      // Third phase alone
      const phase3 = phases[2];
      const values3 = dates.map(d => dailyPeaks[d][field][phase3]);
      const chart3 = await generateLineChart({ labels: dates, data: values3, label: `${label} ${phase3}`, color });
      doc.addPage();
      doc.fontSize(16).text(`${label} ${phase3}`, { align: 'center' });
      doc.image(chart3, { width: 500 }).moveDown();
    }

    // === Line-to-Line Voltage Charts
    const lineData = [
      { key: 'L1L2', label: 'Voltage L1–L2', color: 'purple' },
      { key: 'L1L3', label: 'Voltage L1–L3', color: 'orange' },
      { key: 'L2L3', label: 'Voltage L2–L3', color: 'teal' },
    ];

    for (const { key, label, color } of lineData) {
      const chart = await generateLineChart({
        labels: dates,
        data: dates.map(d => dailyPeaks[d][key]),
        label,
        color,
      });
      doc.addPage();
      doc.fontSize(16).text(label, { align: 'center' });
      doc.image(chart, { width: 500 });
    }

    // === Daily Peaks Table
    doc.addPage();
    doc.fontSize(16).text('Daily Peaks Summary', { align: 'center' }).moveDown();
    doc.fontSize(12);
    doc.moveDown(0.5);
    doc.text("Date       | V(P1) | A(P1) | W(P1) || V(P2) | A(P2) | W(P2) || V(P3) | A(P3) | W(P3) || L1L2 | L1L3 | L2L3");
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    for (const date of dates) {
      const d = dailyPeaks[date];
      doc.text(`${date} | ${d.voltage.P1} | ${d.current.P1} | ${d.power.P1} || ${d.voltage.P2} | ${d.current.P2} | ${d.power.P2} || ${d.voltage.P3} | ${d.current.P3} | ${d.power.P3} || ${d.L1L2} | ${d.L1L3} | ${d.L2L3}`);
    }

    // === All Time Table
    doc.addPage().fontSize(16).text('All-Time Peaks Summary', { align: 'center' }).moveDown();
    for (const p of phases) {
      doc.fontSize(12).text(`Phase ${p}: Voltage: ${allTime.voltage[p]} V | Current: ${allTime.current[p]} A | Power: ${allTime.power[p]} W`);
    }
    doc.text(`L1–L2: ${allTime.L1L2} V`);
    doc.text(`L1–L3: ${allTime.L1L3} V`);
    doc.text(`L2–L3: ${allTime.L2L3} V`);

    doc.end();
  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating PDF', error: err.message });
    }
  }
});
export default router;
