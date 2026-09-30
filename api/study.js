export default function handler(req, res) {
  const id = String(req.query.id || "").trim();

  if (!id || id.length > 200) {
    return res.status(400).send("Invalid batch ID");
  }

  const safeId = encodeURIComponent(id);
  return res.redirect(
    302,
    `https://pwthor.live/study/batches/${safeId}`
  );
}
