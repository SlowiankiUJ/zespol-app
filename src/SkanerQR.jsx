import { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

export default function SkanerQR({ profile }) {
  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);
  const [skanuje, setSkanuje] = useState(false);
  
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const stałyLinkQR = window.location.origin + '?akcja=obecnosc_qr';

  // Funkcja zapisująca obecność w bazie po zeskanowaniu
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

      setKomunikat('✅ Sukces! Kod QR został pomyślnie zeskanowany. Twoja obecność została zarejestrowana! 🔥');
    } catch (err) {
      console.error('Błąd rejestracji obecności QR:', err);
      setKomunikat('❌ Wystąpił błąd podczas zapisywania obecności.');
    } finally {
      setLoading(false);
    }
  };

  // Uruchamianie kamery w telefonie/przeglądarce
  const wlaczKameru = async () => {
    setKomunikat('');
    setSkanuje(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Używa tylnej kamery w telefonie
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Błąd dostępu do kamery:", err);
      setKomunikat('❌ Brak dostępu do kamery lub urządzenie jej nie obsługuje. Sprawdź uprawnienia przeglądarki.');
      setSkanuje(false);
    }
  };

  // Zatrzymywanie kamery
  const zatrzymajKamere = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setSkanuje(false);
  };

  // Automatyczne skanowanie klatek wideo za pomocą BarcodeDetector (jeśli wspierany) lub przycisku potwierdzenia
  useEffect(() => {
    let interval = null;
    if (skanuje && 'BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      
      interval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const codes = await barcodeDetector.detect(videoRef.current);
            if (codes.length > 0) {
              // Zeskanowano kod! Zatrzymujemy kamerę i zapisujemy obecność
              clearInterval(interval);
              zatrzymajKamere();
              oznaczObecnoscDzisiaj();
            }
          } catch (e) {
            // Ignorujemy błędy detekcji w pojedynczych klatkach
          }
        }
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [skanuje]);

  // Czyszczenie przy wyjściu z komponentu
  useEffect(() => {
    return () => {
      zatrzymajKamere();
    };
  }, []);

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
            Wyświetl ten kod na ekranie lub wydrukuj na sali prób.
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
                Kliknij poniżej, aby uruchomić aparat i zeskanować kod QR na sali.
              </p>
              <button
                onClick={wlaczKameru}
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
                📷 Włącz aparat do skanowania
              </button>
            </>
          ) : (
            <div>
              {/* Podgląd z kamery wideo */}
              <div style={{ position: 'relative', width: '100%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '15px' }}>
                <video 
                  ref={videoRef} 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '260px', objectFit: 'cover' }}
                />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50px)', width: '180px', height: '100px', border: '2px dashed #8b5cf6', borderRadius: '8px', pointerEvents: 'none' }}></div>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                Nakieruj aparat na kod QR znajdujący się na sali... (Jeśli przeglądarce zajmie to chwilę lub nie wykryje automatycznie, możesz użyć przycisku poniżej:)
              </p>

              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button
                  onClick={() => {
                    zatrzymajKamere();
                    oznaczObecnoscDzisiaj();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ✨ Potwierdź obecność ręcznie (po zeskanowaniu)
                </button>

                <button
                  onClick={zatrzymajKamere}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Anuluj ❌
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ marginTop: '15px', color: '#64748b' }}>Sprawdzanie próby i zapisywanie obecności...</p>}

      {komunikat && (
        <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', backgroundColor: komunikat.includes('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${komunikat.includes('✅') ? '#bbf7d0' : '#fecaca'}`, color: komunikat.includes('✅') ? '#15803d' : '#991b1b', fontWeight: '600', fontSize: '14px', display: 'inline-block' }}>
          {komunikat}
        </div>
      )}
    </div>
  );
}