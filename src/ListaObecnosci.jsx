import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ListaObecnosci({ probaId, sekcja }) {
  const [glowneProfile, setGlowneProfile] = useState([]);
  const [goscinneProfile, setGoscinneProfile] = useState([]);
  const [obecnosci, setObecnosci] = useState({}); // id_uzytkownika -> obecny (true/false/null)

  useEffect(() => {
    pobierzOsobyIDeklaracje();
  }, [probaId, sekcja]);

  const pobierzOsobyIDeklaracje = async () => {
    // 1. Stałe profile z tej sekcji
    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'zatwierdzony')
      .eq('rola', 'członek')
      .eq('sekcja', sekcja)
      .order('imie_nazwisko', { ascending: true });

    if (profData) setGlowneProfile(profData);

    // 2. Gościnne profile z dodatkowych sekcji
    const { data: dodatkoweData } = await supabase
      .from('dodatkowe_sekcje')
      .select('id_uzytkownika')
      .eq('sekcja', sekcja)
      .eq('status', 'zatwierdzony');

    if (dodatkoweData && dodatkoweData.length > 0) {
      const ids = dodatkoweData.map(d => d.id_uzytkownika);
      const { data: goscieData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids)
        .eq('status', 'zatwierdzony')
        .order('imie_nazwisko', { ascending: true });

      if (goscieData) setGoscinneProfile(goscieData);
    } else {
      setGoscinneProfile([]);
    }

    // 3. Pobierz deklaracje obecności dla tej próby
    const { data: dekData } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_uzytkownika, planuje')
      .eq('id_proby', probaId);

    const mapa = {};
    if (dekData) {
      dekData.forEach(d => {
        mapa[d.id_uzytkownika] = d.planuje;
      });
    }
    setObecnosci(mapa);
  };

  return (
    <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>Lista obecności i deklaracji (Widok Kadry):</h5>

      {/* Główni członkowie */}
      <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Członkowie stałi:</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {glowneProfile.map(osoba => {
          const planuje = obecnosci[osoba.id];
          return (
            <li key={osoba.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '4px', fontSize: '13px' }}>
              <span style={{ fontWeight: '500', color: '#1e293b' }}>{osoba.imie_nazwisko}</span>
              <div>
                {planuje === true ? (
                  <span style={{ color: '#10b981', fontWeight: 'bold', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>Deklaruje obecność 👍</span>
                ) : planuje === false ? (
                  <span style={{ color: '#ef4444', fontWeight: 'bold', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>Nieobecny 👎</span>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Brak deklaracji ⚪</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Gościnni członkowie */}
      {goscinneProfile.length > 0 && (
        <>
          <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b5cf6', margin: '10px 0 4px 0', textTransform: 'uppercase' }}>Członkowie gościnni (dodatkowa sekcja):</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {goscinneProfile.map(gosc => {
              const planuje = obecnosci[gosc.id];
              return (
                <li key={gosc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#faf5ff', borderRadius: '4px', fontSize: '13px', border: '1px solid #f3e8ff' }}>
                  <span style={{ fontWeight: '500', color: '#1e293b' }}>
                    {gosc.imie_nazwisko} <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '600' }}>(Gościnnie z: {gosc.sekcja})</span>
                  </span>
                  <div>
                    {planuje === true ? (
                      <span style={{ color: '#10b981', fontWeight: 'bold', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>Deklaruje obecność 👍</span>
                    ) : planuje === false ? (
                      <span style={{ color: '#ef4444', fontWeight: 'bold', backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>Nieobecny 👎</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>Brak deklaracji ⚪</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}