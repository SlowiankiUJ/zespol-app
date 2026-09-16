import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ListaCzlonkow({ profile }) {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wybranyCzłonek, setWybranyCzłonek] = useState(null);
  const [statyCzlonka, setStatyCzlonka] = useState({ frekwencja: 0, streak: 0, koncerty: 0, występy: 0, odznaki: [] });

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

  const otwórzSzczegóły = async (wybranaOsoba) => {
    setWybranyCzłonek(wybranaOsoba);
    setLoading(true);

    try {
      const glownaSekcjaClean = (wybranaOsoba.sekcja || '').trim().toLowerCase();

      // 1. Pobieramy próby i deklaracje
      const { data: probyList } = await supabase
        .from('proby')
        .select('id, data_czas, sekcja')
        .order('data_czas', { ascending: false });

      const { data: obecnosciData } = await supabase
        .from('deklaracje_obecnosci')
        .select('id_proby, obecny')
        .eq('id_uzytkownika', wybranaOsoba.id);

      let ob = 0;
      let tot = 0;
      let aktualnyStreak = 0;
      let liczbaKoncertow = 0;
      let liczbaWystepow = 0;

      if (probyList && obecnosciData) {
        const dekMap = {};
        obecnosciData.forEach(d => {
          dekMap[String(d.id_proby)] = d.obecny;
        });

        // Bierzemy TYLKO oficjalne próby danej osoby (odrzucamy gościnne i generalne)
        const wlasneProby = probyList.filter(p => {
          const s = (p.sekcja || '').trim().toLowerCase();
          return s === glownaSekcjaClean && s !== 'generalna';
        });

        // STREAK
        for (const p of wlasneProby) {
          const stan = dekMap[String(p.id)];
          if (stan === true) {
            aktualnyStreak++;
          } else if (stan === false) {
            break;
          }
        }

        // FREKWENCJA
        wlasneProby.forEach(p => {
          const stan = dekMap[String(p.id)];
          if (stan === true) {
            ob++;
            tot++;
          } else if (stan === false) {
            tot++;
          }
        });
      }

      const procentFrekwencji = tot > 0 ? Math.round((ob / tot) * 100) : 0;

      // 2. Koncerty - TYLKO zakwalifikowany === true
      const { data: dekKoncerty } = await supabase
        .from('deklaracje_koncerty')
        .select('id_koncertu, zakwalifikowany')
        .eq('id_uzytkownika', wybranaOsoba.id);

      if (dekKoncerty) {
        const zakwalifikowaneKoncerty = dekKoncerty.filter(d => d.zakwalifikowany === true);
        liczbaKoncertow = zakwalifikowaneKoncerty.length;
      }

      // 3. Występy w obsadzie
      const { data: obsadaData } = await supabase
        .from('koncert_obsada')
        .select('id')
        .eq('id_uzytkownika', wybranaOsoba.id);
      if (obsadaData) liczbaWystepow = obsadaData.length;

      // Generowanie odznak
      const odznaki = [
        { tytuł: 'Rozgrzewka w tańcu (5 prób)', zdobyte: aktualnyStreak >= 5, ikona: '👟' },
        { tytuł: 'Żelazna kondycja (15 prób)', zdobyte: aktualnyStreak >= 15, ikona: '🪵' },
        { tytuł: 'Legenda parkietu i nut (30 prób)', zdobyte: aktualnyStreak >= 30, ikona: '🎻' },
        { tytuł: 'Niezniszczalny Słowianin (50 prób)', zdobyte: aktualnyStreak >= 50, ikona: '🌾' },
        { tytuł: 'Bóg Sceny i Parkietu (100 prób)', zdobyte: aktualnyStreak >= 100, ikona: '👑' },
        { tytuł: 'Człowiek Sceny: 1 Koncert', zdobyte: liczbaKoncertow >= 1, ikona: '🎫' },
        { tytuł: 'Człowiek Sceny: 5 Koncertów', zdobyte: liczbaKoncertow >= 5, ikona: '🎫' },
        { tytuł: 'Człowiek Sceny: 10 Koncertów', zdobyte: liczbaKoncertow >= 10, ikona: '🎫' },
        { tytuł: 'Wirtuoz Parkietu: 10 Występów', zdobyte: liczbaWystepow >= 10, ikona: '💃' },
        { tytuł: 'Wirtuoz Parkietu: 30 Występów', zdobyte: liczbaWystepow >= 30, ikona: '💃' }
      ];

      setStatyCzlonka({
        frekwencja: procentFrekwencji,
        streak: aktualnyStreak,
        koncerty: liczbaKoncertow,
        występy: liczbaWystepow,
        odznaki: odznaki.filter(o => o.zdobyte)
      });
    } catch (err) {
      console.error('Błąd pobierania szczegółów członka:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && czlonkowie.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie listy członków zespołu... 👥</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '8px', fontSize: '20px' }}>Członkowie Zespołu 👥</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Przeglądaj profile znajomych z zespołu, sprawdź ich sekcje, frekwencję oraz zdobyte osiągnięcia!
      </p>

      {/* SZCZEGÓŁY WYBRANEGO CZŁONKA */}
      {wybranyCzłonek && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '2px solid #8b5cf6', position: 'relative' }}>
          <button 
            onClick={() => setWybranyCzłonek(null)}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>FREKWENCJA</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6' }}>{statyCzlonka.frekwencja}%</span>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>STREAK PRÓB</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b' }}>🔥 {statyCzlonka.streak}</span>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>KONCERTY</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>{statyCzlonka.koncerty}</span>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>WYSTĘPY</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#3b82f6' }}>{statyCzlonka.występy}</span>
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
        </div>
      )}

      {/* LISTA CZŁONKÓW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
        {czlonkowie.map((czlonek) => (
          <div 
            key={czlonek.id} 
            onClick={() => otwórzSzczegóły(czlonek)}
            style={{ 
              padding: '16px', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0', 
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
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
                Kliknij po szczegóły 📊
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}