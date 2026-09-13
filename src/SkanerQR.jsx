import { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { QRCodeSVG } from 'qrcode.react';

export default function SkanerQR({ profile }) {
  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);
  const [skanuje, setSkanuje] = useState(false);
  const [odczytanyKod, setOdczytanyKod] = useState('');
  
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // TAJNY, UNIKALNY PODPIS KODU QR (musi być identyczny w wygenerowanym QR i w skanerze)
  const TAJNY_TOKEN_SALI = 'ZPIT_UJ_SLOWIANKI_OFICJALNY_KOD_SALI_PROB';

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
        setOdczytanyKod('');
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
        setOdczytanyKod('');
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
      setOdczytanyKod('');
    } catch (err) {
      console.error('Błąd rejestracji obecności QR:', err);
      setKomunikat('❌ Wystąpił błąd podczas zapisywania obecności.');
    } finally {
      setLoading(false);
    }
  };

  // Uruchamianie kamery
  const wlaczKamere = async () => {
    setKomunikat('');
    setOdczytanyKod('');
    setSkanuje(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Błąd dostępu do kamery:", err);
      setKomunikat('❌ Brak dostępu do kamery. Sprawdź uprawnienia w przeglądarce.');
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

  // Skanowanie klatek wideo przez BarcodeDetector
  useEffect(() => {
    let interval = null;
    if (skanuje && 'BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      
      interval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const codes = await barcodeDetector.detect(videoRef.current);
            if (codes.length > 0) {
              const zawartoscKodu = codes[0].rawValue;
              
              // WERYFIKACJA: Sprawdzamy czy odczytany kod QR zawiera dokładnie nasz tajny token sali!
              if (zawartoscKodu === TAJNY_TOKEN_SALI) {
                clearInterval(interval);
                zatrzymajKamere();
                setOdczytanyKod(zawartoscKodu);
                oznaczObecnoscDzisiaj();
              } else {
                // Jeśli to jakikolwiek inny kod QR (np. z butelki wody), informujemy użytkownika
                setKomunikat('⚠️ Zeskanowano nieprawidłowy kod QR! Podejdź do oficjalnego kodu sali prób.');
              }
            }
          } catch (e) {
            // Ignorujemy błędy pojedynczych klatek
          }
        }
      }, 400);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [skanuje]);

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
        Zeskanuj oficjalny kod QR sali prób, aby potwierdzić swoją obecność.
      </p>

      {/* WIDOK DLA KADRY (Generuje kod QR zawierający tajny token) */}
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
                Kliknij poniżej, aby włączyć aparat i skierować go na kod QR znajdujący się na sali.
              </p>
              <button
                onClick={wlaczKamere}
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
                📷 Włącz aparat i skanuj kod sali
              </button>
            </>
          ) : (
            <div>
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
                Trzymaj aparat stabilnie i nakieruj go na oficjalny kod QR wywieszony na sali...
              </p>

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