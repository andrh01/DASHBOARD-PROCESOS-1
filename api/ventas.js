// Función serverless de Vercel: trae el CSV publicado de Google Sheets
// y lo sirve desde el mismo dominio del dashboard (sin problemas de CORS),
// con caché en el edge de Vercel para no consultar Google en cada visita.
//
// Para cambiar de hoja, define la variable de entorno SHEET_CSV_URL en Vercel.

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRZhG16c6gNzf_76m8fnRuDOnFbYdnDDvr-9PnoEiQOVQLL30TvE44RYisrBVXTUeuZFXvD6Mtqt7ht/pub?output=csv";

module.exports = async function handler(req, res) {
  const url = process.env.SHEET_CSV_URL || DEFAULT_CSV_URL;

  try {
    const upstream = await fetch(url, { redirect: "follow" });
    if (!upstream.ok) {
      throw new Error(`Google Sheets respondió ${upstream.status}`);
    }
    const csv = await upstream.text();

    // Si Google devuelve una página HTML (hoja despublicada, enlace roto), no la sirvas como datos.
    if (/^\s*<(!doctype|html)/i.test(csv)) {
      throw new Error("La hoja no está publicada como CSV o el enlace cambió");
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    // 10 min de caché fresca; hasta 1 h sirviendo la versión anterior mientras se refresca.
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    res.setHeader("X-Fetched-At", new Date().toISOString());
    res.status(200).send(csv);
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: err.message || "No se pudo leer la hoja" });
  }
}
