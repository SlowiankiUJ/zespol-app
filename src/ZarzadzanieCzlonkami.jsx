import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import TopFrekwencja from './TopFrekwencja';

export default function ZarzadzanieCzlonkami() {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [frekwencjaStaty, setFrekwencjaStaty] = useState({});
  const [komunikat, setKomunikat] = useState('');

  useEffect(() => {
    pobierzCzlonkowIDane();
  }, []);

  const pobierzCzlonkowIDane = async () => {
    const { data: profData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'zatwierdzony')
      .eq('rola', 'członek')
      .order('imie_nazwisko', { ascending: true });

    if (!error && profData) {
      setCzlonkowie(profData);
      pobierzStatystykiFrekwencji(profData);
    }
  };

  const pobierzStatystykiFrekwencji = async (listaCzlonkow) => {
    // LICZYMY FREKWENCJĘ TYLKO Z FAKTYCZNEJ OBECNOŚCI
    const { data: dekData } = await supabase.from('deklaracje_obecnosci').select('id_uzytkownika, obecny');
    const staty = {};
    listaCzlonkow.forEach(c => { staty[c.id] = { obecny: 0, nieobecny: 0, total: 0 }; });

    if (dekData) {
      dekData.forEach(d => {
        if (staty[d.id_uzytkownika]) {
          if (d.obecny === true) {
            staty[d.id_uzytkownika].obecny++;
            staty[d.id_uzytkownika].total++;
          } else if (d.obecny === false) {
            staty[d.id_uzytkownika].nieobecny++;
            staty[d.id_uzytkownika].total++;
          }
        }
      });
    }
    setFrekwencjaStaty(staty);
  };

  const zmienSekcje = async (userId, nowaSekcja) => {
    const { error } = await supabase.from('profiles').update({ sekcja: nowaSekcja, glos: nowaSekcja === 'chór' ? 'Sopran' : null }).eq('id', userId);
    if (!error) {
      setKomunikat('Sekcja została zmieniona pomyślnie! ✅');
      setTimeout(() => setKomunikat(''), 3000);
      pobierzCzlonkowIDane();
    }
  };

  const zmienGlos = async (userId, nowyGlos) => {
    const { error } = await supabase.from('profiles').update({ glos: nowyGlos }).eq('id', userId);
    if (!error) pobierzCzlonkowIDane();
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '20px' }}>Zarządzanie Członkami i Frekwencja 👥</h2>
      
      {komunikat && <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '15px' }}>{komunikat}</p>}

      {/* WIDOK TOP FREKWENCJI (KADRA) */}
      <TopFrekwencja />

      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#1e293b' }}>Pełna lista członków i statystyki:</h3>

      {czlonkowie.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zatwierdzonych członków w systemie.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Członek zespołu</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Sekcja / Głos</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Frekwencja (Realna)</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Zmień sekcję</th>
              </tr>
            </thead>
            <tbody>
              {czlonkowie.map(czlonek => {
                const stat = frekwencjaStaty[czlonek.id] || { obecny: 0, nieobecny: 0, total: 0 };
                const procent = stat.total > 0 ? Math.round((stat.obecny / stat.total) * 100) : 0;

                return (
                  <tr key={czlonek.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          {czlonek.avatar_url ? (
                            <img src={czlonek.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '14px' }}>👤</span>
                          )}
                        </div>
                        {czlonek.imie_nazwisko}
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <span style={{ textTransform: 'uppercase', fontWeight: '600', color: '#3182ce' }}>{czlonek.sekcja}</span>
                      {czlonek.sekcja === 'chór' && (
                        <div style={{ marginTop: '4px' }}>
                          <select value={czlonek.glos || 'Sopran'} onChange={(e) => zmienGlos(czlonek.id, e.target.value)} style={{ padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                            <option value="Sopran">Sopran</option><option value="Alt">Alt</option><option value="Tenor">Tenor</option><option value="Bas">Bas</option>
                          </select>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155' }}>
                      {stat.total === 0 ? (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Brak wpisów</span>
                      ) : (
                        <>🟢 {stat.obecny} | 🔴 {stat.nieobecny} ({procent}%)</>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <select value={czlonek.sekcja} onChange={(e) => zmienSekcje(czlonek.id, e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                        <option value="balet">Balet</option><option value="chór">Chór</option><option value="kapela">Kapela</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}