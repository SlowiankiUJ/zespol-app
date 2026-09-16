import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';
import ListaObecnosci from './ListaObecnosci';

// Formatowanie surowej daty z bazy do wyświetlania
const formatujWyswietlanie = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
};

// Polskie nazwy miesięcy do grupowania
const nazwyMiesiecy = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export default function Harmonogram({ profile }) {
  const [proby, setProby] = useState([]);
  const [deklaracje, setDeklaracje] = useState({}); // id_proby -> 'obecny' | 'nieobecny' | 'spozniony'
  const [usprawiedliwienia, setUsprawiedliwienia] = useState({});
  const [aktywneInputyUsprawiedliwienia, setAktywneInputyUsprawiedliwienia] = useState({});
  const [rozwinitaObecnosc, setRozwinitaObecnosc] = useState({});
  const [liczbaZadeklarowanych, setLiczbaZadeklarowanych] = useState({});
  
  const [rozwinieteMiesiace, setRozwinieteMiesiace] = useState({});

  const [dataProby, setDataProby] = useState('');
  const [godzinaProby, setGodzinaProby] = useState('18:00');
  const [sekcja, setSekcja] = useState('balet');
  const [opisCwiczen, setOpisCwiczen] = useState('');
  const [komunikat, setKomunikat] = useState('');

  const [dataOd, setDataOd] = useState('');
  const [dataDo, setDataDo] = useState('');
  const [wybranyDzieńTygodnia, setWybranyDzieńTygodnia] = useState('1');
  const [godzinaProbyCyklicznej, setGodzinaProbyCyklicznej] = useState('18:00');
  const [sekcjaCykliczna, setSekcjaCykliczna] = useState('balet');
  const [opisCykliczny, setOpisCykliczny] = useState('');

  const [edycjaProbaId, setEdycjaProbaId] = useState(null);
  const [editDataProby, setEditDataProby] = useState('');
  const [editGodzinaProby, setEditGodzinaProby] = useState('');
  const [editSekcja, setEditSekcja] = useState('balet');
  const [editOpisCwiczen, setEditOpisCwiczen] = useState('');

  useEffect(() => {
    if (profile) {
      pobierzProby();
      if (profile.rola === 'członek') pobierzMojeDeklaracje();
    }
  }, [profile]);

  // Pobieranie liczby osób zadeklarowanych ("Będę" lub "Spóźnię się")
  const pobierzLiczbeZadeklarowanych = async (probyList) => {
    if (!probyList || probyList.length === 0) return;
    const probaIds = probyList.map(p => p.id);

    const { data, error } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_proby, planuje, status_deklaracji')
      .in('id_proby', probaIds);

    if (!error && data) {
      const counts = {};
      data.forEach(d => {
        // Liczymy zarówno 'obecny', 'spozniony', jak i planuje === true
        if (d.status_deklaracji === 'obecny' || d.status_deklaracji === 'spozniony' || (d.status_deklaracji == null && d.planuje === true)) {
          counts[d.id_proby] = (counts[d.id_proby] || 0) + 1;
        }
      });
      setLiczbaZadeklarowanych(counts);
    }
  };

  const pobierzProby = async () => {
    let sekcjeDoPobrania = [];
    if (profile && profile.rola === 'członek') {
      if (profile.sekcja) sekcjeDoPobrania.push(profile.sekcja);
      const { data: dodatkowe } = await supabase.from('dodatkowe_sekcje').select('sekcja').eq('id_uzytkownika', profile.id).eq('status', 'zatwierdzony');
      if (dodatkowe) dodatkowe.forEach(d => { if (!sekcjeDoPobrania.includes(d.sekcja)) sekcjeDoPobrania.push(d.sekcja); });

      if (!sekcjeDoPobrania.includes('generalna')) {
        sekcjeDoPobrania.push('generalna');
      }

      if (sekcjeDoPobrania.length === 0) { setProby([]); return; }
      const { data, error } = await supabase.from('proby').select('*').in('sekcja', sekcjeDoPobrania).order('data_czas', { ascending: true });
      if (!error && data) {
        setProby(data);
        pobierzLiczbeZadeklarowanych(data);
      }
    } else {
      const { data, error } = await supabase.from('proby').select('*').order('data_czas', { ascending: true });
      if (!error && data) {
        setProby(data);
        pobierzLiczbeZadeklarowanych(data);
      }
    }
  };

  const pobierzMojeDeklaracje = async () => {
    const { data, error } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_proby, planuje, status_deklaracji, usprawiedliwienie')
      .eq('id_uzytkownika', profile.id);

    if (!error && data) {
      const mapaPlanuje = {};
      const mapaPowodow = {};
      const mapaInputow = {};

      data.forEach(d => {
        let status = d.status_deklaracji;
        if (!status) {
          if (d.planuje === true) status = 'obecny';
          else if (d.planuje === false) status = 'nieobecny';
        }

        mapaPlanuje[d.id_proby] = status;
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
    if (!dataProby) { alert('Wybierz datę z kalendarza.'); return; }
    setKomunikat('Dodawanie próby...');

    const pelnaDataCzas = `${dataProby}T${godzinaProby}:00`;

    const { error } = await supabase.from('proby').insert([{ data_czas: pelnaDataCzas, sekcja, opis_cwiczen: opisCwiczen }]);
    if (error) { 
      setKomunikat('Błąd: ' + error.message); 
    } else {
      setKomunikat('Próba dodana pomyślnie! ✅ Wysyłam powiadomienie...');
      
      try {
        const resPowiadomienie = await fetch("/api/powiadomienie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tytul: sekcja === 'generalna' ? "Próba generalna! 🎭" : "Nowa próba! 📅",
            tresc: sekcja === 'generalna' ? "Zaplanowano próbę generalną dla całego zespołu! Sprawdź harmonogram." : `Zaplanowano nową próbę dla sekcji: ${sekcja}. Sprawdź harmonogram!`
          })
        });
        const wynikJson = await resPowiadomienie.json();
        console.log("Wynik powiadomienia:", wynikJson);
      } catch (err) {
        console.error("Błąd sieciowy powiadomienia:", err);
      }

      setDataProby(''); setOpisCwiczen('');
      pobierzProby(); 
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const dodajProbyCykliczne = async (e) => {
    e.preventDefault();
    if (!dataOd || !dataDo) { alert('Wypełnij datę początkową i końcową.'); return; }

    const [rokOd, mcOd, dzienOd] = dataOd.split('-');
    const [rokDo, mcDo, dzienDo] = dataDo.split('-');
    const start = new Date(rokOd, mcOd - 1, dzienOd);
    const end = new Date(rokDo, mcDo - 1, dzienDo);
    const targetDay = parseInt(wybranyDzieńTygodnia);
    
    let current = new Date(start);
    let wygenerowaneDaty = [];

    while (current <= end) {
      if (current.getDay() === targetDay) {
        const r = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        
        wygenerowaneDaty.push({
          data_czas: `${r}-${m}-${d}T${godzinaProbyCyklicznej}:00`,
          sekcja: sekcjaCykliczna,
          opis_cwiczen: opisCykliczny || 'Próba cykliczna'
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (wygenerowaneDaty.length === 0) { alert('Brak dni spełniających kryteria w podanym zakresie.'); return; }

    const { error } = await supabase.from('proby').insert(wygenerowaneDaty);
    if (error) { setKomunikat('Błąd cykliczny: ' + error.message); } else {
      setKomunikat(`Wygenerowano ${wygenerowaneDaty.length} prób cyklicznych! ✅`);
      setDataOd(''); setDataDo(''); setOpisCykliczny('');
      pobierzProby(); setTimeout(() => setKomunikat(''), 4000);
    }
  };

  const usunProbe = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę próbę?')) return;
    const { error } = await supabase.from('proby').delete().eq('id', id);
    if (!error) pobierzProby();
  };

  const rozpocznijEdycje = (proba) => {
    setEditDataProby(proba.data_czas.substring(0, 10));
    setEditGodzinaProby(proba.data_czas.substring(11, 16));
    setEditSekcja(proba.sekcja);
    setEditOpisCwiczen(proba.opis_cwiczen || '');
    setEdycjaProbaId(proba.id);
  };

  const anulujEdycje = () => { setEdycjaProbaId(null); };

  const zapiszEdycje = async (probaId) => {
    if (!editDataProby || !editGodzinaProby) { alert('Uzupełnij datę i godzinę'); return; }
    
    const pelnaDataCzas = `${editDataProby}T${editGodzinaProby}:00`;

    const { error } = await supabase.from('proby').update({
      data_czas: pelnaDataCzas, sekcja: editSekcja, opis_cwiczen: editOpisCwiczen
    }).eq('id', probaId);

    if (error) alert('Błąd podczas zapisywania: ' + error.message);
    else { setEdycjaProbaId(null); pobierzProby(); }
  };

  // Zaktualizowana funkcja deklaracji: obsługuje statusy: 'obecny', 'nieobecny', 'spozniony'
  const zaktualizujDeklaracje = async (probaId, nowyStatus) => {
    const planujeVal = nowyStatus === 'nieobecny' ? false : true;
    const zachowaneUsprawiedliwienie = nowyStatus === 'obecny' ? null : (usprawiedliwienia[probaId] || null);

    const payload = {
      id_proby: probaId,
      id_uzytkownika: profile.id,
      planuje: planujeVal,
      status_deklaracji: nowyStatus,
      usprawiedliwienie: zachowaneUsprawiedliwienie
    };

    const { error } = await supabase.from('deklaracje_obecnosci').upsert([payload], { onConflict: 'id_proby, id_uzytkownika' });
    if (!error) {
      setDeklaracje(prev => ({ ...prev, [probaId]: nowyStatus }));
      if (nowyStatus === 'obecny') {
        setUsprawiedliwienia(prev => ({ ...prev, [probaId]: null }));
        setAktywneInputyUsprawiedliwienia(prev => ({ ...prev, [probaId]: '' }));
      }
      pobierzLiczbeZadeklarowanych(proby);
    }
  };

  const zapiszKomentarzDeklaracji = async (probaId, typ) => {
    const tekst = aktywneInputyUsprawiedliwienia[probaId] || '';
    const payload = {
      id_proby: probaId,
      id_uzytkownika: profile.id,
      planuje: typ === 'nieobecny' ? false : true,
      status_deklaracji: typ,
      usprawiedliwienie: tekst
    };

    const { error } = await supabase.from('deklaracje_obecnosci').upsert([payload], { onConflict: 'id_proby, id_uzytkownika' });
    if (!error) {
      setUsprawiedliwienia(prev => ({ ...prev, [probaId]: tekst }));
      alert(typ === 'spozniony' ? 'Zapisano informację o spóźnieniu! ⏰' : 'Usprawiedliwienie zapisane. ✅');
    }
  };

  const przelaczObecnosc = (probaId) => {
    setRozwinitaObecnosc(prev => ({ ...prev, [probaId]: !prev[probaId] }));
  };

  const aktualnaData = new Date();
  const aktualnyKluczMiesiaca = `${aktualnaData.getFullYear()}-${String(aktualnaData.getMonth()).padStart(2, '0')}`;

  const pogrupowaneProby = proby.reduce((akregator, proba) => {
    const data = new Date(proba.data_czas);
    const rok = data.getFullYear();
    const miesiacIdx = data.getMonth();
    const klucz = `${rok}-${String(miesiacIdx).padStart(2, '0')}`;
    const nazwaMiesiaca = `${nazwyMiesiecy[miesiacIdx]} ${rok}`;

    if (!akregator[klucz]) {
      akregator[klucz] = { nazwa: nazwaMiesiaca, proby: [] };
    }
    akregator[klucz].proby.push(proba);
    return akregator;
  }, {});

  const przelaczZakladkeMiesiaca = (klucz) => {
    setRozwinieteMiesiace(prev => {
      const isCurrentlyOpen = prev[klucz] ?? (klucz === aktualnyKluczMiesiaca);
      return { ...prev, [klucz]: !isCurrentlyOpen };
    });
  };

  const isKadra = profile.rola === 'kierownik' || profile.rola === 'pracownik';
  const isKierownik = profile.rola === 'kierownik';

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '14px' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' };

  const formatujLiczbeOsob = (n) => {
    if (n === 1) return '1 osoba zadeklarowała obecność';
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} osoby zadeklarowały obecność`;
    return `${n} osób zadeklarowało obecność`;
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Harmonogram Prób i Zgłoszenia</h2>

      {isKadra && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'stretch', gap: '20px', marginBottom: '30px' }}>
          
          {/* PANEL: POJEDYNCZA PRÓBA */}
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Zaplanuj nową próbę</h3>
            <form onSubmit={dodajProbe} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={labelStyle}>Data:</label>
                  <input type="date" value={dataProby} onChange={(e) => setDataProby(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={labelStyle}>Godzina:</label>
                  <input type="time" value={godzinaProby} onChange={(e) => setGodzinaProby(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sekcja:</label>
                <select value={sekcja} onChange={(e) => setSekcja(e.target.value)} style={inputStyle}>
                  <option value="balet">Sekcja: Balet</option>
                  <option value="chór">Sekcja: Chór</option>
                  <option value="kapela">Sekcja: Kapela</option>
                  {isKierownik && <option value="generalna">🎭 Próba generalna (Cały zespół)</option>}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Program:</label>
                <textarea placeholder="Opis ćwiczeń" value={opisCwiczen} onChange={(e) => setOpisCwiczen(e.target.value)} rows="3" required style={{...inputStyle, resize: 'vertical'}} />
              </div>
              <button type="submit" style={{ marginTop: 'auto', width: '100%', padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                Dodaj próbę 📅
              </button>
            </form>
          </div>

          {/* PANEL: PRÓBY CYKLICZNE */}
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Generuj próby cykliczne 🔄</h3>
            <form onSubmit={dodajProbyCykliczne} style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelStyle}>Od daty:</label>
                  <input type="date" value={dataOd} onChange={(e) => setDataOd(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelStyle}>Do daty:</label>
                  <input type="date" value={dataDo} onChange={(e) => setDataDo(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={labelStyle}>Dzień tygodnia:</label>
                  <select value={wybranyDzieńTygodnia} onChange={(e) => setWybranyDzieńTygodnia(e.target.value)} style={inputStyle}>
                    <option value="1">Poniedziałek</option><option value="2">Wtorek</option><option value="3">Środa</option><option value="4">Czwartek</option><option value="5">Piątek</option><option value="6">Sobota</option><option value="0">Niedziela</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={labelStyle}>Godzina:</label>
                  <input type="time" value={godzinaProbyCyklicznej} onChange={(e) => setGodzinaProbyCyklicznej(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{...inputStyle, cursor: 'pointer'}} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sekcja:</label>
                <select value={sekcjaCykliczna} onChange={(e) => setSekcjaCykliczna(e.target.value)} style={inputStyle}>
                  <option value="balet">Sekcja: Balet</option><option value="chór">Sekcja: Chór</option><option value="kapela">Sekcja: Kapela</option>
                  {isKierownik && <option value="generalna">🎭 Próba generalna (Cały zespół)</option>}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Program cyklu:</label>
                <input type="text" placeholder="Opis / Program cyklu prób" value={opisCykliczny} onChange={(e) => setOpisCykliczny(e.target.value)} required style={inputStyle} />
              </div>
              <button type="submit" style={{ marginTop: 'auto', width: '100%', padding: '12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                Generuj cykl ⚡
              </button>
            </form>
          </div>

        </div>
      )}

      {komunikat && <p style={{ color: komunikat.includes('Błąd') ? '#dc3545' : 'green', marginBottom: '15px', fontWeight: '500' }}>{komunikat}</p>}

      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>
        {profile.rola === 'członek' ? `Lista zaplanowanych prób (${proby.length})` : `Lista wszystkich prób (${proby.length})`}
      </h3>
      
      {Object.keys(pogrupowaneProby).length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych prób.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {Object.keys(pogrupowaneProby).sort().map(kluczMiesiaca => {
            const grupa = pogrupowaneProby[kluczMiesiaca];
            const isRozwiniety = rozwinieteMiesiace[kluczMiesiaca] ?? (kluczMiesiaca === aktualnyKluczMiesiaca);

            return (
              <div key={kluczMiesiaca} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                <button 
                  onClick={() => przelaczZakladkeMiesiaca(kluczMiesiaca)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '15px 20px', backgroundColor: '#f1f5f9', border: 'none', borderBottom: isRozwiniety ? '1px solid #e2e8f0' : 'none', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', color: '#1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>📅 {grupa.nazwa} <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 'normal' }}>({grupa.proby.length} prób)</span></span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{isRozwiniety ? '▲ Zwiń' : '▼ Rozwiń'}</span>
                </button>

                {isRozwiniety && (
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#ffffff' }}>
                    {grupa.proby.map(proba => {
                      const stylSekcji = pobierzStylSekcji(proba.sekcja);
                      const statusDeklaracji = deklaracje[proba.id];
                      const czyEdytowana = edycjaProbaId === proba.id;
                      const isRozwinietaDlaKadry = rozwinitaObecnosc[proba.id];
                      const liczbaOsobZadeklarowanych = liczbaZadeklarowanych[proba.id] || 0;

                      return (
                        <div key={proba.id} style={{ 
                          borderLeft: `6px solid ${stylSekcji.glowny}`, padding: '20px', backgroundColor: stylSekcji.jasny, 
                          borderRadius: '8px', borderTop: `1px solid ${stylSekcji.border}`, borderRight: `1px solid ${stylSekcji.border}`, 
                          borderBottom: `1px solid ${stylSekcji.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                        }}>
                          {czyEdytowana ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                              <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#1e293b' }}>Edycja próby:</h4>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <input type="date" value={editDataProby} onChange={(e) => setEditDataProby(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 120px', ...inputStyle }} />
                                <input type="time" value={editGodzinaProby} onChange={(e) => setEditGodzinaProby(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 100px', ...inputStyle }} />
                                <select value={editSekcja} onChange={(e) => setEditSekcja(e.target.value)} style={{ flex: '1 1 100px', ...inputStyle }}>
                                  <option value="balet">Balet</option><option value="chór">Chór</option><option value="kapela">Kapela</option><option value="generalna">Generalna</option>
                                </select>
                              </div>
                              <textarea value={editOpisCwiczen} onChange={(e) => setEditOpisCwiczen(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
                              <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                <button onClick={() => zapiszEdycje(proba.id)} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Zapisz 💾</button>
                                <button onClick={anulujEdycje} style={{ padding: '8px 14px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Anuluj</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: stylSekcji.glowny, color: 'white', textTransform: 'uppercase' }}>
                                      {proba.sekcja === 'generalna' ? '🎭 Próba generalna' : proba.sekcja}
                                    </span>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                                      ({formatujLiczbeOsob(liczbaOsobZadeklarowanych)})
                                    </span>
                                  </div>
                                  <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '16px' }}>
                                    📅 {formatujWyswietlanie(proba.data_czas)}
                                  </h4>
                                </div>
                                {isKadra && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    <button onClick={() => przelaczObecnosc(proba.id)} style={{ padding: '5px 10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                      {isRozwinietaDlaKadry ? 'Zwiń listę ▲' : 'Sprawdź obecność 📝'}
                                    </button>
                                    <button onClick={() => rozpocznijEdycje(proba)} style={{ padding: '5px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Edytuj ✏️</button>
                                    <button onClick={() => usunProbe(proba.id)} style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Usuń 🗑️</button>
                                  </div>
                                )}
                              </div>

                              <p style={{ margin: '10px 0', fontSize: '14px', color: '#334155' }}>
                                <strong>Program:</strong> {proba.opis_cwiczen}
                              </p>

                              {profile.rola === 'członek' && (
                                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Twoja deklaracja:</span>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {/* PRZYCISK: BĘDĘ */}
                                      <button 
                                        onClick={() => zaktualizujDeklaracje(proba.id, 'obecny')} 
                                        style={{ 
                                          padding: '8px 14px', 
                                          borderRadius: '20px', 
                                          border: '1px solid', 
                                          borderColor: statusDeklaracji === 'obecny' ? '#10b981' : '#cbd5e1', 
                                          backgroundColor: statusDeklaracji === 'obecny' ? '#10b981' : '#f8fafc', 
                                          color: statusDeklaracji === 'obecny' ? '#ffffff' : '#475569', 
                                          cursor: 'pointer', 
                                          fontWeight: 'bold', 
                                          fontSize: '13px' 
                                        }}
                                      >
                                        Będę 👍
                                      </button>

                                      {/* PRZYCISK: SPÓŹNIĘ SIĘ */}
                                      <button 
                                        onClick={() => zaktualizujDeklaracje(proba.id, 'spozniony')} 
                                        style={{ 
                                          padding: '8px 14px', 
                                          borderRadius: '20px', 
                                          border: '1px solid', 
                                          borderColor: statusDeklaracji === 'spozniony' ? '#f59e0b' : '#cbd5e1', 
                                          backgroundColor: statusDeklaracji === 'spozniony' ? '#f59e0b' : '#f8fafc', 
                                          color: statusDeklaracji === 'spozniony' ? '#ffffff' : '#475569', 
                                          cursor: 'pointer', 
                                          fontWeight: 'bold', 
                                          fontSize: '13px' 
                                        }}
                                      >
                                        Spóźnię się ⏰
                                      </button>

                                      {/* PRZYCISK: NIE BĘDĘ */}
                                      <button 
                                        onClick={() => zaktualizujDeklaracje(proba.id, 'nieobecny')} 
                                        style={{ 
                                          padding: '8px 14px', 
                                          borderRadius: '20px', 
                                          border: '1px solid', 
                                          borderColor: statusDeklaracji === 'nieobecny' ? '#ef4444' : '#cbd5e1', 
                                          backgroundColor: statusDeklaracji === 'nieobecny' ? '#ef4444' : '#f8fafc', 
                                          color: statusDeklaracji === 'nieobecny' ? '#ffffff' : '#475569', 
                                          cursor: 'pointer', 
                                          fontWeight: 'bold', 
                                          fontSize: '13px' 
                                        }}
                                      >
                                        Nie będę 👎
                                      </button>
                                    </div>
                                  </div>

                                  {/* FORMULARZ DLA SPÓŹNIENIA */}
                                  {statusDeklaracji === 'spozniony' && (
                                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                                      <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#b45309', fontWeight: '600' }}>
                                        ⏰ Informacja o spóźnieniu (godzina przybycia / powód):
                                      </p>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <input 
                                          type="text" 
                                          placeholder="np. Będę około 18:30 (korki / uczelnia)" 
                                          value={aktywneInputyUsprawiedliwienia[proba.id] || ''} 
                                          onChange={(e) => setAktywneInputyUsprawiedliwienia({ ...aktywneInputyUsprawiedliwienia, [proba.id]: e.target.value })} 
                                          style={{ flex: '1 1 150px', ...inputStyle }} 
                                        />
                                        <button 
                                          onClick={() => zapiszKomentarzDeklaracji(proba.id, 'spozniony')} 
                                          style={{ padding: '8px 14px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                                        >
                                          Zapisz
                                        </button>
                                      </div>
                                      {usprawiedliwienia[proba.id] && (
                                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#92400e', fontStyle: 'italic' }}>
                                          Zapisano: „{usprawiedliwienia[proba.id]}”
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* FORMULARZ DLA NIEOBECNOŚCI */}
                                  {statusDeklaracji === 'nieobecny' && (
                                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                      <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
                                        Powód nieobecności:
                                      </p>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <input 
                                          type="text" 
                                          placeholder="np. Choroba / Kolokwium" 
                                          value={aktywneInputyUsprawiedliwienia[proba.id] || ''} 
                                          onChange={(e) => setAktywneInputyUsprawiedliwienia({ ...aktywneInputyUsprawiedliwienia, [proba.id]: e.target.value })} 
                                          style={{ flex: '1 1 150px', ...inputStyle }} 
                                        />
                                        <button 
                                          onClick={() => zapiszKomentarzDeklaracji(proba.id, 'nieobecny')} 
                                          style={{ padding: '8px 14px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                                        >
                                          Zapisz
                                        </button>
                                      </div>
                                      {usprawiedliwienia[proba.id] && (
                                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#7f1d1d', fontStyle: 'italic' }}>
                                          Zapisano: „{usprawiedliwienia[proba.id]}”
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {isKadra && isRozwinietaDlaKadry && <ListaObecnosci probaId={proba.id} sekcja={proba.sekcja} />}
                            </>
                          )}
                        </div>
                      );
                    })}
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