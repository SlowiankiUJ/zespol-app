import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';

export default function ListaObecnosci({ probaId, sekcja }) {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [obecnosci, setObecnosci] = useState({}); 
  const [deklaracjeMap, setDeklaracjeMap] = useState({});
  const [ladowanie, setLadowanie] = useState(false);
  const [rozwin, setRozwin] = useState(false);
  const [komunikat, setKomunikat] = useState('');

  const styl = pobierzStylSekcji(sekcja);

  useEffect(() => {
    if (rozwin) {
      pobierzDane();
    }
  }, [rozwin, probaId, sekcja]);

  const pobierzDane = async () => {
    setLadowanie(true);
    try {
      // 1. Pobieramy zatwierdzonych członków sekcji
      const { data: profile, error: errProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('sekcja', sekcja)
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek');

      if (errProfile) console.error('Błąd pobierania profili:', errProfile);
      if (profile) setCzlonkowie(profile);

      // 2. Pobieramy zapisane faktyczne obecności i nieobecności
      const { data: frek, error: errFrek } = await supabase
        .from('frekwencja')
        .select('id_uzytkownika, obecny')
        .eq('id_proby', probaId);

      if (errFrek) console.error('Błąd pobierania frekwencji:', errFrek);
      if (frek) {
        const mapO = {};
        frek.forEach(f => { mapO[f.id_uzytkownika] = f.obecny; });
        setObecnosci(mapO);
      }

      // 3. Pobieramy deklaracje członków
      const { data: dekl, error: errDekl } = await supabase
        .from('deklaracje_obecnosci')
        .select('id_uzytkownika, planuje')
        .eq('id_proby', probaId);

      if (errDekl) {
        console.warn('Tabela deklaracji może nie istnieć lub ma ograniczenia RLS:', errDekl);
      }
      if (dekl) {
        const mapaD = {};
        dekl.forEach(d => { mapaD[d.id_uzytkownika] = d.planuje; });
        setDeklaracjeMap(mapaD);
      }
    } catch (err) {
      console.error('Krytyczny błąd ładowania listy obecności:', err);
    } finally {
      // Zawsze wyłączamy stan ładowania, nawet jeśli wystąpił błąd
      setLadowanie(false);
    }
  };

  const ustawObecnosc = (userId, status) => {
    setObecnosci(prev => ({ ...prev, [userId]: status }));
  };

  const zapiszFrekwencje = async () => {
    setKomunikat('Zapisywanie...');
    
    await supabase.from('frekwencja').delete().eq('id_proby', probaId);

    const noweWpisy = czlonkowie.map(czlonek => ({
      id_proby: probaId,
      id_uzytkownika: czlonek.id,
      obecny: obecnosci[czlonek.id] === true
    }));

    if (noweWpisy.length > 0) {
      const { error } = await supabase.from('frekwencja').insert(noweWpisy);
      if (error) {
        setKomunikat('Błąd zapisu: ' + error.message);
        return;
      }
    }

    setKomunikat('Zapisano pomyślnie! ✅');
    setTimeout(() => setKomunikat(''), 3000);
  };

  return (
    <div style={{ marginTop: '15px' }}>
      <button 
        onClick={() => setRozwin(!rozwin)}
        style={{ 
          padding: '8px 14px', 
          backgroundColor: styl.jasny, 
          color: styl.tekst, 
          border: `1px solid ${styl.border}`, 
          borderRadius: '6px', 
          cursor: 'pointer', 
          fontWeight: '600',
          fontSize: '14px',
          transition: 'all 0.3s ease'
        }}
      >
        {rozwin ? '▲ Ukryj panel obecności i deklaracji' : '▼ Sprawdź deklaracje i edytuj obecność (Kadra)'}
      </button>

      <div style={{
        maxHeight: rozwin ? '800px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out',
        opacity: rozwin ? 1 : 0
      }}>
        <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', border: `1px solid ${styl.border}` }}>
          {ladowanie ? (
            <p style={{ color: '#64748b' }}>Ładowanie danych...</p>
          ) : czlonkowie.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>Brak zatwierdzonych członków w sekcji: <b>{sekcja}</b>.</p>
          ) : (
            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
                {czlonkowie.map(czlonek => {
                  const statusObecnosci = obecnosci[czlonek.id]; // true, false lub undefined
                  const deklaracjaUzytkownika = deklaracjeMap[czlonek.id];

                  return (
                    <li key={czlonek.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                      
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>{czlonek.imie_nazwisko}</span>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          Deklaracja: {' '}
                          {deklaracjaUzytkownika === true ? (
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>Planuje być 👍</span>
                          ) : deklaracjaUzytkownika === false ? (
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Nie będzie 👎</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Brak odpowiedzi ⏳</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => ustawObecnosc(czlonek.id, true)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: statusObecnosci === true ? '#10b981' : '#e2e8f0',
                            backgroundColor: statusObecnosci === true ? '#10b981' : '#f8fafc',
                            color: statusObecnosci === true ? '#ffffff' : '#64748b',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                          }}
                        >
                          ✅ Obecność
                        </button>

                        <button
                          onClick={() => ustawObecnosc(czlonek.id, false)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: statusObecnosci === false ? '#ef4444' : '#e2e8f0',
                            backgroundColor: statusObecnosci === false ? '#ef4444' : '#f8fafc',
                            color: statusObecnosci === false ? '#ffffff' : '#64748b',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '13px',
                            transition: 'all 0.2s'
                          }}
                        >
                          ❌ Nieobecność
                        </button>
                      </div>

                    </li>
                  );
                })}
              </ul>

              <button 
                onClick={zapiszFrekwencje}
                style={{ width: '100%', padding: '12px', backgroundColor: styl.glowny, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
              >
                Zatwierdź i zapisz faktyczną frekwencję
              </button>

              {komunikat && <p style={{ textAlign: 'center', marginTop: '10px', fontWeight: 'bold', color: komunikat.includes('Błąd') ? 'red' : 'green' }}>{komunikat}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}