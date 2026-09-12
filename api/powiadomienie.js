export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metoda niedozwolona' });
  }

  const { tytul, tresc } = req.body;

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Używamy "Bearer" zamiast "Key" dla kluczy os_v2_...
        "Authorization": "Bearer os_v2_app_fbd76qqndrewrhsqur7ef7o2ywilikq745jeypvveiumysplzbcpdtr2lfffpxlc27po2cdvjutnz3parwxrn7c6ckykrgmkd4gv4oy"
      },
      body: JSON.stringify({
        app_id: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
        target_channel: "push", // Wymagane przez nowy endpoint API
        included_segments: ["All"],
        headings: { "en": tytul },
        contents: { "en": tresc }
      })
    });

    const data = await response.json();
    console.log("ODPOWIEDŹ ONESIGNAL:", JSON.stringify(data));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}