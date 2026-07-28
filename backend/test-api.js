import fetch from "node-fetch";

async function test() {
  const response = await fetch("http://localhost:5000/api/auth/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "7218860925", otpType: "registration" }),
  });
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Body:", text);
}

test();
