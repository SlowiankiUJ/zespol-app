import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import TopFrekwencja from './TopFrekwencja';

export default function ZarzadzanieCzlonkami() {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [frekwencjaStaty, setFrekwencjaStaty] = useState({});
  const [komunikat, setKomunikat] = useState('');
  
  // Stan przechowujący informację, które sekcje są rozwinięte (domyślnie wszystkie otwarte)
  const [rozwinieteSekcje, setRozwinieteSekcje] = useState({
    balet: true,
    chór: true,
    kapela: true
  });

  useEffect(() => {
    pobierzCzlonkowIDane();

    // SUPABASE REALTIME: Nasłuchiwanie na żywo w tabeli głównej
    const subscription = supabase
      .channel('zmiany_obecnosci_lista')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'deklaracje_obecnosci' }, 
        () => {
          // Aktualizuje tylko statystyki, by nie psuć widoku jeśli np. przewijasz listę
          pobierzSameStatystyki(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
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

  const pobierzSameStatystyki = async () => {
    setCzlonkowie(aktualniCzlonkowie => {
      if(aktualniCzlonkowie.length > 0) pobierzStatystykiFrekwencji(aktualniCzlonkowie);
      return aktualniCzlonkowie;
    });
  };

  const pobierzStatystykiFrekwencji = async (listaCzlonkow) => {
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

  const przelaczSekcje = (nazwaSekcji) => {
    setRozwinieteSekcje(prev => ({
      ...prev,
      [nazwaSekcji]: !prev[nazwaSekcji]
    }));
  };

  // Definicje sekcji wraz ze stylami nagłówków
  const sekcjeDefinicje = [
    { klucz: 'balet', nazwa: 'Balet 🩰', kolor: '#8b5cf6', tło: '#faf5ff', border: '#e9d5ff' },
    { klucz: 'chór', nazwa: 'Chór 🎤', kolor: '#d97706', tło: '#fffbeb', border: '#fef3c7' },
    { klucz: 'kapela', nazwa: 'Kapela 🎻', kolor: '#3182ce', tło: '#f0fdf4', border: '#bbf7d0' }
  ];

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '20px', fontSize: '20px' }}>Zarządzanie Członkami i Frekwencja 👥</h2>
      
      {komunikat && <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '15px' }}>{komunikat}</p>}

      <TopFrekwencja />

      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#1e293b' }}>Pełna lista członków i statystyki:</h3>

      {czlonkowie.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zatwierdzonych członków w systemie.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {sekcjeDefinicje.map(sekcjaDef => {
            // Filtrujemy członków dla danej sekcji
            const osobyWSekcji = czlonkowie.filter(c => (c.sekcja || '').toLowerCase() === sekcjaDef.klucz);
            const isRozwinieta = rozwinieteSekcje[sekcjaDef.klucz];

            return (
              <div key={sekcjaDef.klucz} style={{ border: `1px solid ${sekcjaDef.border}`, borderRadius: '8px', overflow: 'hidden', backgroundColor: sekcjaDef.tło }}>
                
                {/* Wyszukiwany nagłówek rozwijany */}
                <button 
                  onClick={() => przelaczSekcje(sekcjaDef.klucz)}
                  style={{ 
                    width: '100%', boxSizing: 'border-box', padding: '15px 20px', 
                    backgroundColor: sekcjaDef.tło, border: 'none', 
                    borderBottom: isRozwinieta ? `1px solid ${sekcjaDef.border}` : 'none', 
                    textAlign: 'left', fontWeight: 'bold', fontSize: '16px', color: sekcjaDef.kolor, 
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                  }}
                >
                  <span>
                    {sekcjaDef.nazwa} <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 'normal' }}>({osobyWSekcji.length})</span>
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{isRozwinieta ? '▲ Zwiń' : '▼ Rozwiń'}</span>
                </button>

                {/* Zawartość sekcji (tabela członków) */}
                {isRozwinieta && (
                  <div style={{ padding: '15px 20px', backgroundColor: '#ffffff' }}>
                    {osobyWSekcji.length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>Brak członków w tej sekcji.</p>
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
                            {osobyWSekcji.map(czlonek => {
                              const stat = frekwencjaStaty[czlonek.id] || { obecny: 0, nieobecny: 0, total: 0 };
                              const procent = stat.total > 0 ? Math.round((stat.obecny / stat.total) * 100) : 0;

                              return (
                                <tr key={czlonek.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.3s' }}>
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
                                      <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#f1f5f9', fontWeight: '600' }}>
                                        🟢 {stat.obecny} | 🔴 {stat.nieobecny} <span style={{ color: '#8b5cf6', marginLeft: '6px' }}>({procent}%)</span>
                                      </span>
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
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}