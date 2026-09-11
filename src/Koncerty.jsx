import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Koncerty({ profile }) {
  const [koncerty, setKoncerty] = useState([]);
  const [mojeZgloszenia, setMojeZgloszenia] = useState({}); // id_koncertu -> true/false
  const [sklady, setSklady] = useState({}); // id_koncertu -> Set(userId)
  const [zgloszeniaOgolne, setZgloszeniaOgolne] = useState({}); // id_koncertu -> { userId: true/false }
  const [wszyscyCzlonkowie, setWszyscyCzlonkowie] = useState([]);

  // Formularz dodawania koncertu (Tylko kierownik)
  const [tytul, setTytul] = useState('');
  const [miejsce, setMiejsce] = useState('');
  const [dataCzas, setDataCzas] = useState('');
  const [repertuar, setRepertuar] = useState('');
  const [wiadomosc, setWiadomosc] = useState('');

  // Stan edycji repertuaru przez kierownika
  const [edytowanyKoncertId, setEdytowanyKoncertId] = useState(null);
  const [nowyRepertuar, setNowyRepertuar] = useState('');

  const [rozwinietySkladId, setRozwinietySkladId] = useState(null);

  useEffect(() => {
    pobierzKoncerty();
    pobierzCzlonkow();
    if (profile.rola === 'członek') {
      pobierzMojeZgloszenia();
    }
  }, [profile]);

  const pobierzKoncerty = async () => {
    const { data } = await supabase
      .from('koncerty')
      .select('*')
      .order('data_czas', { ascending: true });
    
    if (data) {
      setKoncerty(data);
      pobierzSkladyIZgloszenia(data);
    }
  };

  const pobierzCzlonkow = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'zatwierdzony')
      .eq('rola', 'członek')
      .order('imie_nazwisko', { ascending: true });
      
    if (data) setWszyscyCzlonkowie(data);
  };

  const pobierzMojeZgloszenia = async () => {
    const { data } = await supabase
      .from('zgloszenia_koncerty')
      .select('id_koncertu, zgloszony')
      .eq('id_uzytkownika', profile.id);

    if (data) {
      const mapa = {};
      data.forEach(d => { mapa[d.id_koncertu] = d.zgloszony; });
      setMojeZgloszenia(mapa);
    }
  };

  const pobierzSkladyIZgloszenia = async (listaKoncertow) => {
    const koncertIds = listaKoncertow.map(k => k.id);
    if (koncertIds.length === 0) return;

    // Pobierz oficjalny skład
    const { data: skladData } = await supabase
      .from('sklad_koncertu')
      .select('*')
      .in('id_koncertu', koncertIds)
      .eq('zakwalifikowany', true);

    const skladMapa = {};
    if (skladData) {
      skladData.forEach(s => {
        if (!skladMapa[s.id_koncertu]) skladMapa[s.id_koncertu] = new Set();
        skladMapa[s.id_koncertu].add(s.id_uzytkownika);
      });
    }
    setSklady(skladMapa);

    // Pobierz zgłoszenia wszystkich członków
    const { data: zglData } = await supabase
      .from('zgloszenia_koncerty')
      .select('*')
      .in('id_koncertu', koncertIds);

    const zglMapa = {};
    if (zglData) {
      zglData.forEach(z => {
        if (!zglMapa[z.id_koncertu]) zglMapa[z.id_koncertu] = {};
        zglMapa[z.id_koncertu][z.id_uzytkownika] = z.zgloszony; // true / false
      });
    }
    setZgloszeniaOgolne(zglMapa);
  };

  const dodajKoncert = async (e) => {
    e.preventDefault();
    setWiadomosc('Dodawanie koncertu...');

    const { error } = await supabase.from('koncerty').insert([{
      tytul,
      miejsce,
      data_czas: dataCzas,
      repertuar
    }]);

    if (error) {
      setWiadomosc('Błąd: ' + error.message);
    } else {
      setWiadomosc('Koncert dodany pomyślnie! ✅');
      setTytul('');
      setMiejsce('');
      setDataCzas('');
      setRepertuar('');
      pobierzKoncerty();
    }
  };

  const usunKoncert = async (koncertId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten koncert?')) return;
    await supabase.from('koncerty').delete().eq('id', koncertId);
    pobierzKoncerty();
  };

  // Funkcje edycji repertuaru przez kierownika
  const rozpocznijEdycjeRepertuaru = (koncert) => {
    setEdytowanyKoncertId(koncert.id);
    setNowyRepertuar(koncert.repertuar);
  };

  const zapiszRepertuar = async (koncertId) => {
    const { error } = await supabase
      .from('koncerty')
      .update({ repertuar: nowyRepertuar })
      .eq('id', koncertId);

    if (error) {
      alert('Błąd podczas edycji repertuaru: ' + error.message);
    } else {
      setEdytowanyKoncertId(null);
      setNowyRepertuar('');
      pobierzKoncerty();
    }
  };

  const zglosSie = async (koncertId, status) => {
    const { error } = await supabase
      .from('zgloszenia_koncerty')
      .upsert([
        { id_koncertu: koncertId, id_uzytkownika: profile.id, zgloszony: status }
      ], { onConflict: 'id_koncertu, id_uzytkownika' });

    if (!error) {
      setMojeZgloszenia(prev => ({ ...prev, [koncertId]: status }));
    }
  };

  const toggleSklad = async (koncertId, userId, aktualnyStan) => {
    const nowyStan = !aktualnyStan;
    if (nowyStan) {
      await supabase.from('sklad_koncertu').upsert([
        { id_koncertu: koncertId, id_uzytkownika: userId, zakwalifikowany: true }
      ], { onConflict: 'id_koncertu, id_uzytkownika' });
    } else {
      await supabase.from('sklad_koncertu').delete().eq('id_koncertu', koncertId).eq('id_uzytkownika', userId);
    }
    pobierzKoncerty();
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Harmonogram Koncertów i Występów</h2>

      {/* Formularz dodawania koncertu (Tylko kierownik) */}
      {profile.rola === 'kierownik' && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Dodaj nowy koncert (Tylko Kierownik)</h3>
          <form onSubmit={dodajKoncert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Tytuł koncertu / Wydarzenia (np. Koncert Galowy)" 
              value={tytul} 
              onChange={(e) => setTytul(e.target.value)} 
              required 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />
            <input 
              type="text" 
              placeholder="Miejsce (np. Filharmonia Krakowska)" 
              value={miejsce} 
              onChange={(e) => setMiejsce(e.target.value)} 
              required 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />
            <input 
              type="datetime-local" 
              value={dataCzas} 
              onChange={(e) => setDataCzas(e.target.value)} 
              required 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />
            <textarea 
              placeholder="Repertuar (np. Suita rzeszowska, Krakowiak, Oberek)" 
              value={repertuar} 
              onChange={(e) => setRepertuar(e.target.value)} 
              rows="3"
              required
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />
            <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              Dodaj koncert do kalendarza 🎵
            </button>
          </form>
          {wiadomosc && <p style={{ color: wiadomosc.includes('Błąd') ? '#dc3545' : 'green', marginTop: '10px', fontWeight: '500' }}>{wiadomosc}</p>}
        </div>
      )}

      {/* Lista Koncertów */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>Nadchodzące koncerty ({koncerty.length})</h3>
      {koncerty.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych koncertów.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {koncerty.map(koncert => {
            const zgloszenieStatus = mojeZgloszenia[koncert.id];
            const skladKoncertu = sklady[koncert.id] || new Set();
            const zgloszeniaTegoKoncertu = zgloszeniaOgolne[koncert.id] || {};
            const czyRozwinietySklad = rozwinietySkladId === koncert.id;
            const czyEdytujeRepertuar = edytowanyKoncertId === koncert.id;

            return (
              <div key={koncert.id} style={{ 
                borderLeft: '6px solid #8b5cf6', 
                padding: '20px', 
                backgroundColor: '#f9f8ff', 
                borderRadius: '8px',
                borderTop: '1px solid #e9d5ff',
                borderRight: '1px solid #e9d5ff',
                borderBottom: '1px solid #e9d5ff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#581c87', fontSize: '18px' }}>{koncert.tytul}</h4>
                    <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#334155' }}>
                      📍 <strong>Miejsce:</strong> {koncert.miejsce} | ⏰ <strong>Data:</strong> {new Date(koncert.data_czas).toLocaleString('pl-PL')}
                    </p>
                  </div>

                  {/* Przyciski zarządzania koncertem dla kierownika */}
                  {profile.rola === 'kierownik' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!czyEdytujeRepertuar && (
                        <button 
                          onClick={() => rozpocznijEdycjeRepertuaru(koncert)}
                          style={{ padding: '5px 12px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          Edytuj repertuar ✏️
                        </button>
                      )}
                      <button 
                        onClick={() => usunKoncert(koncert.id)}
                        style={{ padding: '5px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        Usuń koncert 🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Wyświetlanie lub edycja repertuaru */}
                {czyEdytujeRepertuar ? (
                  <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea 
                      value={nowyRepertuar} 
                      onChange={(e) => setNowyRepertuar(e.target.value)} 
                      rows="3" 
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => zapiszRepertuar(koncert.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                      >
                        Zapisz repertuar
                      </button>
                      <button 
                        onClick={() => setEdytowanyKoncertId(null)}
                        style={{ padding: '6px 12px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '10px 0', fontSize: '14px', color: '#1e293b' }}>
                    <strong>Repertuar:</strong> {koncert.repertuar}
                  </p>
                )}

                {/* Panel Zgłoszeń dla Członka */}
                {profile.rola === 'członek' && (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Twoja deklaracja udziału:</span>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>
                        Oficjalny skład: {skladKoncertu.has(profile.id) ? <strong style={{ color: '#10b981' }}>Zakwalifikowany do składu ✅</strong> : <span style={{ color: '#64748b' }}>Oczekiwanie / Brak w składzie</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => zglosSie(koncert.id, true)}
                        style={{ 
                          padding: '8px 14px', 
                          borderRadius: '20px', 
                          border: '1px solid',
                          borderColor: zgloszenieStatus === true ? '#10b981' : '#cbd5e1',
                          backgroundColor: zgloszenieStatus === true ? '#10b981' : '#f8fafc',
                          color: zgloszenieStatus === true ? '#ffffff' : '#475569',
                          cursor: 'pointer', 
                          fontWeight: 'bold', 
                          fontSize: '13px'
                        }}
                      >
                        Zgłaszam się 👍
                      </button>

                      <button 
                        onClick={() => zglosSie(koncert.id, false)}
                        style={{ 
                          padding: '8px 14px', 
                          borderRadius: '20px', 
                          border: '1px solid',
                          borderColor: zgloszenieStatus === false ? '#ef4444' : '#cbd5e1',
                          backgroundColor: zgloszenieStatus === false ? '#ef4444' : '#f8fafc',
                          color: zgloszenieStatus === false ? '#ffffff' : '#475569',
                          cursor: 'pointer', 
                          fontWeight: 'bold', 
                          fontSize: '13px'
                        }}
                      >
                        Nie mogę wziąć udziału 👎
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel zarządzania składem dla Kadry */}
                {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                  <div style={{ marginTop: '15px' }}>
                    <button 
                      onClick={() => setRozwinietySkladId(czyRozwinietySklad ? null : koncert.id)}
                      style={{ padding: '8px 14px', backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                    >
                      {czyRozwinietySklad ? '▲ Ukryj panel ustalania składu' : `👥 Ustal skład koncertu (${skladKoncertu.size} w oficjalnym składzie)`}
                    </button>

                    {czyRozwinietySklad && (
                      <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
                          💡 <i>Sprawdź, kto może wziąć udział i zakwalifikuj osoby do oficjalnego składu koncertu.</i>
                        </p>

                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {wszyscyCzlonkowie.map(czlonek => {
                            const zgloszenieKadry = zgloszeniaTegoKoncertu[czlonek.id];
                            const czyWskladzie = skladKoncertu.has(czlonek.id);

                            return (
                              <li key={czlonek.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f3f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                  <span style={{ fontWeight: '600', fontSize: '15px', color: '#1e293b' }}>{czlonek.imie_nazwisko}</span>
                                  <div style={{ fontSize: '13px', marginTop: '3px' }}>
                                    {zgloszenieKadry === true ? (
                                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>🟢 Może wziąć udział</span>
                                    ) : zgloszenieKadry === false ? (
                                      <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🔴 Nie może wziąć udziału</span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>⚪ Brak deklaracji</span>
                                    )}
                                  </div>
                                </div>

                                <button 
                                  onClick={() => toggleSklad(koncert.id, czlonek.id, czyWskladzie)}
                                  style={{
                                    padding: '7px 14px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    backgroundColor: czyWskladzie ? '#10b981' : '#f1f5f9',
                                    color: czyWskladzie ? '#ffffff' : '#64748b'
                                  }}
                                >
                                  {czyWskladzie ? 'W oficjalnym składzie ✅' : 'Dodaj do składu +'}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}