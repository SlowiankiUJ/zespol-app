import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function SkanerQR({ profile }) {
  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);
  const [skanuje, setSkanuje] = useState(false);

  const stałyLinkQR = window.location.origin + '?akcja=obecnosc_qr';

  // Funkcja zapisująca obecność w bazie po poprawnym zeskanowaniu
  const oznaczObecnoscDzisiaj = async () => {
    setLoading(true);
    setKomunikat('');

    try {
      const dzis = new Date();
      const dzisString = dzis.toISOString().split('T')[0];

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

      let sekcjeUzytkownika = [profile.sekcja, 'generalna'];
      const { data: dodatkowe } = await supabase
        .from('dodatkowe_sekcje')
        .select('sekcja')
        .eq('id_uzytkownika', profile.id)
        .eq('status', 'zatwierdzony');

      if (dodatkowe) {
        dodatkowe.forEach(d => sekcjeUzytkownika.push(d.sekcja));
      }

      const dzisiejszaProba = probyDzis.find(p => sekcjeUzytkownika.includes(p.sekcja));

      if (!dzisiejszaProba) {
        setKomunikat('⚠️ Dzisiaj odbywa się próba, ale nie dotyczy ona Twojej sekcji.');
        setLoading(false);
        return;
      }

      const { error: upsertErr } = await supabase
        .from('deklaracje_obecnosci')
        .upsert([
          {
            id_proby: dzisiejszaProba.id,
            id_uzytkownika: profile.id,
            planuje: true,
            obecny: true
          }
        ], { onConflict: 'id_proby, id_uzytkownika' });

      if (upsertErr) throw upsertErr;

      setKomunikat('✅ Sukces! Zeskanowano kod QR. Twoja obecność została zarejestrowana! 🔥');
    } catch (err) {
      console.error('Błąd rejestracji obecności QR:', err);
      setKomunikat('❌ Wystąpił błąd podczas zapisywania obecności.');
    } finally {
      setLoading(false);
    }
  };

  // Uruchamianie skanera aparatu
  useEffect(() => {
    let scanner = null;
    if (skanuje) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      
      scanner.render(
        (decodedText) => {
          // Sukces odczytu kodu QR
          scanner.clear();
          setSkanuje(false);
          // Możesz opcjonalnie sprawdzić, czy decodedText zawiera odpowiedni link/identyfikator
          oznaczObecnoscDzisiaj();
        },
        (error) => {
          // Błędy skanowania klatek (ignorujemy, bo kamera cały czas szuka kodu)
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Błąd czyszczenia skanera", err));
      }
    };
  }, [skanuje]);

  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', textAlign: 'center' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '20px' }}>Szybka Obecność przez Kod QR 📱</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Zeskanuj stały kod QR na sali prób za pomocą aparatu telefonu.
      </p>

      {/* WIDOK DLA KADRY */}
      {isKadra && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'inline-block' }}>
          <p style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '15px' }}>📌 Stały kod QR Zespołu (dla sali prób):</p>
          <div style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '8px', display: 'inline-block', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <QRCodeSVG value={stałyLinkQR} size={200} level="H" />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', maxWidth: '300px', marginInline: 'auto' }}>
            Wyświetl ten kod na ekranie na sali prób. Członkowie zespołu zeskanują go swoimi telefonami.
          </p>
        </div>
      )}

      {/* WIDOK DLA CZŁONKA */}
      {profile.rola === 'członek' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', backgroundColor: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
          <h3 style={{ fontSize: '16px', color: '#6b21a8', marginBottom: '10px' }}>Skanowanie obecności</h3>
          
          {!skanuje ? (
            <>
              <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '20px' }}>
                Kliknij poniżej, aby włączyć aparat i zeskanować kod QR znajdujący się na sali.
              </p>
              <button
                onClick={() => setSkanuje(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(139, 92, 246, 0.2)'
                }}
              >
                📷 Włącz aparat i skanuj QR
              </button>
            </>
          ) : (
            <div>
              {/* Tutaj biblioteka wstrzyknie okno widoku kamery */}
              <div id="reader" style={{ width: '100%', marginBottom: '15px' }}></div>
              <button
                onClick={() => setSkanuje(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Anuluj skanowanie ❌
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ marginTop: '15px', color: '#64748b' }}>Przetwarzanie obecności...</p>}

      {komunikat && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: komunikat.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${komunikat.includes('✅') ? '#bbf7d0' : '#fecaca'}`, color: komunikat.includes('✅') ? '#15803d' : '#991b1b', fontWeight: '600', fontSize: '14px', display: 'inline-block' }}>
          {komunikat}
        </div>
      )}
    </div>
  );
}