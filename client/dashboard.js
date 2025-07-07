const token = localStorage.getItem("token");

if (!token) {
  alert("Please log in first.");
  window.location.href = "index.html";
}

let mode = "1-phase"; // default mode
let peakVoltages = {};
let peakCurrents = {};
let peakPowers = {};

const updateDashboard = async () => {
  try {
    const response = await fetch("/api/readings/latest", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return console.error("Failed to fetch latest reading");
    const data = await response.json();

    const fields = [
      "voltageP1", "currentP1", "powerP1",
      "voltageP2", "currentP2", "powerP2",
      "voltageP3", "currentP3", "powerP3",
      "voltageL1L2", "voltageL1L3", "voltageL2L3"
    ];

    fields.forEach((field) => {
      const el = document.getElementById(field);
      if (el && data[field] !== undefined) {
        const unit = field.includes("voltage") ? "V" :
                     field.includes("current") ? "A" : "W";
        el.textContent = `${parseFloat(data[field]).toFixed(2)} ${unit}`;

        // Track peak values (if needed later)
        const peakKey = field;
        if (!peakVoltages[peakKey]) peakVoltages[peakKey] = 0;
        if (parseFloat(data[field]) > peakVoltages[peakKey]) {
          peakVoltages[peakKey] = parseFloat(data[field]);
        }
      }
    });

  } catch (err) {
    console.error("Dashboard fetch error:", err);
  }
};

// === Phase Toggle Logic ===
document.getElementById("phaseToggleBtn").addEventListener("click", () => {
  if (mode === "1-phase") {
    mode = "3-phase";
    document.getElementById("phase3Row").style.display = "block";
    document.getElementById("voltageL1L3Wrapper").style.display = "flex";
    document.getElementById("voltageL2L3Wrapper").style.display = "flex";
    document.getElementById("phaseToggleBtn").textContent = "Switch to 1-Phase";
  } else {
    mode = "1-phase";
    document.getElementById("phase3Row").style.display = "none";
    document.getElementById("voltageL2L3Wrapper").style.display = "none";
    document.getElementById("voltageL1L3Wrapper").style.display = "none"; // Reset L2-L3 voltage
    document.getElementById("phaseToggleBtn").textContent = "Switch to 3-Phase";
  }
});

// === Live Refresh ===
updateDashboard();
setInterval(updateDashboard, 15000);

// === Logout Button ===
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
});

// === Optional: Download PDF (if implemented) ===
async function downloadPDF() {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch("/api/download", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to download PDF");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "wattswatch_report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

  } catch (err) {
    console.error("PDF download failed:", err);
    alert("Could not download PDF. Check the console.");
  }
}
