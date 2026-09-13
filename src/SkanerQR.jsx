import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

export default function SkanerQR({ profile }) {
  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);
  const [skanuje, setSkanuje] = useState(false);

  // TAJNY, UNIKALNY PODPIS KODU QR (musi być identyczny w wygenerowanym QR i w skanerze)
  const TAJNY_TOKEN_SALI = 'ZPIT_UJ_SLOWIANKI_OFICJALNY_KOD_SALI_PROB';

  const stałyLinkQR = window.location.origin + '?akcja=obecnosc_qr';

  // Funkcja zapisująca obecność w bazie po poprawnym odczycie kodu QR
  const oznaczObecnoscDzisiaj = async () => {
    setLoading(true);
    setKomunikat('');

    try {
      const dzis = new Date();
      const dzisString = dzis.toISOString().split('T')[0];

      // 1. Sprawdzamy czy dzisiaj jest próba
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

      // 2. Zapisujemy obecność
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

      setKomunikat('✅ Sukces! Prawidłowo zeskanowano kod QR sali. Twoja obecność została zarejestrowana! 🔥');
    } catch (err) {
      console.error('Błąd rejestracji obecności QR:', err);
      setKomunikat('❌ Wystąpił błąd podczas zapisywania obecności.');
    } finally {
      setLoading(false);
    }
  };

  // Obsługa uruchamiania i zatrzymywania skanera html5-qrcode
  useEffect(() => {
    let html5QrCode = null;

    if (skanuje) {
      html5QrCode = new Html5Qrcode("reader-container");
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          // Sukces skanowania kodu QR
          if (decodedText === TAJNY_TOKEN_SALI) {
            html5QrCode.stop().then(() => {
              setSkanuje(false);
              oznaczObecnoscDzisiaj();
            }).catch(err => console.error("Błąd zatrzymania kamery:", err));
          } else {
            setKomunikat('⚠️ Zeskanowano nieprawidłowy kod QR! To nie jest oficjalny kod sali prób.');
          }
        },
        (errorMessage) => {
          // Błędy skanowania pojedynczych klatek (ignorujemy, bo skaner cały czas szuka kodu)
        }
      ).catch(err => {
        console.error("Nie udało się uruchomić aparatu:", err);
        setKomunikat('❌ Brak dostępu do kamery. Sprawdź uprawnienia w przeglądarce.');
        setSkanuje(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Błąd czyszczenia skanera:", err));
      }
    };
  }, [skanuje]);

  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', textAlign: 'center' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '10px', fontSize: '20px' }}>Szybka Obecność przez Kod QR 📱</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Zeskanuj oficjalny kod QR sali prób, aby potwierdzić swoją obecność.
      </p>

      {/* WIDOK DLA KADRY */}
      {isKadra && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1', display: 'inline-block' }}>
          <p style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '15px' }}>📌 Oficjalny kod QR Sali Prób (dla zespołu):</p>
          <div style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '8px', display: 'inline-block', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <QRCodeSVG value={TAJNY_TOKEN_SALI} size={200} level="H" />
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', maxWidth: '300px', marginInline: 'auto' }}>
            Wyświetl ten kod na ekranie na sali prób. Tylko ten konkretny kod zostanie uznany przez system.
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
                Kliknij poniżej, aby włączyć skaner i skierować aparat na kod QR znajdujący się na sali.
              </p>
              <button
                onClick={() => { setKomunikat(''); setSkanuje(true); }}
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
                📷 Włącz skaner QR
              </button>
            </>
          ) : (
            <div>
              {/* Kontener w którym biblioteka html5-qrcode wyświetli podgląd kamery */}
              <div id="reader-container" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px' }}></div>

              <button
                onClick={() => setSkanuje(false)}
                style={{
                  width: '100%',
                  padding: '10px',
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

      {loading && <p style={{ marginTop: '15px', color: '#64748b' }}>Weryfikacja kodu i zapisywanie obecności...</p>}

      {komunikat && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: komunikat.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${komunikat.includes('✅') ? '#bbf7d0' : '#fecaca'}`, color: komunikat.includes('✅') ? '#15803d' : '#991b1b', fontWeight: '600', fontSize: '14px', display: 'inline-block' }}>
          {komunikat}
        </div>
      )}
    </div>
  );
}