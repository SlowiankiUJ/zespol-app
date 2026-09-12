export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metoda niedozwolona' });
  }

  const { tytul, tresc } = req.body;

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Wklej tutaj swój nowy klucz po słowie "Key "
        "Authorization": "Key TUTAJ_WKLEJ_SWÓJ_NOWY_KLUCZ"
      },
      body: JSON.stringify({
        app_id: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
        included_segments: ["All"],
        headings: { "en": tytul },
        contents: { "en": tresc }
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}