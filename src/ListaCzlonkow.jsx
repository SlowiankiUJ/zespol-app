import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const oczyscTekst = (str) => {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
};

export default function ListaCzlonkow({ profile }) {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wybranyId, setWybranyId] = useState(null);
  const [wybranyCzłonek, setWybranyCzłonek] = useState(null);
  const [statyCzlonka, setStatyCzlonka] = useState({ 
    frekwencja: 0, 
    streak: 0, 
    koncerty: 0, 
    występy: 0, 
    walizki: 0,
    kwiatki: 0,
    odznaki: [] 
  });
  const [loadingSzczegoly, setLoadingSzczegoly] = useState(false);

  const szczegolyRef = useRef(null);

  useEffect(() => {
    if (profile) {
      pobierzWszystkichCzlonkow();
    }
  }, [profile]);

  const pobierzWszystkichCzlonkow = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('rola', 'członek')
        .order('imie_nazwisko', { ascending: true });

      if (error) throw error;
      if (data) {
        setCzlonkowie(data);
      }
    } catch (err) {
      console.error('Błąd pobierania członków:', err);
    } finally {
      setLoading(false);
    }
  };

  const przełączSzczegóły = async (czlonek) => {
    // Jeśli klikamy tego samego, to go zwijamy
    if (wybranyId === czlonek.id) {
      setWybranyId(null);
      setWybranyCzłonek(null);
      return;
    }

    setWybranyId(czlonek.id);
    setWybranyCzłonek(czlonek);
    setLoadingSzczegoly(true);

    try {
      const sekcjaOsoby = oczyscTekst(czlonek.sekcja);
      const userId = czlonek.id;

      // 1. POBIERAMY DEKLARACJE OBECNOŚCI
      const { data: obecnosciZProbami, error: obecnosciError } = await supabase
        .from('deklaracje_obecnosci')
        .select(`
          obecny,
          proby!inner (
            id,
            data_czas,
            sekcja
          )
        `)
        .eq('id_uzytkownika', userId);

      if (obecnosciError) throw obecnosciError;

      let ob = 0;
      let tot = 0;
      let aktualnyStreak = 0;

      if (obecnosciZProbami && obecnosciZProbami.length > 0) {
        const tylkoWlasneObecnosci = obecnosciZProbami.filter(item => {
          if (!item.proby) return false;
          const probaSekcja = oczyscTekst(item.proby.sekcja);
          return probaSekcja === sekcjaOsoby && probaSekcja !== 'generalna';
        });

        tylkoWlasneObecnosci.forEach(item => {
          if (item.obecny === true) {
            ob++;
            tot++;
          } else if (item.obecny === false) {
            tot++;
          }
        });

        const posortowaneDoStreaka = [...tylkoWlasneObecnosci]
          .filter(item => item.obecny === true || item.obecny === false)
          .sort((a, b) => new Date(b.proby.data_czas) - new Date(a.proby.data_czas));

        for (const item of posortowaneDoStreaka) {
          if (item.obecny === true) {
            aktualnyStreak++;
          } else if (item.obecny === false) {
            break;
          }
        }
      }

      const procentFrekwencji = tot > 0 ? Math.round((ob / tot) * 100) : 0;

      // 2. POZOSTAŁE DANE: KONCERTY, OBSADA, WALIZKI, KWIATKI
      const [resKoncerty, resObsada, resWalizki, resKwiatki] = await Promise.all([
        supabase.from('deklaracje_koncerty').select('id_koncertu, zakwalifikowany').eq('id_uzytkownika', userId),
        supabase.from('koncert_obsada').select('id').eq('id_uzytkownika', userId),
        supabase.from('koncert_walizki').select('id').eq('id_uzytkownika', userId),
        supabase.from('kwiatki_uczestnicy').select('id, wybrany').eq('id_uzytkownika', userId).eq('wybrany', true)
      ]);

      const zakwalifikowaneKoncerty = resKoncerty.data ? resKoncerty.data.filter(d => d.zakwalifikowany === true) : [];
      const liczbaKoncertow = zakwalifikowaneKoncerty.length;
      const liczbaWystepow = resObsada.data ? resObsada.data.length : 0;
      const liczbaWalizek = resWalizki.data ? resWalizki.data.length : 0;
      const liczbaKwiatkow = resKwiatki.data ? resKwiatki.data.length : 0;

      // GENEROWANIE TYLKO ZDOBYTYCH ODZNAK
      const odznaki = [];

      if (aktualnyStreak >= 5) odznaki.push({ tytuł: 'Rozgrzewka w tańcu (5 prób)', ikona: '👟' });
      if (aktualnyStreak >= 15) odznaki.push({ tytuł: 'Żelazna kondycja (15 prób)', ikona: '🪵' });
      if (aktualnyStreak >= 30) odznaki.push({ tytuł: 'Legenda parkietu i nut (30 prób)', ikona: '🎻' });
      if (aktualnyStreak >= 50) odznaki.push({ tytuł: 'Niezniszczalny Słowianin (50 prób)', ikona: '🌾' });
      if (aktualnyStreak >= 100) odznaki.push({ tytuł: 'Bóg Sceny i Parkietu (100 prób)', ikona: '👑' });

      if (liczbaKoncertow >= 1) odznaki.push({ tytuł: 'Człowiek Sceny: 1 Koncert', ikona: '🎫' });
      if (liczbaKoncertow >= 5) odznaki.push({ tytuł: 'Człowiek Sceny: 5 Koncertów', ikona: '🎫' });
      if (liczbaKoncertow >= 10) odznaki.push({ tytuł: 'Człowiek Sceny: 10 Koncertów', ikona: '🎫' });
      if (liczbaKoncertow >= 25) odznaki.push({ tytuł: 'Człowiek Sceny: 25 Koncertów', ikona: '🎫' });

      if (liczbaWystepow >= 10) odznaki.push({ tytuł: 'Wirtuoz Parkietu: 10 Występów', ikona: '💃' });
      if (liczbaWystepow >= 30) odznaki.push({ tytuł: 'Wirtuoz Parkietu: 30 Występów', ikona: '💃' });
      if (liczbaWystepow >= 50) odznaki.push({ tytuł: 'Wirtuoz Parkietu: 50 Występów', ikona: '💃' });

      if (liczbaWalizek >= 1) odznaki.push({ tytuł: 'Pierwszy ciężar zespołu (1 walizka)', ikona: '🧳' });
      if (liczbaWalizek >= 10) odznaki.push({ tytuł: 'Mistrz Bagażnika Autokaru (10 walizek)', ikona: '🚌' });
      if (liczbaWalizek >= 15) odznaki.push({ tytuł: 'Zaufany Tragarz Inspektora (15 walizek)', ikona: '💪' });
      if (liczbaWalizek >= 30) odznaki.push({ tytuł: 'Chodzący Wózek Widłowy (30 walizek)', ikona: '🏗️' });
      if (liczbaWalizek >= 50) odznaki.push({ tytuł: 'Tytan ze Skały i Żelaza (50 walizek)', ikona: '🗿' });

      if (liczbaKwiatkow >= 1) odznaki.push({ tytuł: 'Debiut w Bukiecie (1 wyjście)', ikona: '🌸' });
      if (liczbaKwiatkow >= 3) odznaki.push({ tytuł: 'Krakowski Kwiaciarz (3 wyjścia)', ikona: '🌷' });
      if (liczbaKwiatkow >= 5) odznaki.push({ tytuł: 'Ulubieniec Jubilatów (5 wyjść)', ikona: '💐' });
      if (liczbaKwiatkow >= 10) odznaki.push({ tytuł: 'Mistrz Dyplomacji i Florystyki (10 wyjść)', ikona: '🌹' });
      if (liczbaKwiatkow >= 20) odznaki.push({ tytuł: 'Żywa Legenda Delegacji (20 wyjść)', ikona: '👑' });

      setStatyCzlonka({
        frekwencja: procentFrekwencji,
        streak: aktualnyStreak,
        koncerty: liczbaKoncertow,
        występy: liczbaWystepow,
        walizki: liczbaWalizek,
        kwiatki: liczbaKwiatkow,
        odznaki: odznaki
      });

      // Płynne przewinięcie do rozwiniętej sekcji bez skakania na samą górę
      setTimeout(() => {
        if (szczegolyRef.current) {
          szczegolyRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);

    } catch (err) {
      console.error('Błąd pobierania szczegółów członka:', err);
    } finally {
      setLoadingSzczegoly(false);
    }
  };

  if (loading && czlonkowie.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie listy członków zespołu... 👥</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '8px', fontSize: '20px' }}>Członkowie Zespołu 👥</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Przeglądaj profile znajomych z zespołu, sprawdź ich sekcje, oficjalną frekwencję oraz zdobyte osiągnięcia!
      </p>

      {/* SIATKA CZŁONKÓW WRAZ Z ROZWIJANYMI SZCZEGÓŁAMI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
        {czlonkowie.map((czlonek) => {
          const czyWybrany = wybranyId === czlonek.id;

          return (
            <div key={czlonek.id} style={{ display: 'contents' }}>
              {/* KAFELEK CZŁONKA */}
              <div 
                onClick={() => przełączSzczegóły(czlonek)}
                style={{ 
                  padding: '16px', 
                  borderRadius: '8px', 
                  border: czyWybrany ? '2px solid #8b5cf6' : '1px solid #e2e8f0', 
                  backgroundColor: czyWybrany ? '#f5f3ff' : '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                }}
                onMouseEnter={(e) => { if (!czyWybrany) e.currentTarget.style.borderColor = '#8b5cf6'; }}
                onMouseLeave={(e) => { if (!czyWybrany) e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '1px solid #cbd5e1' }}>
                  {czlonek.avatar_url ? (
                    <img src={czlonek.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '22px' }}>👤</span>
                  )}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {czlonek.imie_nazwisko}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Sekcja: <strong style={{ textTransform: 'uppercase', color: '#3182ce' }}>{czlonek.sekcja}</strong>
                  </p>
                  <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}>
                    {czyWybrany ? 'Zwiń profil ▲' : 'Rozwiń profil ▼'}
                  </span>
                </div>
              </div>

              {/* ROZWIJANY PANEL SZCZEGÓŁÓW (WSTAWIANY BEZPOŚREDNIO POD SIATKĄ DLA WYBRANEJ OSOBY) */}
              {czyWybrany && (
                <div 
                  ref={szczegolyRef}
                  style={{ 
                    gridColumn: '1 / -1', 
                    padding: '20px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '10px', 
                    border: '2px solid #8b5cf6', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    margin: '5px 0 15px 0',
                    position: 'relative',
                    animation: 'fadeIn 0.3s ease'
                  }}
                >
                  <button 
                    onClick={() => setWybranyId(null)}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                  >
                    ✕
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #8b5cf6', flexShrink: 0 }}>
                      {wybranyCzłonek.avatar_url ? (
                        <img src={wybranyCzłonek.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '28px' }}>👤</span>
                      )}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b' }}>{wybranyCzłonek.imie_nazwisko}</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        Sekcja główna: <strong style={{ textTransform: 'uppercase', color: '#3182ce' }}>{wybranyCzłonek.sekcja}</strong>
                        {wybranyCzłonek.glos && ` (${wybranyCzłonek.glos})`}
                      </p>
                    </div>
                  </div>

                  {loadingSzczegoly ? (
                    <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>Ładowanie statystyk członka...</p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>FREKWENCJA</span>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#8b5cf6' }}>{statyCzlonka.frekwencja}%</span>
                        </div>
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>STREAK</span>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b' }}>🔥 {statyCzlonka.streak}</span>
                        </div>
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>KONCERTY</span>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#10b981' }}>{statyCzlonka.koncerty}</span>
                        </div>
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>WALIZKI</span>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#0284c7' }}>🧳 {statyCzlonka.walizki}</span>
                        </div>
                        <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>KWIATKI</span>
                          <span style={{ fontSize: '18px', fontWeight: '900', color: '#db2777' }}>🌸 {statyCzlonka.kwiatki}</span>
                        </div>
                      </div>

                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>Zdobyte osiągnięcia i medale ({statyCzlonka.odznaki.length}):</h4>
                      {statyCzlonka.odznaki.length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>Ten użytkownik nie odblokował jeszcze żadnych medali.</p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {statyCzlonka.odznaki.map((o, i) => (
                            <span key={i} style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', border: '1px solid #10b981', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{o.ikona}</span> {o.tytuł}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}