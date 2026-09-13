import { useState } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

export default function SkanerQR({ profile }) {
  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);

  // Stały link identyfikujący system obecności zespołu
  // Możesz tu wpisać adres swojej aplikacji, np. https://twoja-apka.vercel.app/?qr=slowianki_obecnosc
  const stałyLinkQR = window.location.origin + '?akcja=obecnosc_qr';

  // Funkcja wywoływana, gdy członek "skanuje" / klawiszem potwierdza obecność na sali
  const oznaczObecnoscDzisiaj = async () => {
    setLoading(true);
    setKomunikat('');

    try {
      const dzis = new Date();
      const dzisString = dzis.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

      // 1. Pobieramy próby zaplanowane na dzisiejszy dzień
      const { data: probyDzis, error: probaErr } = await supabase
        .from('proby')
        .select('*')
        .gte('data_czas', `${dzisString}T00:00:00`)
        .lte('data_czas', `${dzisString}T23:59:59`);

      if (probaErr) throw probaErr;

      if (!probyDzis || probyDzis.length === 0) {
        setKomunikat('❌ Dzisiaj nie ma zaplanowanej żadnej próby w harmonogramie!');
        setLoading(false);
        return;
      }

      // 2. Szukamy próby pasującej do sekcji użytkownika lub próby generalnej
      // Sprawdzamy też dodatkowe sekcje użytkownika
      let sekcjeUzytkownika = [profile.sekcja, 'generalna'];
      const { data: dodatkowe } = await supabase
        .from('dodatkowe_sekcje')
        .select('sekcja')
        .eq('id_uzytkownika', profile.id)
        .eq('status', 'zatwierdzony');

      if (dodatkowe) {
        dodatkowe.forEach(d => sekcjeUzytkownika.push(d.sekcja));
      }

      // Znajdujemy próbę, na którą użytkownik powinien dzisiaj uczęszczać
      const dzisiejszaProba = probyDzis.find(p => sekcjeUzytkownika.includes(p.sekcja));

      if (!dzisiejszaProba) {
        setKomunikat('⚠️ Dzisiaj odbywa się próba, ale nie dotyczy ona Twojej sekcji.');
        setLoading(false);
        return;
      }

      // 3. Zapisujemy obecność w tabeli deklaracje_obecnosci
      const { error: upsertErr } = await supabase
        .from('deklaracje_obecnosci')
        .upsert([
          {
            id_proby: dzisiejszaProba.id,
            id_uzytkownika: profile.id,
            planuje: true,
            obecny: true // Automatycznie zaznaczamy obecność!
          }
        ], { onConflict: 'id_proby, id_uzytkownika' });

      if (upsertErr) throw upsertErr;

      setKomunikat('✅ Sukces! Twoja obecność na dzisiejszej próbie została zarejestrowana. 🔥');
    } catch (err) {
      console.error('Błąd rejestracji obecności QR:', err);
      setKomunikat('❌ Wystąpił błąd podczas zapisywania obecności.');
    } finally {
      setLoading(false);
    }
  };

  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', textAlign: 'center' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '20px' }}>Szybka Obecność przez Kod QR 📱</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Zeskanuj stały kod QR na sali prób, aby natychmiast odnotować swoją obecność na dzisiejszych zajęciach.
      </p>

      {/* WIDOK DLA KADRY / KIEROWNIKA (Wyświetlanie kodu do powieszenia/pokazania) */}
      {isKadra && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'inline-block' }}>
          <p style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '15px' }}>📌 Stały kod QR Zespołu (dla sali prób):</p>
          <div style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '8px', display: 'inline-block', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <QRCodeSVG value={stałyLinkQR} size={200} level="H" />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', maxWidth: '300px', marginInline: 'auto' }}>
            Ten kod jest stały. Członkowie mogą go zeskanować telefonem po przyjściu na próbę w celu autoryzacji obecności.
          </p>
        </div>
      )}

      {/* WIDOK DLA CZŁONKA ZESPOŁU */}
      {profile.rola === 'członek' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', backgroundColor: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
          <h3 style={{ fontSize: '16px', color: '#6b21a8', marginBottom: '10px' }}>Jesteś na sali prób?</h3>
          <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '20px' }}>
            Kliknij poniższy przycisk, aby zarejestrować swoją obecność na dzisiejszej próbie za pomocą kodu QR.
          </p>

          <button
            onClick={znaczObecnoscDzisiaj}
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)'
            }}
          >
            {loading ? 'Sprawdzanie próby...' : '📷 Zaznacz obecność (Skanuj QR)'}
          </button>
        </div>
      )}

      {komunikat && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: komunikat.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${komunikat.includes('✅') ? '#bbf7d0' : '#fecaca'}`, color: komunikat.includes('✅') ? '#15803d' : '#991b1b', fontWeight: '600', fontSize: '14px', display: 'inline-block' }}>
          {komunikat}
        </div>
      )}
    </div>
  );
}