import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Osiagniecia({ profile }) {
  const [staty, setStaty] = useState({
    koncertyUdział: 0,
    występyObsada: 0,
    miesieczna100Frekwencja: false,
    streak: 0,
    liczbaWalizek: 0,
    liczbaKwiatkow: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      obliczOsiagniecia();
    }
  }, [profile?.id]);

  const obliczOsiagniecia = async () => {
    setLoading(true);
    try {
      const targetUserId = profile.id;

      // Jeśli przekazany profil nie ma informacji o sekcji, pobierzmy go z tabeli profiles
      let glownaSekcjaClean = (profile.sekcja || '').trim().toLowerCase();
      if (!glownaSekcjaClean) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('sekcja')
          .eq('id', targetUserId)
          .single();
        if (profData?.sekcja) {
          glownaSekcjaClean = profData.sekcja.trim().toLowerCase();
        }
      }

      // Bezpieczne, równoległe pobieranie wszystkich danych
      const [
        resKoncerty,
        resObsada,
        resWalizki,
        resKwiatki,
        resProby,
        resObecnosci
      ] = await Promise.all([
        supabase.from('deklaracje_koncerty').select('id_koncertu, zakwalifikowany').eq('id_uzytkownika', targetUserId),
        supabase.from('koncert_obsada').select('id').eq('id_uzytkownika', targetUserId),
        supabase.from('koncert_walizki').select('id').eq('id_uzytkownika', targetUserId),
        supabase.from('kwiatki_uczestnicy').select('id, wybrany').eq('id_uzytkownika', targetUserId).eq('wybrany', true),
        supabase.from('proby').select('id, data_czas, sekcja').order('data_czas', { ascending: false }),
        supabase.from('deklaracje_obecnosci').select('id_proby, obecny').eq('id_uzytkownika', targetUserId)
      ]);

      // 1. Koncerty
      const zakwalifikowaneKoncerty = resKoncerty.data ? resKoncerty.data.filter(d => d.zakwalifikowany === true) : [];
      const liczbaKoncertow = zakwalifikowaneKoncerty.length;

      // 2. Obsada
      const liczbaWystepow = resObsada.data ? resObsada.data.length : 0;

      // 3. Walizki
      const lacznieWalizki = resWalizki.data ? resWalizki.data.length : 0;

      // 4. Kwiatki
      const lacznieKwiatki = resKwiatki.data ? resKwiatki.data.length : 0;

      // 5. Próby i obecności
      const probyList = resProby.data || [];
      const obecnosciData = resObecnosci.data || [];

      let ma100PrzezMiesiac = false;
      let aktualnyStreak = 0;

      if (probyList.length > 0 && obecnosciData.length > 0) {
        const dekMap = {};
        obecnosciData.forEach(d => {
          dekMap[String(d.id_proby)] = d.obecny;
        });

        // Tylko próby sekcji macierzystej
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

        // FREKWENCJA MIESIĘCZNA 100%
        const miesiaceMap = {};
        wlasneProby.forEach(p => {
          const miesiacKey = p.data_czas.substring(0, 7);
          const stan = dekMap[String(p.id)];
          if (stan === true || stan === false) {
            if (!miesiaceMap[miesiacKey]) {
              miesiaceMap[miesiacKey] = { obecne: 0, lacznie: 0 };
            }
            miesiaceMap[miesiacKey].lacznie++;
            if (stan === true) miesiaceMap[miesiacKey].obecne++;
          }
        });

        for (const mKey of Object.keys(miesiaceMap)) {
          const m = miesiaceMap[mKey];
          if (m.lacznie >= 3 && m.obecne === m.lacznie) {
            ma100PrzezMiesiac = true;
            break;
          }
        }
      }

      setStaty({
        koncertyUdział: liczbaKoncertow,
        występyObsada: liczbaWystepow,
        miesieczna100Frekwencja: ma100PrzezMiesiac,
        streak: aktualnyStreak,
        liczbaWalizek: lacznieWalizki,
        liczbaKwiatkow: lacznieKwiatki
      });
    } catch (err) {
      console.error('Błąd obliczania osiągnięć:', err);
    } finally {
      setLoading(false);
    }
  };

  const generujOdznaki = () => {
    const odznaki = [];

    // 1. STREAK PRÓB
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

    // 2. FREKWENCJA MIESIĘCZNA
    odznaki.push({
      tytuł: 'Perfekcjonista miesiąca',
      opis: 'Utrzymuj 100% frekwencji na oficjalnych próbach przez cały miesiąc (min. 3 próby).',
      ikona: '🌟',
      zdobyte: staty.miesieczna100Frekwencja,
      postęp: staty.miesieczna100Frekwencja ? '1/1' : '0/1',
      kategoria: 'Frekwencja'
    });

    // 3. WALIZKI
    const progiWalizek = [
      { prog: 1, tytul: 'Pierwszy ciężar zespołu', opis: 'Pierwsza walizka załadowana! Plecy lekko pieką, ale krew już buzuje.', ikona: '🧳' },
      { prog: 10, tytul: 'Mistrz Bagażnika Autokaru', opis: '10 walizek noszonych przed lub po koncercie!', ikona: '🚌' },
      { prog: 15, tytul: 'Zaufany Tragarz Inspektora', opis: '15 kursów z walizami. Inspektor na Twój widok tylko kiwa głową z uznaniem.', ikona: '💪' },
      { prog: 30, tytul: 'Chodzący Wózek Widłowy', opis: '30 razy na walizkach! Twoje przedramiona są twardsze niż podeszwy butów.', ikona: '🏗️' },
      { prog: 50, tytul: 'Tytan ze Skały i Żelaza', opis: '50 zaliczonych walizek! Żaden wyjazd bez Ciebie nie ruszy!', ikona: '🗿' }
    ];

    progiWalizek.forEach(w => {
      const aktualny = Math.min(staty.liczbaWalizek, w.prog);
      odznaki.push({
        tytuł: `${w.tytul} (${w.prog} ${w.prog === 1 ? 'akcja' : w.prog < 5 ? 'akcje' : 'akcji'})`,
        opis: w.opis,
        ikona: w.ikona,
        zdobyte: staty.liczbaWalizek >= w.prog,
        postęp: `${aktualny}/${w.prog}`,
        kategoria: 'Logistyka i Walizki'
      });
    });

    // 4. KWIATKI
    const progiKwiatkow = [
      { prog: 1, tytul: 'Debiut w Bukiecie', opis: 'Pierwsze wyjście na kwiatki zaliczone! Wstążki poprawione, uśmiech numer pięć.', ikona: '🌸' },
      { prog: 3, tytul: 'Krakowski Kwiaciarz', opis: '3 delegacje kwiatowe za Tobą! Elegancki ukłon i gromkie „Sto lat”.', ikona: '🌷' },
      { prog: 5, tytul: 'Ulubieniec Jubilatów', opis: '5 wyjść na kwiatki. Zespół prezentuje się nienagannie.', ikona: '💐' },
      { prog: 10, tytul: 'Mistrz Dyplomacji i Florystyki', opis: '10 zaliczonych kwiatków! Znasz kwiaciarki w połowie Krakowa.', ikona: '🌹' },
      { prog: 20, tytul: 'Żywa Legenda Delegacji', opis: '20 wyjść na kwiatki! Status Ambasadora Słowianek!', ikona: '👑' }
    ];

    progiKwiatkow.forEach(k => {
      const aktualny = Math.min(staty.liczbaKwiatkow, k.prog);
      odznaki.push({
        tytuł: `${k.tytul} (${k.prog} ${k.prog === 1 ? 'wyjście' : k.prog < 5 ? 'wyjścia' : 'wyjść'})`,
        opis: k.opis,
        ikona: k.ikona,
        zdobyte: staty.liczbaKwiatkow >= k.prog,
        postęp: `${aktualny}/${k.prog}`,
        kategoria: 'Kwiatki i Delegacje'
      });
    });

    // 5. KONCERTY
    const progiKoncertow = [1, 5, 10, 25, 50, 100];
    progiKoncertow.forEach(prog => {
      const aktualny = Math.min(staty.koncertyUdział, prog);
      odznaki.push({
        tytuł: `Człowiek Sceny: ${prog} ${prog === 1 ? 'Koncert' : prog < 5 ? 'Koncerty' : 'Koncertów'}`,
        opis: `Weź udział w ${prog} ${prog === 1 ? 'koncercie' : 'koncertach'} zespołu.`,
        ikona: '🎫',
        zdobyte: staty.koncertyUdział >= prog,
        postęp: `${aktualny}/${prog}`,
        kategoria: 'Koncerty'
      });
    });

    // 6. WYSTĘPY W OBSADZIE
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
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie osiągnięć... 🏆</div>;
  }

  const odznaki = generujOdznaki();
  const zdobyteCount = odznaki.filter(o => o.zdobyte).length;

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>
            Osiągnięcia i Medale: {profile.imie_nazwisko || 'Członek'} 🏆
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Streak: <strong style={{ color: '#8b5cf6' }}>🔥 {staty.streak} prób</strong> | 
            Walizki: <strong style={{ color: '#0284c7' }}>🧳 {staty.liczbaWalizek}</strong> | 
            Kwiatki: <strong style={{ color: '#db2777' }}>🌸 {staty.liczbaKwiatkow}</strong> |
            Koncerty: <strong style={{ color: '#10b981' }}>🎫 {staty.koncertyUdział}</strong>
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
                      width: odznaka.zdobyte ? '100%' : `${Math.min(100, Math.round((parseInt(odznaka.postęp.split('/')[0], 10) / parseInt(odznaka.postęp.split('/')[1], 10)) * 100))}%`, 
                      height: '100%', 
                      backgroundColor: odznaka.zdobyte ? '#10b981' : (odznaka.kategoria === 'Kwiatki i Delegacje' ? '#ec4899' : '#38bdf8'),
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