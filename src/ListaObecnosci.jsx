import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const RenderAvatar = ({ url }) => (
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>👤</span>}
  </div>
);

export default function ListaObecnosci({ probaId, sekcja }) {
  const [glowneProfile, setGlowneProfile] = useState([]);
  const [goscinneProfile, setGoscinneProfile] = useState([]);
  const [daneObecnosci, setDaneObecnosci] = useState({});

  useEffect(() => {
    pobierzOsobyIDeklaracje();
  }, [probaId, sekcja]);

  const pobierzOsobyIDeklaracje = async () => {
    let profQuery = supabase.from('profiles').select('id, imie_nazwisko, sekcja, glos, avatar_url').eq('status', 'zatwierdzony').eq('rola', 'członek');

    // Jeśli to próba generalna, pobieramy WSZYSTKICH członków zespołu. W przeciwnym razie tylko daną sekcję.
    if (sekcja !== 'generalna') {
      profQuery = profQuery.eq('sekcja', sekcja);
    }

    const { data: profData } = await profQuery.order('imie_nazwisko', { ascending: true });
    if (profData) setGlowneProfile(profData);

    if (sekcja !== 'generalna') {
      const { data: dodatkoweData } = await supabase.from('dodatkowe_sekcje').select('id_uzytkownika').eq('sekcja', sekcja).eq('status', 'zatwierdzony');
      if (dodatkoweData && dodatkoweData.length > 0) {
        const ids = dodatkoweData.map(d => d.id_uzytkownika);
        const { data: goscieData } = await supabase.from('profiles').select('id, imie_nazwisko, sekcja, glos, avatar_url').in('id', ids).eq('status', 'zatwierdzony').order('imie_nazwisko', { ascending: true });
        if (goscieData) setGoscinneProfile(goscieData);
      } else {
        setGoscinneProfile([]);
      }
    } else {
      setGoscinneProfile([]); // W próbie generalnej wszyscy są na liście głównej
    }

    const { data: dekData } = await supabase.from('deklaracje_obecnosci').select('id_uzytkownika, planuje, usprawiedliwienie, obecny').eq('id_proby', probaId);
    const mapa = {};
    if (dekData) {
      dekData.forEach(d => { 
        mapa[d.id_uzytkownika] = { planuje: d.planuje, usprawiedliwienie: d.usprawiedliwienie, obecny: d.obecny }; 
      });
    }
    setDaneObecnosci(mapa);
  };

  const oznaczObecnosc = async (userId, statusObecnosci) => {
    const istniejace = daneObecnosci[userId] || {};
    
    const { error } = await supabase.from('deklaracje_obecnosci').upsert([
      { 
        id_proby: probaId, 
        id_uzytkownika: userId, 
        planuje: istniejace.planuje !== undefined ? istniejace.planuje : null,
        usprawiedliwienie: istniejace.usprawiedliwienie || null,
        obecny: statusObecnosci
      }
    ], { onConflict: 'id_proby, id_uzytkownika' });

    if (!error) {
      setDaneObecnosci(prev => ({
        ...prev,
        [userId]: { ...istniejace, obecny: statusObecnosci }
      }));
    } else {
      alert('Błąd odznaczania obecności: ' + error.message);
    }
  };

  const renderujWpisOsoby = (osoba, isGosc = false) => {
    const dane = daneObecnosci[osoba.id] || {};
    const { planuje, usprawiedliwienie, obecny } = dane;

    return (
      <li key={osoba.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: isGosc ? '#faf5ff' : '#f8fafc', borderRadius: '6px', border: isGosc ? '1px solid #f3e8ff' : '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <RenderAvatar url={osoba.avatar_url} />
            {osoba.imie_nazwisko} 
            {sekcja === 'generalna' && <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>({osoba.sekcja})</span>}
            {isGosc && <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}> (Gościnnie)</span>}
          </span>

          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Deklaracja: 
            {planuje === true ? (
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>Będzie 👍</span>
            ) : planuje === false ? (
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Nie będzie 👎 {usprawiedliwienie && `(Powód: ${usprawiedliwienie})`}</span>
            ) : (
              <span>Brak ⚪</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => oznaczObecnosc(osoba.id, true)}
            style={{ 
              padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', border: '1px solid',
              backgroundColor: obecny === true ? '#10b981' : '#f1f5f9',
              color: obecny === true ? '#ffffff' : '#64748b',
              borderColor: obecny === true ? '#10b981' : '#cbd5e1'
            }}
          >
            Obecny ✅
          </button>
          
          <button 
            onClick={() => oznaczObecnosc(osoba.id, false)}
            style={{ 
              padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', border: '1px solid',
              backgroundColor: obecny === false ? '#ef4444' : '#f1f5f9',
              color: obecny === false ? '#ffffff' : '#64748b',
              borderColor: obecny === false ? '#ef4444' : '#cbd5e1'
            }}
          >
            Nieobecny ❌
          </button>
        </div>
      </li>
    );
  };

  return (
    <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <h5 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#1e293b' }}>📝 Sprawdź faktyczną obecność:</h5>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {glowneProfile.map(osoba => renderujWpisOsoby(osoba, false))}
      </ul>

      {goscinneProfile.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '15px' }}>
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6', margin: '0 0 6px 0', textTransform: 'uppercase' }}>Członkowie gościnni:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {goscinneProfile.map(gosc => renderujWpisOsoby(gosc, true))}
          </ul>
        </div>
      )}
    </div>
  );
}