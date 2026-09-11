import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';
import ListaObecnosci from './ListaObecnosci';

export default function Harmonogram({ profile }) {
  const [proby, setProby] = useState([]);
  const [deklaracje, setDeklaracje] = useState({}); // id_proby -> true / false
  const [usprawiedliwienia, setUsprawiedliwienia] = useState({}); // id_proby -> tekst
  const [aktywneInputyUsprawiedliwienia, setAktywneInputyUsprawiedliwienia] = useState({}); // id_proby -> tekst wpisywany w input

  // Formularz dodawania pojedynczej próby (Tylko kierownik / pracownik)
  const [dataCzas, setDataCzas] = useState('');
  const [sekcja, setSekcja] = useState('balet');
  const [opisCwiczen, setOpisCwiczen] = useState('');
  const [komunikat, setKomunikat] = useState('');

  // Formularz prób cyklicznych (Tylko kierownik / pracownik)
  const [dataOd, setDataOd] = useState('');
  const [dataDo, setDataDo] = useState('');
  const [wybranyDzieńTygodnia, setWybranyDzieńTygodnia] = useState('1'); // 1 = poniedziałek
  const [godzinaProby, setGodzinaProby] = useState('18:00');
  const [sekcjaCykliczna, setSekcjaCykliczna] = useState('balet');
  const [opisCykliczny, setOpisCykliczny] = useState('');

  useEffect(() => {
    if (profile) {
      pobierzProby();
      if (profile.rola === 'członek') {
        pobierzMojeDeklaracje();
      }
    }
  }, [profile]);

  const pobierzProby = async () => {
    let sekcjeDoPobrania = [];

    if (profile && profile.rola === 'członek') {
      if (profile.sekcja) sekcjeDoPobrania.push(profile.sekcja);

      // Pobieramy także zatwierdzone dodatkowe sekcje użytkownika
      const { data: dodatkowe } = await supabase
        .from('dodatkowe_sekcje')
        .select('sekcja')
        .eq('id_uzytkownika', profile.id)
        .eq('status', 'zatwierdzony');

      if (dodatkowe) {
        dodatkowe.forEach(d => {
          if (!sekcjeDoPobrania.includes(d.sekcja)) {
            sekcjeDoPobrania.push(d.sekcja);
          }
        });
      }

      if (sekcjeDoPobrania.length === 0) {
        setProby([]);
        return;
      }

      const { data, error } = await supabase
        .from('proby')
        .select('*')
        .in('sekcja', sekcjeDoPobrania)
        .order('data_czas', { ascending: true });

      if (!error && data) {
        setProby(data);
      }
    } else {
      // Kierownik/pracownik widzi wszystkie próby
      const { data, error } = await supabase
        .from('proby')
        .select('*')
        .order('data_czas', { ascending: true });

      if (!error && data) {
        setProby(data);
      }
    }
  };

  const pobierzMojeDeklaracje = async () => {
    const { data, error } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_proby, planuje, usprawiedliwienie')
      .eq('id_uzytkownika', profile.id);

    if (!error && data) {
      const mapaPlanuje = {};
      const mapaPowodow = {};
      const mapaInputow = {};

      data.forEach(d => {
        mapaPlanuje[d.id_proby] = d.planuje;
        if (d.usprawiedliwienie) {
          mapaPowodow[d.id_proby] = d.usprawiedliwienie;
          mapaInputow[d.id_proby] = d.usprawiedliwienie;
        }
      });

      setDeklaracje(mapaPlanuje);
      setUsprawiedliwienia(mapaPowodow);
      setAktywneInputyUsprawiedliwienia(mapaInputow);
    }
  };

  const dodajProbe = async (e) => {
    e.preventDefault();
    setKomunikat('Dodawanie próby...');

    const { error } = await supabase.from('proby').insert([
      { data_czas: dataCzas, sekcja, opis_cwiczen: opisCwiczen }
    ]);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Próba dodana pomyślnie! ✅');
      setDataCzas('');
      setOpisCwiczen('');
      pobierzProby();
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  // Generator prób cyklicznych
  const dodajProbyCykliczne = async (e) => {
    e.preventDefault();
    if (!dataOd || !dataDo) {
      alert('Wypełnij datę początkową i końcową.');
      return;
    }

    const start = new Date(dataOd);
    const end = new Date(dataDo);
    const targetDay = parseInt(wybranyDzieńTygodnia); // 0 (niedziela) do 6 (sobota)

    let current = new Date(start);
    let wygenerowaneDaty = [];

    while (current <= end) {
      if (current.getDay() === targetDay) {
        const [godz, min] = godzinaProby.split(':');
        const dataZGodzina = new Date(current);
        dataZGodzina.setHours(parseInt(godz), parseInt(min), 0, 0);

        wygenerowaneDaty.push({
          data_czas: dataZGodzina.toISOString(),
          sekcja: sekcjaCykliczna,
          opis_cwiczen: opisCykliczny || 'Próba cykliczna'
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (wygenerowaneDaty.length === 0) {
      alert('Brak dni spełniających kryteria w podanym zakresie.');
      return;
    }

    const { error } = await supabase.from('proby').insert(wygenerowaneDaty);

    if (error) {
      setKomunikat('Błąd cykliczny: ' + error.message);
    } else {
      setKomunikat(`Wygenerowano ${wygenerowaneDaty.length} prób cyklicznych! ✅`);
      setDataOd('');
      setDataDo('');
      setOpisCykliczny('');
      pobierzProby();
      setTimeout(() => setKomunikat(''), 4000);
    }
  };

  const usunProbe = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę próbę?')) return;
    
    const { error } = await supabase.from('proby').delete().eq('id', id);
    if (error) {
      alert('Błąd podczas usuwania: ' + error.message);
    } else {
      pobierzProby();
    }
  };

  // Zgłoszenie obecności lub nieobecności przez członka
  const zaktualizujDeklaracje = async (probaId, statusPlanuje) => {
    const noweUsprawiedliwienie = statusPlanuje === true ? null : (usprawiedliwienia[probaId] || null);

    const { error } = await supabase
      .from('deklaracje_obecnosci')
      .upsert([
        { 
          id_proby: probaId, 
          id_uzytkownika: profile.id, 
          planuje: statusPlanuje,
          usprawiedliwienie: noweUsprawiedliwienie
        }
      ], { onConflict: 'id_proby, id_uzytkownika' });

    if (!error) {
      setDeklaracje(prev => ({ ...prev, [probaId]: statusPlanuje }));
      if (statusPlanuje === true) {
        setUsprawiedliwienia(prev => ({ ...prev, [probaId]: null }));
        setAktywneInputyUsprawiedliwienia(prev => ({ ...prev, [probaId]: '' }));
      }
    }
  };

  // Zapisanie samego tekstu usprawiedliwienia
  const zapiszUsprawiedliwienie = async (probaId) => {
    const tekst = aktywneInputyUsprawiedliwienia[probaId] || '';

    const { error } = await supabase
      .from('deklaracje_obecnosci')
      .upsert([
        { 
          id_proby: probaId, 
          id_uzytkownika: profile.id, 
          planuje: false,
          usprawiedliwienie: tekst 
        }
      ], { onConflict: 'id_proby, id_uzytkownika' });

    if (!error) {
      setUsprawiedliwienia(prev => ({ ...prev, [probaId]: tekst }));
      alert('Usprawiedliwienie zostało zapisane pomyślnie. ✅');
    } else {
      alert('Błąd zapisu usprawiedliwienia: ' + error.message);
    }
  };

  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Harmonogram Prób i Zgłoszenia</h2>

      {/* Formularze dodawania prób dla Kadry */}
      {isKadra && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          {/* Pojedyncza próba */}
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Zaplanuj nową próbę</h3>
            <form onSubmit={dodajProbe} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="datetime-local" 
                value={dataCzas} 
                onChange={(e) => setDataCzas(e.target.value)} 
                required 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
              />
              
              <select 
                value={sekcja} 
                onChange={(e) => setSekcja(e.target.value)} 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
              >
                <option value="balet">Sekcja: Balet</option>
                <option value="chór">Sekcja: Chór</option>
                <option value="kapela">Sekcja: Kapela</option>
              </select>

              <textarea 
                placeholder="Opis ćwiczeń (np. Praca nad suitą rzeszowską)" 
                value={opisCwiczen} 
                onChange={(e) => setOpisCwiczen(e.target.value)} 
                rows="3"
                required
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
              />
              
              <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                Dodaj próbę do harmonogramu 📅
              </button>
            </form>
          </div>

          {/* Próby cykliczne */}
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Generuj próby cykliczne 🔄</h3>
            <form onSubmit={dodajProbyCykliczne} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="date" 
                  title="Data od"
                  value={dataOd} 
                  onChange={(e) => setDataOd(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
                />
                <input 
                  type="date" 
                  title="Data do"
                  value={dataDo} 
                  onChange={(e) => setDataDo(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={wybranyDzieńTygodnia} 
                  onChange={(e) => setWybranyDzieńTygodnia(e.target.value)}
                  style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
                >
                  <option value="1">Poniedziałek</option>
                  <option value="2">Wtorek</option>
                  <option value="3">Środa</option>
                  <option value="4">Czwartek</option>
                  <option value="5">Piątek</option>
                  <option value="6">Sobota</option>
                  <option value="0">Niedziela</option>
                </select>

                <input 
                  type="time" 
                  value={godzinaProby} 
                  onChange={(e) => setGodzinaProby(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
                />
              </div>

              <select 
                value={sekcjaCykliczna} 
                onChange={(e) => setSekcjaCykliczna(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
              >
                <option value="balet">Sekcja: Balet</option>
                <option value="chór">Sekcja: Chór</option>
                <option value="kapela">Sekcja: Kapela</option>
              </select>

              <input 
                type="text" 
                placeholder="Opis / Program cyklu prób" 
                value={opisCykliczny} 
                onChange={(e) => setOpisCykliczny(e.target.value)} 
                required 
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
              />

              <button type="submit" style={{ padding: '10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                Generuj cykl prób ⚡
              </button>
            </form>
          </div>

        </div>
      )}

      {komunikat && <p style={{ color: komunikat.includes('Błąd') ? '#dc3545' : 'green', marginBottom: '15px', fontWeight: '500' }}>{komunikat}</p>}

      {/* Lista Prób */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>
        {profile.rola === 'członek' ? `Nadchodzące i minione próby (główna i dodatkowe sekcje) (${proby.length})` : `Wszystkie próby w zespole (${proby.length})`}
      </h3>
      
      {proby.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych prób dla Twoich sekcji.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {proby.map(proba => {
            const stylSekcji = pobierzStylSekcji(proba.sekcja);
            const deklaracjaUzytkownika = deklaracje[proba.id]; // true, false lub undefined

            return (
              <div key={proba.id} style={{ 
                borderLeft: `6px solid ${stylSekcji.glowny}`, 
                padding: '20px', 
                backgroundColor: stylSekcji.jasny, 
                borderRadius: '8px',
                borderTop: `1px solid ${stylSekcji.border}`,
                borderRight: `1px solid ${stylSekcji.border}`,
                borderBottom: `1px solid ${stylSekcji.border}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '3px 10px', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      backgroundColor: stylSekcji.glowny, 
                      color: 'white',
                      marginBottom: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {proba.sekcja}
                    </span>
                    <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '16px' }}>
                      {new Date(proba.data_czas).toLocaleString('pl-PL')}
                    </h4>
                  </div>

                  {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                    <button 
                      onClick={() => usunProbe(proba.id)}
                      style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                    >
                      Usuń próbę 🗑️
                    </button>
                  )}
                </div>

                <p style={{ margin: '10px 0', fontSize: '14px', color: '#334155' }}>
                  <strong>Program:</strong> {proba.opis_cwiczen}
                </p>

                {/* Panel deklaracji dla członka */}
                {profile.rola === 'członek' && (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Twoja deklaracja obecności:</span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => zaktualizujDeklaracje(proba.id, true)}
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
                          Będę 👍
                        </button>

                        <button 
                          onClick={() => zaktualizujDeklaracje(proba.id, false)}
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
                          Nie będzie 👎
                        </button>
                      </div>
                    </div>

                    {/* Dodatkowe okienko usprawiedliwienia */}
                    {deklaracjaUzytkownika === false && (
                      <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
                          Podaj powód nieobecności (usprawiedliwienie):
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <input 
                            type="text"
                            placeholder="np. Choroba / sprawy na uczelni..."
                            value={aktywneInputyUsprawiedliwienia[proba.id] || ''}
                            onChange={(e) => setAktywneInputyUsprawiedliwienia({ ...aktywneInputyUsprawiedliwienia, [proba.id]: e.target.value })}
                            style={{ flex: 1, minWidth: '200px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
                          />
                          <button 
                            onClick={() => zapiszUsprawiedliwienie(proba.id)}
                            style={{ padding: '8px 14px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                          >
                            Zapisz powód
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Panel sprawdzania obecności i deklaracji dla kadry */}
                {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                  <ListaObecnosci probaId={proba.id} sekcja={proba.sekcja} />
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}