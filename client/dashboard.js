const token = localStorage.getItem("token");

if (!token) {
  alert("Please log in first.");
  window.location.href = "index.html";
}

const API_URL = window.location.origin.includes("localhost")
  ? "http://localhost:5000"
  : "https://wattswatch.onrender.com";

let mode = "1-phase"; // default mode
let peakVoltages = {};
let peakCurrents = {};
let peakPowers = {};

const updateDashboard = async () => {
  try {
    const response = await fetch("https://wattswatch.onrender.com/api/readings/latest", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch latest reading", await response.text());
      return;
    }

    const data = await response.json();

    const fields = [
      "voltageP1", "currentP1", "powerP1",
      "voltageP2", "currentP2", "powerP2",
      "voltageP3", "currentP3", "powerP3",
      "voltageL1L2", "voltageL1L3", "voltageL2L3"
    ];

    fields.forEach((field) => {
      const el = document.getElementById(field);
      if (el && data[field] !== undefined && !isNaN(data[field])) {
        const unit = field.includes("voltage") ? "V" :
                     field.includes("current") ? "A" : "W";
        el.textContent = `${parseFloat(data[field]).toFixed(2)} ${unit}`;

        if (!peakVoltages[field]) peakVoltages[field] = 0;
        if (parseFloat(data[field]) > peakVoltages[field]) {
          peakVoltages[field] = parseFloat(data[field]);
        }
      } else if (el) {
        el.textContent = `0`;
      }
    });

  } catch (err) {
    console.error("Dashboard fetch error:", err);
  }
};

// === Phase Toggle Logic ===
document.getElementById("phaseToggleBtn")?.addEventListener("click", () => {
  if (mode === "1-phase") {
    mode = "3-phase";
    document.getElementById("phase3Row").style.display = "flex";
    document.getElementById("voltageL1L3Wrapper").style.display = "flex";
    document.getElementById("voltageL2L3Wrapper").style.display = "flex";
    document.getElementById("phaseToggleBtn").textContent = "Switch to 1-Phase";
  } else {
    mode = "1-phase";
    document.getElementById("phase3Row").style.display = "none";
    document.getElementById("voltageL1L3Wrapper").style.display = "none";
    document.getElementById("voltageL2L3Wrapper").style.display = "none";
    document.getElementById("phaseToggleBtn").textContent = "Switch to 3-Phase";
  }
});

// === Live Refresh ===
updateDashboard();
setInterval(updateDashboard, 5000);

// === Logout Button ===
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "index.html";
});

// === PDF Download ===
async function downloadPDF() {
  try {
    const response = await fetch(`${API_URL}/api/download`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const contentType = response.headers.get("Content-Type");
    if (!response.ok || !contentType.includes("application/pdf")) {
      const errorText = await response.text();
      console.error("📄 PDF Download Error:", errorText);
      alert("PDF generation failed. Check the console.");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "wattswatch_report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log("✅ PDF downloaded successfully!");
  } catch (err) {
    console.error("❌ PDF download failed:", err);
    alert("Could not download PDF. Check the console.");
  }
}
