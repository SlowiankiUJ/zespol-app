import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Osiagniecia({ profile }) {
  const [staty, setStaty] = useState({
    koncertyUdział: 0,       // Liczba koncertów, na które zadeklarował "Wezmę udział" / był zakwalifikowany
    występyObsada: 0,        // Ile razy wystąpił w programie (obsada układów)
    miesieczna100Frekwencja: false // Czy miał 100% frekwencji w jakimkolwiek miesiącu
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      obliczOsiagniecia();
    }
  }, [profile]);

  const obliczOsiagniecia = async () => {
    try {
      // 1. Pobieramy koncerty, w których użytkownik brał udział
      const { data: dekKoncerty } = await supabase
        .from('deklaracje_koncerty')
        .select('id_koncertu, planuje, zakwalifikowany')
        .eq('id_uzytkownika', profile.id)
        .eq('planuje', true);

      const liczbaKoncertow = dekKoncerty ? dekKoncerty.length : 0;

      // 2. Pobieramy występy w obsadzie
      const { data: obsadaData } = await supabase
        .from('koncert_obsada')
        .select('id')
        .eq('id_uzytkownika', profile.id);

      const liczbaWystepow = obsadaData ? obsadaData.length : 0;

      // 3. Sprawdzamy frekwencję miesięczną (100% w danym miesiącu)
      const { data: obecnosciData } = await supabase
        .from('deklaracje_obecnosci')
        .select('obecny, harmonogram_prob(data_proba)')
        .eq('id_uzytkownika', profile.id);

      let ma100PrzezMiesiac = false;
      if (obecnosciData && obecnosciData.length > 0) {
        const miesiaceMap = {};
        obecnosciData.forEach(item => {
          if (item.harmonogram_prob && item.harmonogram_prob.data_proba) {
            const miesiacKey = item.harmonogram_prob.data_proba.substring(0, 7);
            if (!miesiaceMap[miesiacKey]) {
              miesiaceMap[miesiacKey] = { obecne: 0, łącznie: 0 };
            }
            miesiaceMap[miesiacKey].łącznie++;
            if (item.obecny === true) {
              miesiaceMap[miesiacKey].obecne++;
            }
          }
        });

        // Sprawdzamy, czy w jakimkolwiek miesiącu było 100% obecności (min. 3 próby)
        for (const mKey of Object.keys(miesiaceMap)) {
          const m = miesiaceMap[mKey];
          if (m.łącznie >= 3 && m.obecne === m.łącznie) {
            ma100PrzezMiesiac = true;
            break;
          }
        }
      }

      setStaty({
        koncertyUdział: liczbaKoncertow,
        występyObsada: liczbaWystepow,
        miesieczna100Frekwencja: ma100PrzezMiesiac
      });
    } catch (err) {
      console.error('Błąd obliczania osiągnięć:', err);
    } finally {
      setLoading(false);
    }
  };

  // Definicja odznak / medali
  const generujOdznaki = () => {
    const odznaki = [];

    // --- KRYTERIUM: FREKWENCJA ---
    odznaki.push({
      tytuł: 'Perfekcjonista miesiąca 🌟',
      opis: 'Utrzymuj 100% frekwencji na próbach przez cały miesiąc (min. 3 próby).',
      zdobyte: staty.miesieczna100Frekwencja,
      postęp: staty.miesieczna100Frekwencja ? '1/1' : '0/1',
      kategoria: 'Frekwencja'
    });

    // --- KRYTERIUM: KAMIENIE MILOWE - KONCERTY (1, 5, 10, 25, 50, 100) ---
    const progiKoncertow = [1, 5, 10, 25, 50, 100];
    progiKoncertow.forEach(prog => {
      const aktualny = Math.min(staty.koncertyUdział, prog);
      odznaki.push({
        tytuł: `Człowiek Sceny: ${prog} ${prog === 1 ? 'Koncert' : prog < 5 ? 'Koncerty' : 'Koncertów'} 🎫`,
        opis: `Weź udział w ${prog} ${prog === 1 ? 'koncercie' : 'koncertach'} zespołu.`,
        zdobyte: staty.koncertyUdział >= prog,
        postęp: `${aktualny}/${prog}`,
        kategoria: 'Koncerty'
      });
    });

    // --- KRYTERIUM: ILOŚĆ WYSTĘPÓW W PROGRAMIE / UKŁADACH (10 do 100) ---
    const progiWystepow = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    progiWystepow.forEach(prog => {
      const aktualny = Math.min(staty.występyObsada, prog);
      odznaki.push({
        tytuł: `Wirtuoz Parkietu: ${prog} Występów 💃`,
        opis: `Zostań wyznaczony do obsady układów w programach łącznie ${prog} razy.`,
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
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Zbieraj odznaki za aktywność, frekwencję i udział w koncertach!</p>
        </div>
        <div style={{ padding: '8px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', color: '#15803d', fontWeight: 'bold', fontSize: '14px' }}>
          Zdobyte medale: {zdobyteCount} / {odznaki.length} 🌟
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
        {odznaki.map((odznaka, index) => (
          <div 
            key={index} 
            style={{ 
              padding: '18px', 
              borderRadius: '10px', 
              border: odznaka.zdobyte ? '2px solid #10b981' : '1px solid #cbd5e1', 
              backgroundColor: odznaka.zdobyte ? '#f0fdf4' : '#f8fafc',
              opacity: odznaka.zdobyte ? 1 : 0.75,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: odznaka.zdobyte ? '0 4px 6px rgba(16, 185, 129, 0.05)' : 'none'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                  {odznaka.kategoria}
                </span>
                <span style={{ fontSize: '18px' }}>{odznaka.zdobyte ? '🏅' : '🔒'}</span>
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
        ))}
      </div>
    </div>
  );
}