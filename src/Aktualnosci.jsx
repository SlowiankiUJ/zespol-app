import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Aktualnosci({ profile }) {
  const [wpisy, setWpisy] = useState([]);
  const [tytul, setTytul] = useState('');
  const [tresc, setTresc] = useState('');
  const [komunikat, setKomunikat] = useState('');
  const [odczytyMap, setOdczytyMap] = useState({});
  const [rozwinieteStatystyki, setRozwinieteStatystyki] = useState({});

  const isKierownik = profile?.rola === 'kierownik';

  useEffect(() => {
    if (profile) {
      pobierzAktualnosci();
    }
  }, [profile]);

  const pobierzAktualnosci = async () => {
    try {
      const { data, error } = await supabase
        .from('aktualnosci')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setWpisy(data);
        pobierzOdczyty(data.map(w => w.id));
      }
    } catch (err) {
      console.error("Błąd pobierania aktualności:", err.message);
    }
  };

  const pobierzOdczyty = async (wpisIds) => {
    if (!wpisIds || wpisIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('aktualnosci_odczyty')
        .select('id_aktualnosci, id_uzytkownika, profiles(imie_nazwisko, avatar_url, sekcja)')
        .in('id_aktualnosci', wpisIds);

      if (!error && data) {
        const mapa = {};
        wpisIds.forEach(id => { mapa[id] = []; });
        data.forEach(d => {
          if (mapa[d.id_aktualnosci] && d.profiles) {
            mapa[d.id_aktualnosci].push(d.profiles);
          }
        });
        setOdczytyMap(mapa);
      }
    } catch (err) {
      console.error("Błąd pobierania odczytów:", err);
    }
  };

  const oznaczJakoOdczytane = async (aktualnoscId) => {
    // Oznaczamy jako odczytane dla zwykłych członków (lub opcjonalnie także dla instruktora, jeśli ma tylko czytać)
    if (profile && (profile.rola === 'członek' || profile.rola === 'pracownik')) {
      await supabase
        .from('aktualnosci_odczyty')
        .upsert([{ id_aktualnosci: aktualnoscId, id_uzytkownika: profile.id }], { onConflict: 'id_aktualnosci, id_uzytkownika' });
    }
  };

  const dodajWpis = async (e) => {
    e.preventDefault();
    if (!tytul || !tresc) { alert('Wypełnij nagłówek i treść.'); return; }
    setKomunikat('Publikowanie...');

    const { error } = await supabase.from('aktualnosci').insert([{
      tytul,
      tresc,
      id_autora: profile.id
    }]);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Opublikowano pomyślnie! ✅');
      setTytul('');
      setTresc('');
      pobierzAktualnosci();
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const usunWpis = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę aktualność?')) return;
    const { error } = await supabase.from('aktualnosci').delete().eq('id', id);
    if (!error) pobierzAktualnosci();
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '14px' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '20px' }}>Aktualności i Komunikaty 📢</h2>

      {/* Formularz dodawania wpisu - TYLKO DLA KIEROWNIKA */}
      {isKierownik && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Dodaj nowy komunikat</h3>
          <form onSubmit={dodajWpis} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Nagłówek:</label>
              <input type="text" placeholder="Tytuł wiadomości" value={tytul} onChange={(e) => setTytul(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Treść:</label>
              <textarea placeholder="Treść komunikatu dla zespołu..." value={tresc} onChange={(e) => setTresc(e.target.value)} rows="4" required style={{...inputStyle, resize: 'vertical'}} />
            </div>
            <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              Opublikuj aktualność 🚀
            </button>
          </form>
          {komunikat && <p style={{ color: komunikat.includes('Błąd') ? '#dc3545' : 'green', marginTop: '10px', fontWeight: '500' }}>{komunikat}</p>}
        </div>
      )}

      {wpisy.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak aktualności.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {wpisy.map(wpis => {
            const odczytanePrzez = odczytyMap[wpis.id] || [];
            const czyRozwinieteStaty = rozwinieteStatystyki[wpis.id];
            
            // Rejestracja odczytu dla członka oraz instruktora
            if (profile?.rola === 'członek' || profile?.rola === 'pracownik') {
              oznaczJakoOdczytane(wpis.id);
            }

            return (
              <div key={wpis.id} style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '18px' }}>{wpis.tytul}</h3>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
                      Opublikowano: {new Date(wpis.created_at).toLocaleDateString('pl-PL')} o {new Date(wpis.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {/* Przycisk usuwania - TYLKO DLA KIEROWNIKA */}
                  {isKierownik && (
                    <button onClick={() => usunWpis(wpis.id)} style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Usuń 🗑️</button>
                  )}
                </div>

                <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {wpis.tresc}
                </p>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    👁️ Przeczytało: <strong>{odczytanePrzez.length}</strong> osób
                  </span>
                  {/* Przycisk podglądu statystyk odczytów - TYLKO DLA KIEROWNIKA */}
                  {isKierownik && (
                    <button 
                      onClick={() => setRozwinieteStatystyki(prev => ({ ...prev, [wpis.id]: !prev[wpis.id] }))}
                      style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {czyRozwinieteStaty ? 'Zwiń listę odczytów ▲' : 'Zobacz kto odczytał 👥'}
                    </button>
                  )}
                </div>

                {/* Rozwijana lista osób, które odczytały - TYLKO DLA KIEROWNIKA */}
                {isKierownik && czyRozwinieteStaty && (
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Lista osób, które odczytały komunikat:</p>
                    {odczytanePrzez.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Nikt jeszcze tego nie otworzył.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px', color: '#334155' }}>
                        {odczytanePrzez.map((osoba, idx) => (
                          <li key={idx} style={{ marginBottom: '3px' }}>
                            {osoba.imie_nazwisko} <span style={{ color: '#64748b', fontSize: '11px' }}>({osoba.sekcja})</span>
                          </li>
                        ))}
                      </ul>
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