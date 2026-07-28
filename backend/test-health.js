import fetch from "node-fetch";

async function test() {
  console.log("Testing /api/health-check...");
  try {
    const response = await fetch("http://localhost:5000/api/health-check");
    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Body:", text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
