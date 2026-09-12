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
        "Authorization": "Key os_v2_app_fbd76qqndrewrhsqur7ef7o2yuvi5cfyhwdunweezdincckgj5sxlxbqnlkqmgnlemdqhwndx7odus2ugcj6szq5ngjsadkb5ym53oa"
      },
      body: JSON.stringify({
        app_id: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
        // Zmieniamy na segment "All", który obejmuje absolutnie wszystkie subskrypcje
        included_segments: ["All"],
        headings: { "en": tytul },
        contents: { "en": tresc }
      })
    });

    const data = await response.json();
    console.OdpowiedzOneSignal = data;
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}