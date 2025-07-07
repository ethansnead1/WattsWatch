// SIGNUP HANDLER
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("signupUsername").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  const response = await fetch("http://localhost:5000/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await response.json();
  if (response.ok) {
    Toastify({
      text: "Signup successful! Redirecting to login...",
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#38a169",
    }).showToast();

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  } else {
    Toastify({
      text: `Signup failed: ${data.message}`,
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#e53e3e",
    }).showToast();
  }
});

// LOGIN HANDLER
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();
  if (response.ok) {
    localStorage.setItem("token", data.token);

    Toastify({
      text: "Login successful! Redirecting...",
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#3182ce",
    }).showToast();

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1500);
  } else {
    Toastify({
      text: `Login failed: ${data.message}`,
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#e53e3e",
    }).showToast();
  }
});
