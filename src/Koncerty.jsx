import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Koncerty({ profile }) {
  const [koncerty, setKoncerty] = useState([]);
  const [deklaracjeKoncertow, setDeklaracjeKoncertow] = useState({}); // id_koncertu -> true/false
  const [zapisaniNaKoncert, setZapisaniNaKoncert] = useState({}); // id_koncertu -> [ { id, id_uzytkownika, imie_nazwisko, sekcja, glos, planuje, zakwalifikowany } ]
  const [rozwinieteSkłady, setRozwinieteSkłady] = useState({}); // id_koncertu -> true/false

  // Formularz dodawania koncertu (Tylko kierownik / pracownik)
  const [tytul, setTytuł] = useState('');
  const [dataCzas, setDataCzas] = useState('');
  const [miejsce, setMiejsce] = useState('');
  const [program, setProgram] = useState('');
  const [komunikat, setKomunikat] = useState('');

  useEffect(() => {
    if (profile) {
      pobierzKoncerty();
    }
  }, [profile]);

  const pobierzKoncerty = async () => {
    const { data, error } = await supabase
      .from('koncerty')
      .select('*')
      .order('data_czas', { ascending: true });

    if (!error && data) {
      setKoncerty(data);
      if (profile.rola === 'członek') {
        pobierzMojeDeklaracjeKoncertow();
      }
      pobierzWszystkichZapisanych(data);
    }
  };

  const pobierzMojeDeklaracjeKoncertow = async () => {
    const { data, error } = await supabase
      .from('deklaracje_koncerty')
      .select('id_koncertu, planuje')
      .eq('id_uzytkownika', profile.id);

    if (!error && data) {
      const mapa = {};
      data.forEach(d => {
        mapa[d.id_koncertu] = d.planuje;
      });
      setDeklaracjeKoncertow(mapa);
    }
  };

  const pobierzWszystkichZapisanych = async (listaKoncertow) => {
    const koncertIds = listaKoncertow.map(k => k.id);
    if (koncertIds.length === 0) return;

    const { data: dekData } = await supabase
      .from('deklaracje_koncerty')
      .select('id, id_koncertu, id_uzytkownika, planuje, zakwalifikowany')
      .in('id_koncertu', koncertIds);

    const { data: profData } = await supabase
      .from('profiles')
      .select('id, imie_nazwisko, sekcja, glos')
      .eq('status', 'zatwierdzony');

    if (dekData && profData) {
      const profileMap = {};
      profData.forEach(p => {
        profileMap[p.id] = p;
      });

      const mapaZapisanych = {};
      koncertIds.forEach(id => {
        mapaZapisanych[id] = [];
      });

      dekData.forEach(d => {
        if (profileMap[d.id_uzytkownika]) {
          mapaZapisanych[d.id_koncertu].push({
            id: d.id,
            id_uzytkownika: d.id_uzytkownika,
            planuje: d.planuje,
            zakwalifikowany: d.zakwalifikowany,
            ...profileMap[d.id_uzytkownika]
          });
        }
      });

      setZapisaniNaKoncert(mapaZapisanych);
    }
  };

  const dodajKoncert = async (e) => {
    e.preventDefault();
    setKomunikat('Dodawanie koncertu...');

    const { error } = await supabase.from('koncerty').insert([
      { tytul, data_czas: dataCzas, miejsce, program }
    ]);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Koncert dodany pomyślnie! ✅');
      setTytuł('');
      setDataCzas('');
      setMiejsce('');
      setProgram('');
      pobierzKoncerty();
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const usunKoncert = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten koncert?')) return;
    
    const { error } = await supabase.from('koncerty').delete().eq('id', id);
    if (error) {
      alert('Błąd podczas usuwania: ' + error.message);
    } else {
      pobierzKoncerty();
    }
  };

  const zaktualizujDeklaracjeKoncertu = async (koncertId, statusPlanuje) => {
    const { error } = await supabase
      .from('deklaracje_koncerty')
      .upsert([
        { 
          id_koncertu: koncertId, 
          id_uzytkownika: profile.id, 
          planuje: statusPlanuje 
        }
      ], { onConflict: 'id_koncertu, id_uzytkownika' });

    if (!error) {
      setDeklaracjeKoncertow(prev => ({ ...prev, [koncertId]: statusPlanuje }));
      pobierzKoncerty();
    } else {
      alert('Błąd zapisywania deklaracji: ' + error.message);
    }
  };

  const zmienKwalifikacje = async (koncertId, userId, statusZakwalifikowany) => {
    const { error } = await supabase
      .from('deklaracje_koncerty')
      .update({ zakwalifikowany: statusZakwalifikowany })
      .eq('id_koncertu', koncertId)
      .eq('id_uzytkownika', userId);

    if (!error) {
      pobierzKoncerty();
    } else {
      alert('Błąd zmiany kwalifikacji: ' + error.message);
    }
  };

  const przelaczRozwiniecieSkladu = (koncertId) => {
    setRozwinieteSkłady(prev => ({
      ...prev,
      [koncertId]: !prev[koncertId]
    }));
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Koncerty i Wydarzenia 🎻</h2>

      {/* Formularz dodawania koncertu */}
      {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Zaplanuj nowy koncert</h3>
          <form onSubmit={dodajKoncert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Tytuł / Nazwa wydarzenia (np. Koncert Jubileuszowy)" 
              value={tytul} 
              onChange={(e) => setTytuł(e.target.value)} 
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

            <input 
              type="text" 
              placeholder="Miejsce (np. Filharmonia Krakowska)" 
              value={miejsce} 
              onChange={(e) => setMiejsce(e.target.value)} 
              required 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />

            <textarea 
              placeholder="Program koncertu (np. Suita rzeszowska, oprawa śpiewacza)" 
              value={program} 
              onChange={(e) => setProgram(e.target.value)} 
              rows="3"
              required
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
            />
            
            <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              Dodaj koncert do kalendarza 🎫
            </button>
          </form>
          {komunikat && <p style={{ color: komunikat.includes('Błąd') ? '#dc3545' : 'green', marginTop: '10px', fontWeight: '500' }}>{komunikat}</p>}
        </div>
      )}

      {/* Lista Koncertów */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>Nadchodzące koncerty ({koncerty.length})</h3>
      
      {koncerty.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych koncertów w systemie.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {koncerty.map(koncert => {
            const deklaracjaUzytkownika = deklaracjeKoncertow[koncert.id];
            const zapisani = zapisaniNaKoncert[koncert.id] || [];
            const isRozwiniete = rozwinieteSkłady[koncert.id];

            const chętni = zapisani.filter(z => z.planuje === true);
            const balet = chętni.filter(z => z.sekcja === 'balet');
            const chor = chętni.filter(z => z.sekcja === 'chór');
            const kapela = chętni.filter(z => z.sekcja === 'kapela');

            return (
              <div key={koncert.id} style={{ 
                borderLeft: '6px solid #8b5cf6', 
                padding: '20px', 
                backgroundColor: '#faf5ff', 
                borderRadius: '8px',
                borderTop: '1px solid #e9d5ff',
                borderRight: '1px solid #e9d5ff',
                borderBottom: '1px solid #e9d5ff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '18px' }}>
                      {koncert.tytul}
                    </h4>
                    <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#475569' }}>
                      📅 <strong>{new Date(koncert.data_czas).toLocaleString('pl-PL')}</strong> | 📍 {koncert.miejsce}
                    </p>
                  </div>

                  {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                    <button 
                      onClick={() => usunKoncert(koncert.id)}
                      style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                    >
                      Usuń koncert 🗑️
                    </button>
                  )}
                </div>

                <p style={{ margin: '10px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Program:</strong> {koncert.program}
                </p>

                {/* Panel deklaracji dla członka */}
                {profile.rola === 'członek' && (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                        Deklaracja udziału (Sekcja: <strong style={{ textTransform: 'uppercase' }}>{profile.sekcja}</strong>{profile.sekcja === 'chór' ? ` - ${profile.glos || 'Brak głosu'}` : ''}):
                      </span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => zaktualizujDeklaracjeKoncertu(koncert.id, true)}
                          style={{ 
                            padding: '8px 14px', 
                            borderRadius: '20px', 
                            border: '1px solid',
                            borderColor: deklaracjaUzytkownika === true ? '#10b981' : '#cbd5e1',
                            backgroundColor: deklaracjaUzytkownika === true ? '#10b981' : '#f8fafc',
                            color: deklaracjaUzytkownika === true ? '#ffffff' : '#475569',
                            cursor: 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '13px'
                          }}
                        >
                          Wezmę udział 👍
                        </button>

                        <button 
                          onClick={() => zaktualizujDeklaracjeKoncertu(koncert.id, false)}
                          style={{ 
                            padding: '8px 14px', 
                            borderRadius: '20px', 
                            border: '1px solid',
                            borderColor: deklaracjaUzytkownika === false ? '#ef4444' : '#cbd5e1',
                            backgroundColor: deklaracjaUzytkownika === false ? '#ef4444' : '#f8fafc',
                            color: deklaracjaUzytkownika === false ? '#ffffff' : '#475569',
                            cursor: 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '13px'
                          }}
                        >
                          Nie mogę 👎
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sekcja podglądu składu i kwalifikacji */}
                <div style={{ marginTop: '15px' }}>
                  <button 
                    onClick={() => przelaczRozwiniecieSkladu(koncert.id)}
                    style={{ padding: '8px 14px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    {isRozwiniete ? 'Ukryj skład i kwalifikacje ▲' : `Sprawdź skład i kwalifikacje (${chętni.length} zgłoszonych) ▼`}
                  </button>

                  {isRozwiniete && (
                    <div style={{ marginTop: '12px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      
                      {/* Balet */}
                      {renderujListeOsobek('🩰 Balet', balet, koncert.id, profile, zmienKwalifikacje)}

                      {/* Chór z podziałem na głosy */}
                      <div>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #d69e2e', paddingBottom: '4px' }}>
                          🎤 Chór (Ogółem: {chor.length} zgłoszonych)
                        </h5>
                        {['Sopran', 'Alt', 'Tenor', 'Bas'].map(glosName => {
                          const osobyGlosu = chor.filter(o => (o.glos || 'Sopran') === glosName);
                          if (osobyGlosu.length === 0) return null;
                          return (
                            <div key={glosName} style={{ marginTop: '10px', paddingLeft: '10px' }}>
                              {renderujListeOsobek(`• ${glosName}`, osobyGlosu, koncert.id, profile, zmienKwalifikacje, true)}
                            </div>
                          );
                        })}
                        {chor.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>Brak zgłoszeń w chórze</p>}
                      </div>

                      {/* Kapela */}
                      {renderujListeOsobek('🎻 Kapela', kapela, koncert.id, profile, zmienKwalifikacje)}

                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Funkcja pomocnicza renderująca listę z podziałem na zakwalifikowanych i rezerwę
function renderujListeOsobek(tytulSekcji, listaOsob, koncertId, profile, naZmienKwalifikacje, isPodgrupa = false) {
  const zakwalifikowani = listaOsob.filter(o => o.zakwalifikowany === true);
  const rezerwa = listaOsob.filter(o => o.zakwalifikowany === false || o.zakwalifikowany === null);
  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';

  return (
    <div>
      <h5 style={{ margin: isPodgrupa ? '4px 0 4px 0' : '0 0 8px 0', fontSize: isPodgrupa ? '13px' : '14px', color: isPodgrupa ? '#d97706' : '#1e293b', borderBottom: isPodgrupa ? 'none' : '2px solid #cbd5e1', paddingBottom: '4px', textTransform: isPodgrupa ? 'uppercase' : 'none' }}>
        {tytulSekcji} ({listaOsob.length})
      </h5>

      {listaOsob.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 5px 0' }}>Brak zgłoszeń</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          
          {/* Zakwalifikowani */}
          {zakwalifikowani.length > 0 && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981' }}>🟢 Zakwalifikowani ({zakwalifikowani.length}):</span>
              <ul style={{ margin: '2px 0 6px 15px', paddingLeft: '10px', fontSize: '13px', color: '#334155' }}>
                {zakwalifikowani.map(osoba => (
                  <li key={osoba.id_uzytkownika} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', padding: '3px 6px', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                    <span>{osoba.imie_nazwisko} {osoba.id_uzytkownika === profile.id && '(Ty)'}</span>
                    {isKadra && (
                      <button 
                        onClick={() => naZmienKwalifikacje(koncertId, osoba.id_uzytkownika, false)}
                        style={{ padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Rezerwa ⏳
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rezerwa */}
          {rezerwa.length > 0 && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706' }}>⏳ Lista rezerwowa ({rezerwa.length}):</span>
              <ul style={{ margin: '2px 0 0 15px', paddingLeft: '10px', fontSize: '13px', color: '#334155' }}>
                {rezerwa.map(osoba => (
                  <li key={osoba.id_uzytkownika} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', padding: '3px 6px', backgroundColor: '#fffbeb', borderRadius: '4px' }}>
                    <span>{osoba.imie_nazwisko} {osoba.id_uzytkownika === profile.id && '(Ty)'}</span>
                    {isKadra && (
                      <button 
                        onClick={() => naZmienKwalifikacje(koncertId, osoba.id_uzytkownika, true)}
                        style={{ padding: '2px 6px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Zakwalifikuj ✔️
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}