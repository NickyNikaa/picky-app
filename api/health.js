// api/health.js — Quick liveness check.
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    name: "picky-backend",
    version: "0.4.0",
    time: new Date().toISOString()
  });
}
