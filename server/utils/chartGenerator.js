import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const width = 600;
const height = 300;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

export async function generateLineChart({ labels, data, label, color }) {
  try {
    return await chartJSNodeCanvas.renderToBuffer({
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: color,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          x: { ticks: { maxRotation: 0 } },
          y: { beginAtZero: true },
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: 'black' },
          },
        },
      },
    });
  } catch (err) {
    console.error("❌ Chart rendering failed:", err);
    throw err;
  }
}
