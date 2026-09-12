import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const formatujDate = (dataString) => {
  if (!dataString) return '';
  const rok = dataString.substring(0, 4);
  const mc = dataString.substring(5, 7);
  const dzien = dataString.substring(8, 10);
  const godzina = dataString.substring(11, 16);
  return `${dzien}.${mc}.${rok}, ${godzina}`;
};

const RenderAvatar = ({ url }) => (
  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px' }}>👤</span>}
  </div>
);

export default function Koncerty({ profile }) {
  const [koncerty, setKoncerty] = useState([]);
  const [deklaracjeKoncertow, setDeklaracjeKoncertow] = useState({});
  const [zapisaniNaKoncert, setZapisaniNaKoncert] = useState({});
  const [programyKoncertow, setProgramyKoncertow] = useState({});
  const [obsadyProgramow, setObsadyProgramow] = useState({});
  const [aktywnaPodzakladka, setAktywnaPodzakladka] = useState({});
  const [rozwinieteSkłady, setRozwinieteSkłady] = useState({});

  const [tytul, setTytuł] = useState('');
  const [dataKoncertu, setDataKoncertu] = useState('');
  const [godzinaKoncertu, setGodzinaKoncertu] = useState('18:00');
  const [miejsce, setMiejsce] = useState('');
  const [programOpis, setProgramOpis] = useState('');
  const [komunikat, setKomunikat] = useState('');
  const [noweUklady, setNoweUklady] = useState({});

  const [edycjaKoncertId, setEdycjaKoncertId] = useState(null);
  const [editTytul, setEditTytul] = useState('');
  const [editDataKoncertu, setEditDataKoncertu] = useState('');
  const [editGodzinaKoncertu, setEditGodzinaKoncertu] = useState('');
  const [editMiejsce, setEditMiejsce] = useState('');
  const [editProgramOpis, setEditProgramOpis] = useState('');

  const isKierownik = profile?.rola === 'kierownik';
  // Zarówno kierownik, jak i pracownik (instruktor) mogą zarządzać programem i obsadą układów
  const canManageProgram = profile?.rola === 'kierownik' || profile?.rola === 'pracownik';

  useEffect(() => {
    if (profile) pobierzKoncerty();
  }, [profile]);

  const pobierzKoncerty = async () => {
    const { data, error } = await supabase.from('koncerty').select('*').order('data_czas', { ascending: true });
    if (!error && data) {
      setKoncerty(data);
      if (profile.rola === 'członek') pobierzMojeDeklaracjeKoncertow();
      pobierzWszystkichZapisanych(data);
      pobierzProgramy(data);
    }
  };

  const pobierzMojeDeklaracjeKoncertow = async () => {
    const { data, error } = await supabase.from('deklaracje_koncerty').select('id_koncertu, planuje').eq('id_uzytkownika', profile.id);
    if (!error && data) {
      const mapa = {}; data.forEach(d => { mapa[d.id_koncertu] = d.planuje; });
      setDeklaracjeKoncertow(mapa);
    }
  };

  const pobierzWszystkichZapisanych = async (listaKoncertow) => {
    const koncertIds = listaKoncertow.map(k => k.id);
    if (koncertIds.length === 0) return;

    const { data: dekData } = await supabase.from('deklaracje_koncerty').select('id, id_koncertu, id_uzytkownika, planuje, zakwalifikowany').in('id_koncertu', koncertIds);
    const { data: profData } = await supabase.from('profiles').select('id, imie_nazwisko, sekcja, glos, avatar_url').eq('status', 'zatwierdzony');

    if (dekData && profData) {
      const profileMap = {}; profData.forEach(p => { profileMap[p.id] = p; });
      const mapaZapisanych = {}; koncertIds.forEach(id => { mapaZapisanych[id] = []; });
      dekData.forEach(d => {
        if (profileMap[d.id_uzytkownika]) {
          mapaZapisanych[d.id_koncertu].push({ id: d.id, id_uzytkownika: d.id_uzytkownika, planuje: d.planuje, zakwalifikowany: d.zakwalifikowany, ...profileMap[d.id_uzytkownika] });
        }
      });
      setZapisaniNaKoncert(mapaZapisanych);
    }
  };

  const pobierzProgramy = async (listaKoncertow) => {
    const koncertIds = listaKoncertow.map(k => k.id);
    if (koncertIds.length === 0) return;

    const { data: progData } = await supabase.from('koncert_program').select('*').in('id_koncertu', koncertIds).order('id', { ascending: true });
    if (progData) {
      const mapaProgramow = {}; koncertIds.forEach(id => { mapaProgramow[id] = []; });
      progData.forEach(p => { if (mapaProgramow[p.id_koncertu]) mapaProgramow[p.id_koncertu].push(p); });
      setProgramyKoncertow(mapaProgramow);

      const programIds = progData.map(p => p.id);
      if (programIds.length > 0) {
        const { data: obsData } = await supabase.from('koncert_obsada').select('*').in('id_programu', programIds);
        const mapaObsad = {}; programIds.forEach(id => { mapaObsad[id] = []; });
        if (obsData) {
          obsData.forEach(o => { if (mapaObsad[o.id_programu]) mapaObsad[o.id_programu].push(o.id_uzytkownika); });
        }
        setObsadyProgramow(mapaObsad);
      }
    }
  };

  const dodajKoncert = async (e) => {
    e.preventDefault();
    if (!dataKoncertu) { alert('Wybierz datę z kalendarza.'); return; }
    setKomunikat('Dodawanie koncertu...');
    
    const pelnaDataCzas = `${dataKoncertu}T${godzinaKoncertu}:00`;

    const { error } = await supabase.from('koncerty').insert([{ tytul, data_czas: pelnaDataCzas, miejsce, program: programOpis }]);
    if (error) { 
      setKomunikat('Błąd: ' + error.message); 
    } else {
      setKomunikat('Koncert dodany pomyślnie! ✅ Wysyłam powiadomienie...');
      
      try {
        await fetch("/api/powiadomienie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tytul: "Nowy koncert! 🎻",
            tresc: `Zaplanowano nowy koncert: ${tytul}. Sprawdź szczegóły!`
          })
        });
      } catch (err) {
        console.error("Błąd wysyłania powiadomienia", err);
      }

      setTytuł(''); setDataKoncertu(''); setMiejsce(''); setProgramOpis('');
      pobierzKoncerty(); 
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const usunKoncert = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten koncert?')) return;
    const { error } = await supabase.from('koncerty').delete().eq('id', id);
    if (!error) pobierzKoncerty();
  };

  const rozpocznijEdycje = (koncert) => {
    setEditDataKoncertu(koncert.data_czas.substring(0, 10));
    setEditGodzinaKoncertu(koncert.data_czas.substring(11, 16));
    setEditTytul(koncert.tytul);
    setEditMiejsce(koncert.miejsce);
    setEditProgramOpis(koncert.program || '');
    setEdycjaKoncertId(koncert.id);
  };

  const anulujEdycje = () => setEdycjaKoncertId(null);

  const zapiszEdycje = async (koncertId) => {
    if (!editDataKoncertu || !editGodzinaKoncertu) { alert('Uzupełnij datę i godzinę'); return; }
    const pelnaDataCzas = `${editDataKoncertu}T${editGodzinaKoncertu}:00`;
    const { error } = await supabase.from('koncerty').update({ tytul: editTytul, data_czas: pelnaDataCzas, miejsce: editMiejsce, program: editProgramOpis }).eq('id', koncertId);
    if (error) alert('Błąd zapisu: ' + error.message);
    else { setEdycjaKoncertId(null); pobierzKoncerty(); }
  };

  const zaktualizujDeklaracjeKoncertu = async (koncertId, statusPlanuje) => {
    const { error } = await supabase.from('deklaracje_koncerty').upsert([{ id_koncertu: koncertId, id_uzytkownika: profile.id, planuje: statusPlanuje }], { onConflict: 'id_koncertu, id_uzytkownika' });
    if (!error) { setDeklaracjeKoncertow(prev => ({ ...prev, [koncertId]: statusPlanuje })); pobierzKoncerty(); }
  };

  const zmienKwalifikacje = async (koncertId, userId, statusZakwalifikowany) => {
    const { error } = await supabase.from('deklaracje_koncerty').update({ zakwalifikowany: statusZakwalifikowany }).eq('id_koncertu', koncertId).eq('id_uzytkownika', userId);
    if (!error) pobierzKoncerty();
  };

  const dodajPunktProgramu = async (koncertId) => {
    const tytulUkladu = noweUklady[koncertId];
    if (!tytulUkladu || tytulUkladu.trim() === '') return;
    const { error } = await supabase.from('koncert_program').insert([{ id_koncertu: koncertId, tytul_ukladu: tytulUkladu.trim() }]);
    if (!error) { setNoweUklady(prev => ({ ...prev, [koncertId]: '' })); pobierzKoncerty(); }
  };

  const usunPunktProgramu = async (programId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten układ z programu?')) return;
    const { error } = await supabase.from('koncert_program').delete().eq('id', programId);
    if (!error) pobierzKoncerty();
  };

  const przypiszDoObsady = async (programId, userId) => {
    const { error } = await supabase.from('koncert_obsada').insert([{ id_programu: programId, id_uzytkownika: userId }]);
    if (!error) pobierzKoncerty();
  };

  const usunZObsady = async (programId, userId) => {
    const { error } = await supabase.from('koncert_obsada').delete().eq('id_programu', programId).eq('id_uzytkownika', userId);
    if (!error) pobierzKoncerty();
  };

  const przelaczRozwiniecieSkladu = (koncertId) => { setRozwinieteSkłady(prev => ({ ...prev, [koncertId]: !prev[koncertId] })); };
  const ustawPodzakladke = (koncertId, tab) => { setAktywnaPodzakladka(prev => ({ ...prev, [koncertId]: tab })); };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', color: '#000' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Koncerty i Wydarzenia 🎻</h2>

      {/* Formularz dodawania koncertu - TYLKO DLA KIEROWNIKA */}
      {isKierownik && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Zaplanuj nowy koncert</h3>
          <form onSubmit={dodajKoncert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Tytuł:</label>
              <input type="text" placeholder="Tytuł (np. Koncert Jubileuszowy)" value={tytul} onChange={(e) => setTytuł(e.target.value)} required style={inputStyle} />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={labelStyle}>Data (kliknij po kalendarz):</label>
                <input type="date" value={dataKoncertu} onChange={(e) => setDataKoncertu(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Godzina:</label>
                <input type="time" value={godzinaKoncertu} onChange={(e) => setGodzinaKoncertu(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Miejsce:</label>
              <input type="text" placeholder="Miejsce wydarzenia" value={miejsce} onChange={(e) => setMiejsce(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Opis:</label>
              <textarea placeholder="Ogólny opis" value={programOpis} onChange={(e) => setProgramOpis(e.target.value)} rows="2" style={{...inputStyle, resize: 'vertical'}} />
            </div>
            
            <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              Dodaj koncert 🎫
            </button>
          </form>
          {komunikat && <p style={{ color: komunikat.includes('Błąd') ? '#dc3545' : 'green', marginTop: '10px', fontWeight: '500' }}>{komunikat}</p>}
        </div>
      )}

      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>Nadchodzące koncerty ({koncerty.length})</h3>
      
      {koncerty.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych koncertów.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {koncerty.map(koncert => {
            const deklaracjaUzytkownika = deklaracjeKoncertow[koncert.id];
            const zapisani = zapisaniNaKoncert[koncert.id] || [];
            const isRozwiniete = rozwinieteSkłady[koncert.id];
            const podzakladka = aktywnaPodzakladka[koncert.id] || 'sklad';
            const programyDlaKoncertu = programyKoncertow[koncert.id] || [];
            const czyEdytowany = edycjaKoncertId === koncert.id;

            const chętni = zapisani.filter(z => z.planuje === true);
            const balet = chętni.filter(z => z.sekcja === 'balet');
            const chor = chętni.filter(z => z.sekcja === 'chór');
            const kapela = chętni.filter(z => z.sekcja === 'kapela');
            const zakwalifikowaniWszyscy = chętni.filter(z => z.zakwalifikowany === true);

            return (
              <div key={koncert.id} style={{ borderLeft: '6px solid #8b5cf6', padding: '20px', backgroundColor: '#faf5ff', borderRadius: '8px', borderTop: '1px solid #e9d5ff', borderRight: '1px solid #e9d5ff', borderBottom: '1px solid #e9d5ff', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                {isKierownik && czyEdytowany ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#1e293b' }}>Edycja koncertu:</h4>
                    <input type="text" value={editTytul} onChange={(e) => setEditTytul(e.target.value)} placeholder="Tytuł" style={inputStyle} />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input type="date" value={editDataKoncertu} onChange={(e) => setEditDataKoncertu(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 120px', ...inputStyle }} />
                      <input type="time" value={editGodzinaKoncertu} onChange={(e) => setEditGodzinaKoncertu(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 100px', ...inputStyle }} />
                    </div>
                    <input type="text" value={editMiejsce} onChange={(e) => setEditMiejsce(e.target.value)} placeholder="Miejsce" style={inputStyle} />
                    <textarea value={editProgramOpis} onChange={(e) => setEditProgramOpis(e.target.value)} placeholder="Opis" style={{ ...inputStyle, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                      <button onClick={() => zapiszEdycje(koncert.id)} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Zapisz 💾</button>
                      <button onClick={anulujEdycje} style={{ padding: '8px 14px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '18px' }}>{koncert.tytul}</h4>
                        <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#475569' }}>
                          📅 <strong>{formatujDate(koncert.data_czas)}</strong> | 📍 {koncert.miejsce}
                        </p>
                      </div>
                      {/* Przyciski edycji/usuwania - TYLKO DLA KIEROWNIKA */}
                      {isKierownik && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <button onClick={() => rozpocznijEdycje(koncert)} style={{ padding: '5px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Edytuj ✏️</button>
                          <button onClick={() => usunKoncert(koncert.id)} style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Usuń 🗑️</button>
                        </div>
                      )}
                    </div>
                    <p style={{ margin: '10px 0', fontSize: '14px', color: '#334155' }}><strong>Opis:</strong> {koncert.program}</p>

                    {profile.rola === 'członek' && (
                      <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Twoja deklaracja (Sekcja: <strong style={{ textTransform: 'uppercase' }}>{profile.sekcja}</strong>):</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => zaktualizujDeklaracjeKoncertu(koncert.id, true)} style={{ padding: '8px 14px', borderRadius: '20px', border: '1px solid', borderColor: deklaracjaUzytkownika === true ? '#10b981' : '#cbd5e1', backgroundColor: deklaracjaUzytkownika === true ? '#10b981' : '#f8fafc', color: deklaracjaUzytkownika === true ? '#ffffff' : '#475569', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Wezmę udział 👍</button>
                            <button onClick={() => zaktualizujDeklaracjeKoncertu(koncert.id, false)} style={{ padding: '8px 14px', borderRadius: '20px', border: '1px solid', borderColor: deklaracjaUzytkownika === false ? '#ef4444' : '#cbd5e1', backgroundColor: deklaracjaUzytkownika === false ? '#ef4444' : '#f8fafc', color: deklaracjaUzytkownika === false ? '#ffffff' : '#475569', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Nie mogę 👎</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '15px' }}>
                      <button onClick={() => przelaczRozwiniecieSkladu(koncert.id)} style={{ padding: '8px 14px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                        {isRozwiniete ? 'Zwiń szczegóły koncertu ▲' : `Szczegóły koncertu (Skład i Program) ▼`}
                      </button>
                      {isRozwiniete && (
                        <div style={{ marginTop: '12px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>
                            <button onClick={() => ustawPodzakladke(koncert.id, 'sklad')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: podzakladka === 'sklad' ? '#8b5cf6' : '#f1f5f9', color: podzakladka === 'sklad' ? '#fff' : '#475569' }}>👥 Skład i kwalifikacje</button>
                            <button onClick={() => ustawPodzakladke(koncert.id, 'program')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: podzakladka === 'program' ? '#8b5cf6' : '#f1f5f9', color: podzakladka === 'program' ? '#fff' : '#475569' }}>📋 Program i obsada układów</button>
                          </div>
                          {podzakladka === 'sklad' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {renderujListeOsobek('🩰 Balet', balet, koncert.id, profile, zmienKwalifikacje)}
                              <div>
                                <h5 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #d69e2e', paddingBottom: '4px' }}>🎤 Chór (Ogółem: {chor.length} zgłoszonych)</h5>
                                {['Sopran', 'Alt', 'Tenor', 'Bas'].map(glosName => {
                                  const osobyGlosu = chor.filter(o => (o.glos || 'Sopran') === glosName);
                                  if (osobyGlosu.length === 0) return null;
                                  return <div key={glosName} style={{ marginTop: '10px', paddingLeft: '10px' }}>{renderujListeOsobek(`• ${glosName}`, osobyGlosu, koncert.id, profile, zmienKwalifikacje, true)}</div>;
                                })}
                                {chor.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>Brak zgłoszeń w chórze</p>}
                              </div>
                              {renderujListeOsobek('🎻 Kapela', kapela, koncert.id, profile, zmienKwalifikacje)}
                            </div>
                          )}
                          {podzakladka === 'program' && (
                            <div>
                              <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b' }}>Program i występy w układach:</h5>
                              {/* Dodawanie układu - DLA KIEROWNIKA LUB PRACOWNIKA */}
                              {canManageProgram && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                  <input type="text" placeholder="Wpisz układ (np. Tańce rzeszowskie)" value={noweUklady[koncert.id] || ''} onChange={(e) => setNoweUklady({ ...noweUklady, [koncert.id]: e.target.value })} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                                  <button onClick={() => dodajPunktProgramu(koncert.id)} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Dodaj układ ➕</button>
                                </div>
                              )}
                              {programyDlaKoncertu.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#718096' }}>Brak zdefiniowanych układów.</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                  {programyDlaKoncertu.map((prog, index) => {
                                    const obsadaIds = obsadyProgramow[prog.id] || [];
                                    const osobyWpisu = zakwalifikowaniWszyscy.filter(z => obsadaIds.includes(z.id_uzytkownika));
                                    const wolniDoObsadzenia = zakwalifikowaniWszyscy.filter(z => !obsadaIds.includes(z.id_uzytkownika));
                                    return (
                                      <div key={prog.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                          <h6 style={{ margin: 0, fontSize: '14px', color: '#1e293b', fontWeight: 'bold' }}>{index + 1}. {prog.tytul_ukladu}</h6>
                                          {/* Usuwanie układu - DLA KIEROWNIKA LUB PRACOWNIKA */}
                                          {canManageProgram && (
                                            <button onClick={() => usunPunktProgramu(prog.id)} style={{ padding: '2px 6px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Usuń układ ❌</button>
                                          )}
                                        </div>
                                        
                                        <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 10px 0' }}><strong>Obsada:</strong></p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                          {osobyWpisu.length === 0 ? <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Brak osób w obsadzie</span> : osobyWpisu.map(o => (
                                            <span key={o.id_uzytkownika} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: '#fff', borderRadius: '20px', fontSize: '13px', color: '#334155', border: '1px solid #e2e8f0' }}>
                                              <RenderAvatar url={o.avatar_url} />
                                              {o.imie_nazwisko}
                                              {/* Usuwanie z obsady - DLA KIEROWNIKA LUB PRACOWNIKA */}
                                              {canManageProgram && (
                                                <button onClick={() => usunZObsady(prog.id, o.id_uzytkownika)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold', fontSize: '14px', padding: '0 0 0 4px' }}>×</button>
                                              )}
                                            </span>
                                          ))}
                                        </div>

                                        {/* Przypisywanie do obsady - DLA KIEROWNIKA LUB PRACOWNIKA */}
                                        {canManageProgram && wolniDoObsadzenia.length > 0 && (
                                          <div style={{ marginTop: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                              <select id={`select-osoba-${prog.id}`} style={{ flex: '1 1 150px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }}>
                                                {wolniDoObsadzenia.map(osoba => (<option key={osoba.id_uzytkownika} value={osoba.id_uzytkownika}>{osoba.imie_nazwisko} ({osoba.sekcja}{osoba.glos ? ` - ${osoba.glos}` : ''})</option>))}
                                              </select>
                                              <button onClick={() => { const sel = document.getElementById(`select-osoba-${prog.id}`); if (sel && sel.value) przypiszDoObsady(prog.id, sel.value); }} style={{ padding: '3px 8px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Dodaj do układu ➕</button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderujListeOsobek(tytulSekcji, listaOsob, koncertId, profile, naZmienKwalifikacje, isPodgrupa = false) {
  const zakwalifikowani = listaOsob.filter(o => o.zakwalifikowany === true);
  const rezerwa = listaOsob.filter(o => o.zakwalifikowany === false || o.zakwalifikowany === null);
  const isKierownik = profile.rola === 'kierownik';

  return (
    <div>
      <h5 style={{ margin: isPodgrupa ? '4px 0 4px 0' : '0 0 8px 0', fontSize: isPodgrupa ? '13px' : '14px', color: isPodgrupa ? '#d97706' : '#1e293b', borderBottom: isPodgrupa ? 'none' : '2px solid #cbd5e1', paddingBottom: '4px', textTransform: isPodgrupa ? 'uppercase' : 'none' }}>
        {tytulSekcji} ({listaOsob.length})
      </h5>
      {listaOsob.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 5px 0' }}>Brak zgłoszeń</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
          {zakwalifikowani.length > 0 && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981' }}>🟢 Zakwalifikowani ({zakwalifikowani.length}):</span>
              <ul style={{ margin: '2px 0 6px 15px', paddingLeft: '10px', fontSize: '13px', color: '#334155' }}>
                {zakwalifikowani.map(osoba => (
                  <li key={osoba.id_uzytkownika} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '4px 8px', backgroundColor: '#f0fdf4', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RenderAvatar url={osoba.avatar_url} />
                      <span>{osoba.imie_nazwisko} {osoba.id_uzytkownika === profile.id && '(Ty)'}</span>
                    </div>
                    {/* Zmiana kwalifikacji - TYLKO DLA KIEROWNIKA */}
                    {isKierownik && (
                      <button onClick={() => naZmienKwalifikacje(koncertId, osoba.id_uzytkownika, false)} style={{ padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Rezerwa ⏳</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rezerwa.length > 0 && (
            <div>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#d97706' }}>⏳ Lista rezerwowa ({rezerwa.length}):</span>
              <ul style={{ margin: '2px 0 0 15px', paddingLeft: '10px', fontSize: '13px', color: '#334155' }}>
                {rezerwa.map(osoba => (
                  <li key={osoba.id_uzytkownika} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '4px 8px', backgroundColor: '#fffbeb', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RenderAvatar url={osoba.avatar_url} />
                      <span>{osoba.imie_nazwisko} {osoba.id_uzytkownika === profile.id && '(Ty)'}</span>
                    </div>
                    {/* Zmiana kwalifikacji - TYLKO DLA KIEROWNIKA */}
                    {isKierownik && (
                      <button onClick={() => naZmienKwalifikacje(koncertId, osoba.id_uzytkownika, true)} style={{ padding: '3px 6px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Zakwalifikuj ✔️</button>
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