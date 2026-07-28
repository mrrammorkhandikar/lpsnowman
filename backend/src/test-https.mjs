try {
  const r = await fetch("https://httpbin.org/get");
  const t = await r.text();
  console.log("HTTPS OK:", t.slice(0, 80));
} catch(e) {
  console.error("HTTPS FAIL:", e.message, e.cause?.message || "");
}

try {
  const r2 = await fetch("https://kyc-api.surepass.app/api/v1/aadhaar-validation/aadhaar-validation", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": "Bearer test"},
    body: JSON.stringify({id_number: "942826675530"})
  });
  console.log("Surepass status:", r2.status);
} catch(e) {
  console.error("Surepass FAIL:", e.message, e.cause?.message || "");
}
