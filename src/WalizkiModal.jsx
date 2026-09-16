import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function WalizkiModal({ koncert, profile, onClose }) {
  const [przypisania, setPrzypisania] = useState([]);
  const [wszyscyCzlonkowie, setWszyscyCzlonkowie] = useState([]);
  const [wybranyPrzed, setWybranyPrzed] = useState('');
  const [wybranyPo, setWybranyPo] = useState('');
  const [loading, setLoading] = useState(true);

  // Uprawnienia: Inspektor sekcji lub Kierownik
  const czyMozeEdytowac = Boolean(profile?.czy_inspektor || profile?.rola === 'kierownik');

  useEffect(() => {
    pobierzDane();
  }, [koncert.id]);

  const pobierzDane = async () => {
    setLoading(true);
    try {
      const { data: walizkiData } = await supabase
        .from('koncert_walizki')
        .select(`
          id,
          pora,
          id_uzytkownika,
          profiles (
            id,
            imie_nazwisko,
            sekcja
          )
        `)
        .eq('id_koncertu', koncert.id);

      const { data: czlonkowieData } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek')
        .order('imie_nazwisko', { ascending: true });

      setPrzypisania(walizkiData || []);
      setWszyscyCzlonkowie(czlonkowieData || []);
    } catch (err) {
      console.error('Błąd pobierania walizek:', err);
    } finally {
      setLoading(false);
    }
  };

  const dodajOsobe = async (pora, userId) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('koncert_walizki')
        .insert([{ id_koncertu: koncert.id, id_uzytkownika: userId, pora }]);

      if (error) {
        if (error.code === '23505') {
          alert('Ta osoba jest już dopisana do tej tury.');
        } else {
          alert('Błąd dodawania: ' + error.message);
        }
      } else {
        if (pora === 'przed') setWybranyPrzed('');
        if (pora === 'po') setWybranyPo('');
        pobierzDane();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const usunOsobe = async (id) => {
    if (!czyMozeEdytowac) return;
    const { error } = await supabase.from('koncert_walizki').delete().eq('id', id);
    if (!error) pobierzDane();
  };

  const osobyPrzed = przypisania.filter(p => p.pora === 'przed');
  const osobyPo = przypisania.filter(p => p.pora === 'po');

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '15px' }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '25px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '19px', color: '#1e293b' }}>
              🧳 Przydział walizek – {koncert.nazwa}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              {czyMozeEdytowac 
                ? 'Panel zarządzania przydziałem osób do noszenia walizek (Tryb Inspektora 🔍)' 
                : 'Podgląd przydziału osób wyznaczonych do walizek'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>
            ✕
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>Ładowanie danych walizek...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* OKIENKO 1: PRZED KONCERTEM */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#0369a1' }}>
                  ⏳ Przed koncertem ({osobyPrzed.length})
                </h4>
                <span style={{ fontSize: '11px', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Załadunek</span>
              </div>

              {czyMozeEdytowac && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <select 
                    value={wybranyPrzed} 
                    onChange={(e) => setWybranyPrzed(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
                  >
                    <option value="">Wybierz członka...</option>
                    {wszyscyCzlonkowie.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.imie_nazwisko} ({c.sekcja})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => dodajOsobe('przed', wybranyPrzed)}
                    style={{ padding: '7px 12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                  >
                    Dodaj ➕
                  </button>
                </div>
              )}

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                {osobyPrzed.length === 0 ? (
                  <li style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>Brak przypisanych osób</li>
                ) : (
                  osobyPrzed.map(wpis => (
                    <li key={wpis.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                        {wpis.profiles?.imie_nazwisko} <span style={{ fontSize: '11px', color: '#64748b' }}>({wpis.profiles?.sekcja})</span>
                      </span>
                      {czyMozeEdytowac && (
                        <button onClick={() => usunOsobe(wpis.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} title="Usuń z listy">
                          ✕
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* OKIENKO 2: PO KONCERCIE */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#b45309' }}>
                  🏁 Po koncercie ({osobyPo.length})
                </h4>
                <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Rozładunek</span>
              </div>

              {czyMozeEdytowac && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <select 
                    value={wybranyPo} 
                    onChange={(e) => setWybranyPo(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
                  >
                    <option value="">Wybierz członka...</option>
                    {wszyscyCzlonkowie.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.imie_nazwisko} ({c.sekcja})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => dodajOsobe('po', wybranyPo)}
                    style={{ padding: '7px 12px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                  >
                    Dodaj ➕
                  </button>
                </div>
              )}

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                {osobyPo.length === 0 ? (
                  <li style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>Brak przypisanych osób</li>
                ) : (
                  osobyPo.map(wpis => (
                    <li key={wpis.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                        {wpis.profiles?.imie_nazwisko} <span style={{ fontSize: '11px', color: '#64748b' }}>({wpis.profiles?.sekcja})</span>
                      </span>
                      {czyMozeEdytowac && (
                        <button onClick={() => usunOsobe(wpis.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }} title="Usuń z listy">
                          ✕
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>

          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Zamknij
          </button>
        </div>

      </div>
    </div>
  );
}