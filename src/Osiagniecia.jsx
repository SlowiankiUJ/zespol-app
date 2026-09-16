import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Osiagniecia({ profile }) {
  const [staty, setStaty] = useState({
    koncertyUdział: 0,
    występyObsada: 0,
    miesieczna100Frekwencja: false,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      obliczOsiagniecia();
    }
  }, [profile]);

  const obliczOsiagniecia = async () => {
    try {
      // 1. Pobieramy koncerty, w których użytkownik faktycznie ma status ZAKWALIFIKOWANY (true)
      const { data: dekKoncerty } = await supabase
        .from('deklaracje_koncerty')
        .select('id_koncertu, zakwalifikowany')
        .eq('id_uzytkownika', profile.id);

      const zakwalifikowaneKoncerty = dekKoncerty ? dekKoncerty.filter(d => d.zakwalifikowany === true) : [];
      const liczbaKoncertow = zakwalifikowaneKoncerty.length;

      // 2. Pobieramy występy w obsadzie układów
      const { data: obsadaData } = await supabase
        .from('koncert_obsada')
        .select('id')
        .eq('id_uzytkownika', profile.id);

      const liczbaWystepow = obsadaData ? obsadaData.length : 0;

      // 3. Pobieramy deklaracje obecności
      const { data: obecnosciData } = await supabase
        .from('deklaracje_obecnosci')
        .select('obecny, id_proby')
        .eq('id_uzytkownika', profile.id);

      const { data: probyList } = await supabase
        .from('proby')
        .select('*');

      let ma100PrzezMiesiac = false;
      let aktualnyStreak = 0;

      if (obecnosciData && obecnosciData.length > 0 && probyList) {
        const probaInfoMap = {};
        probyList.forEach(p => {
          if (p.id && p.data_czas) {
            probaInfoMap[p.id] = {
              data_czas: p.data_czas,
              sekcja: p.sekcja
            };
          }
        });

        // --- FREKWENCJA MIESIĘCZNA (TYLKO z prób GŁÓWNEJ sekcji) ---
        const miesiaceMap = {};
        obecnosciData.forEach(item => {
          const info = probaInfoMap[item.id_proby];
          if (info && info.data_czas && info.sekcja === profile.sekcja) {
            const miesiacKey = info.data_czas.substring(0, 7);
            if (!miesiaceMap[miesiacKey]) {
              miesiaceMap[miesiacKey] = { obecne: 0, łącznie: 0 };
            }
            miesiaceMap[miesiacKey].łącznie++;
            if (item.obecny === true) {
              miesiaceMap[miesiacKey].obecne++;
            }
          }
        });

        for (const mKey of Object.keys(miesiaceMap)) {
          const m = miesiaceMap[mKey];
          if (m.łącznie >= 3 && m.obecne === m.łącznie) {
            ma100PrzezMiesiac = true;
            break;
          }
        }

        // --- STREAK PRÓB (TYLKO z prób GŁÓWNEJ sekcji, ignorujemy gościnne i generalne) ---
        const wpisyZUstalonaData = obecnosciData
          .map(d => {
            const info = probaInfoMap[d.id_proby];
            return {
              obecny: d.obecny,
              data_proba: info ? info.data_czas : null,
              sekcja: info ? info.sekcja : null
            };
          })
          .filter(item => item.data_proba && item.sekcja === profile.sekcja && (item.obecny === true || item.obecny === false));

        wpisyZUstalonaData.sort((a, b) => new Date(b.data_proba) - new Date(a.data_proba));

        for (const wpis of wpisyZUstalonaData) {
          if (wpis.obecny === true) {
            aktualnyStreak++;
          } else if (wpis.obecny === false) {
            break;
          }
        }
      }

      setStaty({
        koncertyUdział: liczbaKoncertow,
        występyObsada: liczbaWystepow,
        miesieczna100Frekwencja: ma100PrzezMiesiac,
        streak: aktualnyStreak
      });
    } catch (err) {
      console.error('Błąd obliczania osiągnięć:', err);
    } finally {
      setLoading(false);
    }
  };

  const generujOdznaki = () => {
    const odznaki = [];

    const progiStreaka = [
      { prog: 5, tytul: 'Rozgrzewka w tańcu', opis: 'Starasz się, oby tak dalej! Pęcherze na stopach powoli stają się Twoimi najlepszymi przyjaciółmi.', ikona: '👟' },
      { prog: 15, tytul: 'Żelazna kondycja', opis: 'Przeżyłeś 15 prób z rzędu. Kierownik zaczyna się zastanawiać, czy Ty w ogóle sypiasz w domu.', ikona: '🪵' },
      { prog: 30, tytul: 'Legenda parkietu i nut', opis: '30 prób bez ani jednej zwolny! Twoje buty do tańca zużyły się szybciej niż traktor w żniwa.', ikona: '🎻' },
      { prog: 50, tytul: 'Niezniszczalny Słowianin', opis: '50 prób z rzędu?! Prawdopodobnie potrafisz zatańczyć krakowiaka przez sen.', ikona: '🌾' },
      { prog: 100, tytul: 'Bóg Sceny i Parkietu', opis: '100 prób z rzędu! Status mitologiczny. Krzesła w kącie sali kłaniają się Tobie w pas.', ikona: '👑' }
    ];

    progiStreaka.forEach(s => {
      const aktualny = Math.min(staty.streak, s.prog);
      odznaki.push({
        tytuł: `${s.tytul} (${s.prog} prób)`,
        opis: s.opis,
        ikona: s.ikona,
        zdobyte: staty.streak >= s.prog,
        postęp: `${aktualny}/${s.prog}`,
        kategoria: 'Streak prób'
      });
    });

    odznaki.push({
      tytuł: 'Perfekcjonista miesiąca',
      opis: 'Utrzymuj 100% frekwencji na oficjalnych próbach przez cały miesiąc (min. 3 próby).',
      ikona: '🌟',
      zdobyte: staty.miesieczna100Frekwencja,
      postęp: staty.miesieczna100Frekwencja ? '1/1' : '0/1',
      kategoria: 'Frekwencja'
    });

    const progiKoncertow = [1, 5, 10, 25, 50, 100];
    progiKoncertow.forEach(prog => {
      const aktualny = Math.min(staty.koncertyUdział, prog);
      odznaki.push({
        tytuł: `Człowiek Sceny: ${prog} ${prog === 1 ? 'Koncert' : prog < 5 ? 'Koncerty' : 'Koncertów'}`,
        opis: `Weź udział w ${prog} ${prog === 1 ? 'koncercie' : 'koncertach'} zespołu (wymagana oficjalna kwalifikacja w składzie).`,
        ikona: '🎫',
        zdobyte: staty.koncertyUdział >= prog,
        postęp: `${aktualny}/${prog}`,
        kategoria: 'Koncerty'
      });
    });

    const progiWystepow = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    progiWystepow.forEach(prog => {
      const aktualny = Math.min(staty.występyObsada, prog);
      odznaki.push({
        tytuł: `Wirtuoz Parkietu: ${prog} Występów`,
        opis: `Zostań wyznaczony do obsady układów w programach łącznie ${prog} razy.`,
        ikona: '💃',
        zdobyte: staty.występyObsada >= prog,
        postęp: `${aktualny}/${prog}`,
        kategoria: 'Występy'
      });
    });

    return odznaki;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie Twoich osiągnięć... 🏆</div>;
  }

  const odznaki = generujOdznaki();
  const zdobyteCount = odznaki.filter(o => o.zdobyte).length;

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Twoje Osiągnięcia i Medale 🏆</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Zbieraj odznaki za oficjalne próby sekcji <strong style={{ textTransform: 'uppercase', color: '#8b5cf6' }}>{profile.sekcja}</strong> oraz koncerty w składzie! Aktualny streak: <strong style={{ color: '#8b5cf6' }}>🔥 {staty.streak} prób</strong>
          </p>
        </div>
        <div style={{ padding: '8px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', color: '#15803d', fontWeight: 'bold', fontSize: '14px' }}>
          Zdobyte medale: {zdobyteCount} / {odznaki.length} 🌟
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {odznaki.map((odznaka, index) => {
          const stylIkony = {
            fontSize: '36px',
            filter: odznaka.zdobyte ? 'none' : 'grayscale(100%) brightness(150%)',
            opacity: odznaka.zdobyte ? 1 : 0.35,
            transition: 'all 0.3s ease'
          };

          return (
            <div 
              key={index} 
              style={{ 
                padding: '18px', 
                borderRadius: '10px', 
                border: odznaka.zdobyte ? '2px solid #10b981' : '1px solid #cbd5e1', 
                backgroundColor: odznaka.zdobyte ? '#f0fdf4' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: odznaka.zdobyte ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                    {odznaka.kategoria}
                  </span>
                  <div style={{ padding: '6px', backgroundColor: odznaka.zdobyte ? '#d1fae5' : '#e2e8f0', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={stylIkony}>{odznaka.ikona}</span>
                  </div>
                </div>

                <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: odznaka.zdobyte ? '#065f46' : '#334155' }}>
                  {odznaka.tytuł}
                </h4>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
                  {odznaka.opis}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                  <span>Postęp:</span>
                  <span>{odznaka.postęp}</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: odznaka.zdobyte ? '100%' : '0%', 
                      height: '100%', 
                      backgroundColor: odznaka.zdobyte ? '#10b981' : '#cbd5e1',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}