import { useState, useEffect, Fragment } from 'react';
import { supabase } from './supabaseClient';
import WalizkiModal from './WalizkiModal';
import * as XLSX from 'xlsx';

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

const sortujOsoby = (lista) => {
  return [...lista].sort((a, b) => {
    const wagaSekcji = { 'balet': 1, 'chór': 2, 'kapela': 3 };
    const wagaA = wagaSekcji[a.sekcja] || 99;
    const wagaB = wagaSekcji[b.sekcja] || 99;
    if (wagaA !== wagaB) return wagaA - wagaB;
    
    const wagaGlos = { 'Pani': 1, 'Pan': 2, 'Sopran': 1, 'Alt': 2, 'Tenor': 3, 'Bas': 4 };
    const wgA = wagaGlos[a.glos] || 99;
    const wgB = wagaGlos[b.glos] || 99;
    if (wgA !== wgB) return wgA - wgB;

    return (a.imie_nazwisko || '').localeCompare(b.imie_nazwisko || '');
  });
};

export default function Koncerty({ profile }) {
  const [koncerty, setKoncerty] = useState([]);
  const [deklaracjeKoncertow, setDeklaracjeKoncertow] = useState({});
  const [zapisaniNaKoncert, setZapisaniNaKoncert] = useState({});
  const [programyKoncertow, setProgramyKoncertow] = useState({});
  const [obsadyProgramow, setObsadyProgramow] = useState({});
  const [goscieMacierzy, setGoscieMacierzy] = useState({}); 
  const [aktywnaPodzakladka, setAktywnaPodzakladka] = useState({});
  const [rozwinieteSklady, setRozwinieteSklady] = useState({});
  const [wybranyKoncertWalizki, setWybranyKoncertWalizki] = useState(null);

  const [widok, setWidok] = useState('nadchodzace');
  const [noweUklady, setNoweUklady] = useState({});
  const [nowyTypUkladu, setNowyTypUkladu] = useState({});

  const [edycjaProgramuId, setEdycjaProgramuId] = useState(null);
  const [editTytulUkladu, setEditTytulUkladu] = useState('');
  const [editTypUkladu, setEditTypUkladu] = useState('');

  const [tytul, setTytul] = useState('');
  const [dataKoncertu, setDataKoncertu] = useState('');
  const [godzinaKoncertu, setGodzinaKoncertu] = useState('18:00');
  const [miejsce, setMiejsce] = useState('');
  const [programOpis, setProgramOpis] = useState('');
  const [komunikat, setKomunikat] = useState('');

  const [edycjaKoncertId, setEdycjaKoncertId] = useState(null);
  const [editTytul, setEditTytul] = useState('');
  const [editDataKoncertu, setEditDataKoncertu] = useState('');
  const [editGodzinaKoncertu, setEditGodzinaKoncertu] = useState('');
  const [editMiejsce, setEditMiejsce] = useState('');
  const [editProgramOpis, setEditProgramOpis] = useState('');

  const isKierownik = profile?.rola === 'kierownik';
  const canManageProgram = profile?.rola === 'kierownik' || profile?.rola === 'pracownik';

  useEffect(() => {
    if (profile) pobierzKoncerty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const pobierzKoncerty = async () => {
    try {
      const { data, error } = await supabase.from('koncerty').select('*').order('data_czas', { ascending: true });
      if (error) throw error;
      
      if (data) {
        setKoncerty(data);
        if (profile.rola === 'członek') pobierzMojeDeklaracjeKoncertow();
        pobierzWszystkichZapisanych(data);
        pobierzProgramy(data);
        pobierzGosciMacierzy(data);
      }
    } catch (err) {
      console.error('Błąd pobierania koncertów:', err);
    }
  };

  const pobierzMojeDeklaracjeKoncertow = async () => {
    try {
      const { data, error } = await supabase.from('deklaracje_koncerty').select('id_koncertu, planuje').eq('id_uzytkownika', profile.id);
      if (error) throw error;
      if (data) {
        const mapa = {}; 
        data.forEach(d => { mapa[d.id_koncertu] = d.planuje; });
        setDeklaracjeKoncertow(mapa);
      }
    } catch (err) {
      console.error('Błąd pobierania moich deklaracji:', err);
    }
  };

  const pobierzWszystkichZapisanych = async (listaKoncertow) => {
    try {
      const koncertIds = listaKoncertow.map(k => k.id);
      if (koncertIds.length === 0) return;

      const { data: dekData, error: dekErr } = await supabase
        .from('deklaracje_koncerty')
        .select(`
          id,
          id_koncertu,
          id_uzytkownika,
          planuje,
          zakwalifikowany,
          profiles (
            id,
            imie_nazwisko,
            sekcja,
            glos,
            avatar_url
          )
        `)
        .in('id_koncertu', koncertIds);

      if (dekErr) throw dekErr;

      if (dekData) {
        const mapaZapisanych = {}; 
        koncertIds.forEach(id => { mapaZapisanych[id] = []; });
        
        dekData.forEach(d => {
          const prof = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          if (prof) {
            mapaZapisanych[d.id_koncertu].push({
              id: d.id,
              id_uzytkownika: d.id_uzytkownika,
              planuje: d.planuje,
              zakwalifikowany: d.zakwalifikowany,
              imie_nazwisko: prof.imie_nazwisko,
              sekcja: prof.sekcja,
              glos: prof.glos,
              avatar_url: prof.avatar_url
            });
          }
        });
        setZapisaniNaKoncert(mapaZapisanych);
      }
    } catch (err) {
      console.error('Błąd pobierania zapisanych osób:', err);
    }
  };

  const pobierzProgramy = async (listaKoncertow) => {
    try {
      const koncertIds = listaKoncertow.map(k => k.id);
      if (koncertIds.length === 0) return;

      const { data: progData, error: progErr } = await supabase.from('koncert_program').select('*').in('id_koncertu', koncertIds).order('id', { ascending: true });
      if (progErr) throw progErr;
      
      if (progData) {
        const mapaProgramow = {}; 
        koncertIds.forEach(id => { mapaProgramow[id] = []; });
        progData.forEach(p => { if (mapaProgramow[p.id_koncertu]) mapaProgramow[p.id_koncertu].push(p); });
        setProgramyKoncertow(mapaProgramow);

        const programIds = progData.map(p => p.id);
        if (programIds.length > 0) {
          const { data: obsData, error: obsErr } = await supabase.from('koncert_obsada').select('*').in('id_programu', programIds);
          if (obsErr) throw obsErr;
          
          const mapaObsad = {}; 
          programIds.forEach(id => { mapaObsad[id] = []; });
          if (obsData) {
            obsData.forEach(o => { if (mapaObsad[o.id_programu]) mapaObsad[o.id_programu].push(o.id_uzytkownika); });
          }
          setObsadyProgramow(mapaObsad);
        }
      }
    } catch (err) {
      console.error('Błąd pobierania programów/obsady:', err);
    }
  };

  const pobierzGosciMacierzy = async (listaKoncertow) => {
    try {
      const koncertIds = listaKoncertow.map(k => k.id);
      if (koncertIds.length === 0) return;

      const { data, error } = await supabase.from('koncert_goscie_macierzy').select('*').in('id_koncertu', koncertIds);
      if (error) throw error;
      
      if (data) {
        const mapa = {};
        koncertIds.forEach(id => mapa[id] = []);
        data.forEach(g => {
          if (mapa[g.id_koncertu]) mapa[g.id_koncertu].push(g);
        });
        setGoscieMacierzy(mapa);
      }
    } catch (err) {
      console.error('Błąd pobierania gości macierzy:', err);
    }
  };

  const dodajKoncert = async (e) => {
    e.preventDefault();
    if (!dataKoncertu) { alert('Wybierz datę z kalendarza.'); return; }
    setKomunikat('Dodawanie koncertu...');
    const pelnaDataCzas = `${dataKoncertu}T${godzinaKoncertu}:00`;
    const { error } = await supabase.from('koncerty').insert([{ tytul, data_czas: pelnaDataCzas, miejsce, program: programOpis }]);
    if (!error) {
      setKomunikat('Koncert dodany pomyślnie! ✅');
      setTytul(''); setDataKoncertu(''); setMiejsce(''); setProgramOpis('');
      pobierzKoncerty(); 
      setTimeout(() => setKomunikat(''), 3000);
    } else {
      setKomunikat('Błąd: ' + error.message);
    }
  };

  const usunKoncert = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten koncert?')) return;
    const { error } = await supabase.from('koncerty').delete().eq('id', id);
    if (!error) pobierzKoncerty();
    else alert('Błąd: ' + error.message);
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
    if (!editDataKoncertu || !editGodzinaKoncertu) return;
    const pelnaDataCzas = `${editDataKoncertu}T${editGodzinaKoncertu}:00`;
    const { error } = await supabase.from('koncerty').update({ tytul: editTytul, data_czas: pelnaDataCzas, miejsce: editMiejsce, program: editProgramOpis }).eq('id', koncertId);
    if (!error) { setEdycjaKoncertId(null); pobierzKoncerty(); }
    else alert('Błąd zapisu: ' + error.message);
  };

  const zaktualizujDeklaracjeKoncertu = async (koncertId, statusPlanuje) => {
    const { error } = await supabase.from('deklaracje_koncerty').upsert([{ id_koncertu: koncertId, id_uzytkownika: profile.id, planuje: statusPlanuje }], { onConflict: 'id_koncertu, id_uzytkownika' });
    if (!error) { 
      setDeklaracjeKoncertow(prev => ({ ...prev, [koncertId]: statusPlanuje })); 
      pobierzKoncerty(); 
    } else {
      alert('Błąd zapisywania deklaracji: ' + error.message);
    }
  };

  const zmienKwalifikacje = async (koncertId, userId, statusZakwalifikowany) => {
    const { error } = await supabase.from('deklaracje_koncerty').update({ zakwalifikowany: statusZakwalifikowany }).eq('id_koncertu', koncertId).eq('id_uzytkownika', userId);
    if (!error) pobierzKoncerty();
    else alert('Błąd: ' + error.message);
  };

  const dodajPunktProgramu = async (koncertId) => {
    const tytulUkladu = noweUklady[koncertId];
    const typUkladu = nowyTypUkladu[koncertId] || 'baletowy';
    if (!tytulUkladu || tytulUkladu.trim() === '') return;
    const { error } = await supabase.from('koncert_program').insert([{ id_koncertu: koncertId, tytul_ukladu: tytulUkladu.trim(), typ_ukladu: typUkladu }]);
    if (!error) { 
      setNoweUklady(prev => ({ ...prev, [koncertId]: '' })); 
      pobierzKoncerty(); 
    } else {
      alert("Błąd dodawania układu: " + error.message);
    }
  };

  const usunPunktProgramu = async (programId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten układ z programu?')) return;
    const { error } = await supabase.from('koncert_program').delete().eq('id', programId);
    if (!error) pobierzKoncerty();
    else alert('Błąd: ' + error.message);
  };

  const rozpocznijEdycjeProgramu = (prog) => {
    setEdycjaProgramuId(prog.id);
    setEditTytulUkladu(prog.tytul_ukladu);
    setEditTypUkladu(prog.typ_ukladu || 'baletowy');
  };

  const anulujEdycjeProgramu = () => {
    setEdycjaProgramuId(null);
  };

  const zapiszEdycjeProgramu = async (programId) => {
    if (!editTytulUkladu || editTytulUkladu.trim() === '') return;
    const { error } = await supabase.from('koncert_program').update({ 
      tytul_ukladu: editTytulUkladu.trim(), 
      typ_ukladu: editTypUkladu 
    }).eq('id', programId);
    
    if (!error) {
      setEdycjaProgramuId(null);
      pobierzKoncerty();
    } else {
      alert('Błąd zapisu układu: ' + error.message);
    }
  };

  const przelaczObsadeWMacierzy = async (programId, userId, czyBylOznaczony) => {
    setObsadyProgramow(prev => {
      const aktualniCzlonkowie = prev[programId] || [];
      if (czyBylOznaczony) {
        return { ...prev, [programId]: aktualniCzlonkowie.filter(id => id !== userId) };
      } else {
        return { ...prev, [programId]: [...aktualniCzlonkowie, userId] };
      }
    });

    if (czyBylOznaczony) {
      const { error } = await supabase.from('koncert_obsada').delete().eq('id_programu', programId).eq('id_uzytkownika', userId);
      if (error) alert("Błąd usuwania z obsady: " + error.message);
    } else {
      const { error } = await supabase.from('koncert_obsada').insert([{ id_programu: programId, id_uzytkownika: userId }]);
      if (error) alert("Błąd dodawania do obsady: " + error.message);
    }
  };

  const dodajGosciaDoMacierzy = async (koncertId, userId, macierz, grupa) => {
    if (!userId) return;
    const { error } = await supabase.from('koncert_goscie_macierzy').insert([{
      id_koncertu: koncertId,
      id_uzytkownika: userId,
      docelowa_macierz: macierz,
      docelowa_grupa: grupa
    }]);
    if (!error) pobierzKoncerty();
    else alert('Błąd: ' + error.message);
  };

  const usunGosciaZMacierzy = async (goscId) => {
    if (!window.confirm('Czy na pewno usunąć tę osobę z macierzy? (Zniknie stąd, ale pozostanie w swojej głównej sekcji)')) return;
    const { error } = await supabase.from('koncert_goscie_macierzy').delete().eq('id', goscId);
    if (!error) pobierzKoncerty();
    else alert('Błąd: ' + error.message);
  };

  const przelaczRozwiniecieSkladu = (koncertId) => { setRozwinieteSklady(prev => ({ ...prev, [koncertId]: !prev[koncertId] })); };
  const ustawPodzakladke = (koncertId, tab) => { setAktywnaPodzakladka(prev => ({ ...prev, [koncertId]: tab })); };

  // ----------------------------------------------------
  // GENERATOR PLIKÓW EXCEL (.XLSX)
  // ----------------------------------------------------
  const eksportujDoExcela = (koncert, wszyscyZgloszeni, programyTegoKoncertu, bKwal, cKwal, kKwal) => {
    const chetni = wszyscyZgloszeni.filter(z => z.planuje === true);
    
    const baletPrograms = programyTegoKoncertu.filter(p => ['baletowy', 'ogólny'].includes(p.typ_ukladu));
    const chorPrograms = programyTegoKoncertu.filter(p => ['chóralny', 'ogólny'].includes(p.typ_ukladu));
    const kapelaPrograms = programyTegoKoncertu.filter(p => ['kapeli', 'ogólny'].includes(p.typ_ukladu));

    const daneArkusz1 = [
      ['RAPORT ZGŁOSZEŃ', `Koncert: ${koncert.tytul}`, `Data: ${formatujDate(koncert.data_czas)}`],
      [],
      ['Sekcja', 'Głos / Grupa', 'Imię i nazwisko', 'Status kwalifikacji']
    ];

    sortujOsoby(chetni).forEach(osoba => {
      daneArkusz1.push([
        osoba.sekcja,
        osoba.glos || '-',
        osoba.imie_nazwisko,
        osoba.zakwalifikowany ? 'ZAKWALIFIKOWANY' : 'REZERWA'
      ]);
    });

    const daneArkusz2 = [];

    const generujSekcjeDoExcela = (nazwaSekcji, grupy, osoby, programy) => {
      if (osoby.length === 0) return;

      daneArkusz2.push(['Sekcja', 'Grupa/Głos', 'Imię i nazwisko', ...programy.map(p => p.tytul_ukladu)]);

      let isFirstGrupaInSekcja = true;

      grupy.forEach(grupa => {
        const osobyWGrupie = osoby.filter(o => (o.glos || '') === grupa);
        if (osobyWGrupie.length === 0 && grupa !== '') return;

        daneArkusz2.push([isFirstGrupaInSekcja ? nazwaSekcji : '', grupa, '', ...programy.map(() => '')]);
        isFirstGrupaInSekcja = false;

        osobyWGrupie.forEach(o => {
          const imieZNazwiskiem = o.isGosc ? `${o.imie_nazwisko} (${o.prawdziwaSekcja})` : o.imie_nazwisko;
          const wierszOsoby = ['', '', imieZNazwiskiem];
          
          programy.forEach(prog => {
            const czyWystepuje = (obsadyProgramow[prog.id] || []).includes(o.id_uzytkownika);
            wierszOsoby.push(czyWystepuje ? 1 : '');
          });

          daneArkusz2.push(wierszOsoby);
        });
      });
      daneArkusz2.push([]);
    };

    generujSekcjeDoExcela('Balet', ['Pani', 'Pan', ''], bKwal, baletPrograms);
    generujSekcjeDoExcela('Chór', ['Sopran', 'Alt', 'Tenor', 'Bas', ''], cKwal, chorPrograms);
    generujSekcjeDoExcela('Kapela', [''], kKwal, kapelaPrograms);

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(daneArkusz1);
    const ws2 = XLSX.utils.aoa_to_sheet(daneArkusz2);

    ws1['!cols'] = [{wch: 12}, {wch: 15}, {wch: 25}, {wch: 20}];
    
    const maxProg = Math.max(baletPrograms.length, chorPrograms.length, kapelaPrograms.length);
    const colsA2 = [{wch: 12}, {wch: 15}, {wch: 30}]; 
    for(let i=0; i<maxProg; i++) colsA2.push({wch: 15});
    ws2['!cols'] = colsA2;

    XLSX.utils.book_append_sheet(wb, ws1, 'Zgłoszeni na koncert');
    XLSX.utils.book_append_sheet(wb, ws2, 'Macierz Obsady');

    const czystyTytul = koncert.tytul.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Koncert_${czystyTytul}.xlsx`);
  };

  // ----------------------------------------------------
  // RENDERER UI Z PODZIAŁEM W STYLU EXCELA I OCHOTNIKAMI
  // ----------------------------------------------------
  const renderMacierzUI = (koncertId, nazwaSekcji, ikonaSekcji, grupy, osoby, programy, wszyscyZakwalifikowani) => {
    if (osoby.length === 0 && programy.length === 0) return null;

    let isFirstGroupGlobal = true;
    const wolniDoDodania = wszyscyZakwalifikowani.filter(z => !osoby.some(o => o.id_uzytkownika === z.id_uzytkownika));
    
    const dropdownOpcje = nazwaSekcji === 'Balet' 
      ? <><option value="">-- Wybierz płeć --</option><option value="Pani">Pani</option><option value="Pan">Pan</option></>
      : nazwaSekcji === 'Chór'
      ? <><option value="">-- Wybierz głos --</option><option value="Sopran">Sopran</option><option value="Alt">Alt</option><option value="Tenor">Tenor</option><option value="Bas">Bas</option></>
      : <option value="">Ogólna</option>;

    return (
      <div style={{ marginBottom: '30px', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
        <h5 style={{ margin: 0, padding: '12px 15px', backgroundColor: '#f8fafc', color: '#1e293b', borderBottom: '1px solid #cbd5e1' }}>
          {ikonaSekcji} Macierz: {nazwaSekcji}
        </h5>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: '#fff' }}>
            <thead style={{ backgroundColor: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '10px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', textAlign: 'left', width: '90px' }}>Sekcja</th>
                <th style={{ padding: '10px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', textAlign: 'left', width: '110px' }}>Grupa/Głos</th>
                <th style={{ padding: '10px', borderRight: '2px solid #94a3b8', borderBottom: '2px solid #94a3b8', textAlign: 'left', width: '220px' }}>Imię i nazwisko</th>
                {programy.map((prog) => (
                  <th key={prog.id} style={{ padding: '10px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {prog.tytul_ukladu}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupy.map((grupa) => {
                const osobyWGrupie = osoby.filter(o => (o.glos || '') === grupa);
                if (osobyWGrupie.length === 0 && grupa !== '') return null;

                const nazwaSekcjiDoWyswietlenia = isFirstGroupGlobal ? nazwaSekcji : '';
                isFirstGroupGlobal = false;

                return (
                  <Fragment key={grupa || 'brak'}>
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>{nazwaSekcjiDoWyswietlenia}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', color: '#d97706' }}>{grupa || 'Ogólne'}</td>
                      <td style={{ padding: '8px 10px', borderRight: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0' }}></td>
                      {programy.map(p => <td key={`empty-${p.id}`} style={{ borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></td>)}
                    </tr>
                    
                    {osobyWGrupie.map(osoba => (
                      <tr key={osoba.id_uzytkownika}>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></td>
                        <td style={{ padding: '8px 10px', borderRight: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>
                              {osoba.imie_nazwisko}
                              {osoba.isGosc && <span style={{ color: '#8b5cf6', fontSize: '11px', marginLeft: '4px' }}>({osoba.prawdziwaSekcja})</span>}
                            </span>
                            {osoba.isGosc && canManageProgram && (
                              <button onClick={() => usunGosciaZMacierzy(osoba.id_goscia)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }} title="Usuń gościa z macierzy">❌</button>
                            )}
                          </div>
                        </td>
                        {programy.map(prog => {
                          const czyAktualnieW = (obsadyProgramow[prog.id] || []).includes(osoba.id_uzytkownika);
                          return (
                            <td 
                              key={prog.id} 
                              style={{ padding: '0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', textAlign: 'center', backgroundColor: czyAktualnieW ? '#d1fae5' : '#ffffff', cursor: canManageProgram ? 'pointer' : 'default', transition: 'background-color 0.1s' }}
                              onClick={() => { if(canManageProgram) przelaczObsadeWMacierzy(prog.id, osoba.id_uzytkownika, czyAktualnieW) }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '35px' }}>
                                {czyAktualnieW ? <span style={{ color: '#10b981', fontWeight: '900', fontSize: '16px' }}>1</span> : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>-</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {canManageProgram && wolniDoDodania.length > 0 && (
          <div style={{ padding: '12px 15px', backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>➕ Dodaj do macierzy członka z innej sekcji:</span>
            <select id={`gosc-user-${koncertId}-${nazwaSekcji}`} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
              <option value="">-- Wybierz członka --</option>
              {sortujOsoby(wolniDoDodania).map(z => (
                <option key={z.id_uzytkownika} value={z.id_uzytkownika}>{z.imie_nazwisko} ({z.sekcja})</option>
              ))}
            </select>
            {nazwaSekcji !== 'Kapela' && (
              <select id={`gosc-grupa-${koncertId}-${nazwaSekcji}`} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                {dropdownOpcje}
              </select>
            )}
            <button 
              onClick={() => {
                const userSel = document.getElementById(`gosc-user-${koncertId}-${nazwaSekcji}`);
                const grupaSel = document.getElementById(`gosc-grupa-${koncertId}-${nazwaSekcji}`);
                const wybranaGrupa = grupaSel ? grupaSel.value : '';
                
                if (userSel && userSel.value) {
                  dodajGosciaDoMacierzy(koncertId, userSel.value, nazwaSekcji, wybranaGrupa);
                  userSel.value = '';
                  if(grupaSel) grupaSel.value = '';
                }
              }}
              style={{ padding: '6px 12px', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Dodaj
            </button>
          </div>
        )}
      </div>
    );
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', color: '#000' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' };

  const teraz = new Date();
  const nadchodzaceKoncerty = koncerty.filter(k => new Date(k.data_czas) >= teraz);
  const odbyteKoncerty = koncerty.filter(k => new Date(k.data_czas) < teraz).sort((a, b) => new Date(b.data_czas) - new Date(a.data_czas));
  const wyswietlaneKoncerty = widok === 'nadchodzace' ? nadchodzaceKoncerty : odbyteKoncerty;

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '15px', fontSize: '20px' }}>Koncerty i Wydarzenia 🎻</h2>

      {isKierownik && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Zaplanuj nowy koncert</h3>
          <form onSubmit={dodajKoncert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Tytuł:</label>
              <input type="text" placeholder="Tytuł (np. Koncert Jubileuszowy)" value={tytul} onChange={(e) => setTytul(e.target.value)} required style={inputStyle} />
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

      {/* Przełącznik zakładek */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setWidok('nadchodzace')} style={{ padding: '8px 16px', backgroundColor: widok === 'nadchodzace' ? '#8b5cf6' : '#f8fafc', color: widok === 'nadchodzace' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          Nadchodzące ({nadchodzaceKoncerty.length})
        </button>
        <button onClick={() => setWidok('odbyte')} style={{ padding: '8px 16px', backgroundColor: widok === 'odbyte' ? '#8b5cf6' : '#f8fafc', color: widok === 'odbyte' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          Odbyte koncerty ({odbyteKoncerty.length})
        </button>
      </div>
      
      {wyswietlaneKoncerty.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak koncertów w tej zakładce.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {wyswietlaneKoncerty.map(koncert => {
            const deklaracjaUzytkownika = deklaracjeKoncertow[koncert.id];
            const zapisani = zapisaniNaKoncert[koncert.id] || [];
            const isRozwiniete = rozwinieteSklady[koncert.id];
            const podzakladka = aktywnaPodzakladka[koncert.id] || 'sklad';
            const programyDlaKoncertu = programyKoncertow[koncert.id] || [];
            const czyEdytowany = edycjaKoncertId === koncert.id;

            const chetni = zapisani.filter(z => z.planuje === true);
            const zakwalifikowaniWszyscy = chetni.filter(z => z.zakwalifikowany === true);
            
            const goscieTegoKoncertu = goscieMacierzy[koncert.id] || [];
            const mapujGosci = (macierz) => {
              return goscieTegoKoncertu.filter(g => g.docelowa_macierz === macierz).map(g => {
                const org = zakwalifikowaniWszyscy.find(z => z.id_uzytkownika === g.id_uzytkownika);
                if (!org) return null;
                return {
                  ...org,
                  prawdziwaSekcja: org.sekcja,
                  sekcja: org.sekcja, 
                  glos: g.docelowa_grupa,
                  isGosc: true,
                  id_goscia: g.id
                };
              }).filter(Boolean);
            };

            const bazowyBalet = zakwalifikowaniWszyscy.filter(z => z.sekcja === 'balet');
            const bazowyChor = zakwalifikowaniWszyscy.filter(z => z.sekcja === 'chór');
            const bazowaKapela = zakwalifikowaniWszyscy.filter(z => z.sekcja === 'kapela');

            const baletKwalifikowani = sortujOsoby([...bazowyBalet, ...mapujGosci('Balet')]);
            const chorKwalifikowani = sortujOsoby([...bazowyChor, ...mapujGosci('Chór')]);
            const kapelaKwalifikowani = sortujOsoby([...bazowaKapela, ...mapujGosci('Kapela')]);

            const baletPrograms = programyDlaKoncertu.filter(p => ['baletowy', 'ogólny'].includes(p.typ_ukladu));
            const chorPrograms = programyDlaKoncertu.filter(p => ['chóralny', 'ogólny'].includes(p.typ_ukladu));
            const kapelaPrograms = programyDlaKoncertu.filter(p => ['kapeli', 'ogólny'].includes(p.typ_ukladu));

            return (
              <div key={koncert.id} style={{ borderLeft: widok === 'nadchodzace' ? '6px solid #8b5cf6' : '6px solid #94a3b8', padding: '20px', backgroundColor: widok === 'nadchodzace' ? '#faf5ff' : '#f8fafc', borderRadius: '8px', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
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
                        <h4 style={{ margin: '0 0 5px 0', color: widok === 'odbyte' ? '#64748b' : '#1e293b', fontSize: '18px' }}>{koncert.tytul}</h4>
                        <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#475569' }}>
                          📅 <strong>{formatujDate(koncert.data_czas)}</strong> | 📍 {koncert.miejsce}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <button onClick={() => setWybranyKoncertWalizki(koncert)} style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>🧳 Walizki</button>
                        {isKierownik && (
                          <>
                            <button onClick={() => rozpocznijEdycje(koncert)} style={{ padding: '5px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Edytuj ✏️</button>
                            <button onClick={() => usunKoncert(koncert.id)} style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Usuń 🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: '10px 0', fontSize: '14px', color: '#334155' }}><strong>Opis:</strong> {koncert.program}</p>

                    {profile.rola === 'członek' && widok === 'nadchodzace' && (
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
                        <div style={{ marginTop: '12px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                          <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <button onClick={() => ustawPodzakladke(koncert.id, 'sklad')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: podzakladka === 'sklad' ? '#8b5cf6' : '#f1f5f9', color: podzakladka === 'sklad' ? '#fff' : '#475569' }}>👥 Skład i kwalifikacje</button>
                            <button onClick={() => ustawPodzakladke(koncert.id, 'program')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: podzakladka === 'program' ? '#8b5cf6' : '#f1f5f9', color: podzakladka === 'program' ? '#fff' : '#475569' }}>📋 Dodawanie programu</button>
                            <button onClick={() => ustawPodzakladke(koncert.id, 'macierz')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: podzakladka === 'macierz' ? '#8b5cf6' : '#f1f5f9', color: podzakladka === 'macierz' ? '#fff' : '#475569' }}>📊 Macierz Obsady (Excel)</button>
                          </div>
                          
                          {podzakladka === 'sklad' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              <div>
                                <h5 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #8b5cf6', paddingBottom: '4px' }}>🩰 Balet (Ogółem: {bazowyBalet.length} zgłoszonych)</h5>
                                {['Pani', 'Pan'].map(grupaName => {
                                  const osobyGrupy = bazowyBalet.filter(o => o.glos === grupaName);
                                  if (osobyGrupy.length === 0) return null;
                                  return (
                                    <div key={grupaName} style={{ marginTop: '10px', paddingLeft: '10px' }}>
                                      {renderujListeOsobek(`• ${grupaName === 'Pani' ? 'Panie' : 'Panowie'} (${grupaName})`, osobyGrupy, koncert.id, profile, zmienKwalifikacje, true)}
                                    </div>
                                  );
                                })}
                                {bazowyBalet.some(o => !o.glos) && (
                                  <div style={{ marginTop: '10px', paddingLeft: '10px' }}>
                                    {renderujListeOsobek('• Bez przypisania', bazowyBalet.filter(o => !o.glos), koncert.id, profile, zmienKwalifikacje, true)}
                                  </div>
                                )}
                                {bazowyBalet.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>Brak zgłoszeń w balecie</p>}
                              </div>

                              <div>
                                <h5 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #d69e2e', paddingBottom: '4px' }}>🎤 Chór (Ogółem: {bazowyChor.length} zgłoszonych)</h5>
                                {['Sopran', 'Alt', 'Tenor', 'Bas'].map(glosName => {
                                  const osobyGlosu = bazowyChor.filter(o => (o.glos || 'Sopran') === glosName);
                                  if (osobyGlosu.length === 0) return null;
                                  return <div key={glosName} style={{ marginTop: '10px', paddingLeft: '10px' }}>{renderujListeOsobek(`• ${glosName}`, osobyGlosu, koncert.id, profile, zmienKwalifikacje, true)}</div>;
                                })}
                                {bazowyChor.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>Brak zgłoszeń w chórze</p>}
                              </div>

                              {renderujListeOsobek('🎻 Kapela', bazowaKapela, koncert.id, profile, zmienKwalifikacje)}
                            </div>
                          )}
                          
                          {podzakladka === 'program' && (
                            <div>
                              <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b' }}>Zarządzanie listą układów na koncercie:</h5>
                              {canManageProgram && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                                  <select 
                                    value={nowyTypUkladu[koncert.id] || 'baletowy'} 
                                    onChange={(e) => setNowyTypUkladu({ ...nowyTypUkladu, [koncert.id]: e.target.value })}
                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
                                  >
                                    <option value="baletowy">🩰 Baletowy</option>
                                    <option value="chóralny">🎤 Chóralny</option>
                                    <option value="kapeli">🎻 Kapeli</option>
                                    <option value="ogólny">🎭 Ogólny / Mieszany</option>
                                  </select>
                                  <input type="text" placeholder="Wpisz układ (np. Tańce rzeszowskie)" value={noweUklady[koncert.id] || ''} onChange={(e) => setNoweUklady({ ...noweUklady, [koncert.id]: e.target.value })} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', minWidth: '150px' }} />
                                  <button onClick={() => dodajPunktProgramu(koncert.id)} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Dodaj układ ➕</button>
                                </div>
                              )}
                              {programyDlaKoncertu.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#718096' }}>Brak zdefiniowanych układów. Dodaj je wyżej.</p>
                              ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                  {programyDlaKoncertu.map((prog, index) => {
                                    const typIcon = prog.typ_ukladu === 'chóralny' ? '🎤' : prog.typ_ukladu === 'kapeli' ? '🎻' : prog.typ_ukladu === 'ogólny' ? '🎭' : '🩰';
                                    
                                    return (
                                      <li key={prog.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderBottom: '1px solid #e2e8f0' }}>
                                        {edycjaProgramuId === prog.id ? (
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <select 
                                              value={editTypUkladu} 
                                              onChange={(e) => setEditTypUkladu(e.target.value)}
                                              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                            >
                                              <option value="baletowy">🩰 Baletowy</option>
                                              <option value="chóralny">🎤 Chóralny</option>
                                              <option value="kapeli">🎻 Kapeli</option>
                                              <option value="ogólny">🎭 Ogólny / Mieszany</option>
                                            </select>
                                            <input 
                                              type="text" 
                                              value={editTytulUkladu} 
                                              onChange={(e) => setEditTytulUkladu(e.target.value)} 
                                              style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', minWidth: '150px' }} 
                                            />
                                            <button onClick={() => zapiszEdycjeProgramu(prog.id)} style={{ padding: '4px 10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Zapisz</button>
                                            <button onClick={anulujEdycjeProgramu} style={{ padding: '4px 10px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Anuluj</button>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>{index + 1}. {typIcon} {prog.tytul_ukladu}</span>
                                            {canManageProgram && (
                                              <div style={{ display: 'flex', gap: '6px' }}>
                                                <button onClick={() => rozpocznijEdycjeProgramu(prog)} style={{ padding: '2px 6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Edytuj ✏️</button>
                                                <button onClick={() => usunPunktProgramu(prog.id)} style={{ padding: '2px 6px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Usuń ❌</button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}

                          {podzakladka === 'macierz' && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                                <h5 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>Zarządzaj Obsadą (Klikaj w kratki, by dodawać 1)</h5>
                                <button 
                                  onClick={() => eksportujDoExcela(koncert, zapisani, programyDlaKoncertu, baletKwalifikowani, chorKwalifikowani, kapelaKwalifikowani)} 
                                  style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                                >
                                  Pobierz jako Excel (.xlsx) 📥
                                </button>
                              </div>

                              {programyDlaKoncertu.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#718096' }}>Dodaj najpierw programy w zakładce "Program", aby wygenerować macierz.</p>
                              ) : zakwalifikowaniWszyscy.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#718096' }}>Nie ma jeszcze żadnych zakwalifikowanych członków. Zakwalifikuj ich w zakładce Skład.</p>
                              ) : (
                                <>
                                  {renderMacierzUI(koncert.id, 'Balet', '🩰', ['Pani', 'Pan', ''], baletKwalifikowani, baletPrograms, zakwalifikowaniWszyscy)}
                                  {renderMacierzUI(koncert.id, 'Chór', '🎤', ['Sopran', 'Alt', 'Tenor', 'Bas', ''], chorKwalifikowani, chorPrograms, zakwalifikowaniWszyscy)}
                                  {renderMacierzUI(koncert.id, 'Kapela', '🎻', [''], kapelaKwalifikowani, kapelaPrograms, zakwalifikowaniWszyscy)}
                                </>
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

      {wybranyKoncertWalizki && (
        <WalizkiModal koncert={wybranyKoncertWalizki} profile={profile} onClose={() => setWybranyKoncertWalizki(null)} />
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