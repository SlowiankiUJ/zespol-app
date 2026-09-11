import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function ZarzadzanieCzlonkami() {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [frekwencjaStaty, setFrekwencjaStaty] = useState({});
  const [komunikat, setKomunikat] = useState('');

  useEffect(() => {
    pobierzCzlonkowIDane();
  }, []);

  const pobierzCzlonkowIDane = async () => {
    // 1. Pobierz zatwierdzonych członków
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
    const { data: dekData } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_uzytkownika, planuje');

    const staty = {};
    listaCzlonkow.forEach(c => {
      staty[c.id] = { obecny: 0, nieobecny: 0, total: 0 };
    });

    if (dekData) {
      dekData.forEach(d => {
        if (staty[d.id_uzytkownika]) {
          staty[d.id_uzytkownika].total++;
          if (d.planuje === true) staty[d.id_uzytkownika].obecny++;
          if (d.planuje === false) staty[d.id_uzytkownika].nieobecny++;
        }
      });
    }
    setFrekwencjaStaty(staty);
  };

  const zmienSekcje = async (userId, nowaSekcja) => {
    const { error } = await supabase
      .from('profiles')
      .update({ sekcja: nowaSekcja })
      .eq('id', userId);

    if (error) {
      alert('Błąd zmiany sekcji: ' + error.message);
    } else {
      setKomunikat('Sekcja została zmieniona pomyślnie! ✅');
      setTimeout(() => setKomunikat(''), 3000);
      pobierzCzlonkowIDane();
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Zarządzanie Członkami Zespołu 👥</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
        Przeglądaj listę członków, sprawdzaj ich ogólną frekwencję oraz zarządzaj przypisaniem do sekcji.
      </p>

      {komunikat && <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '15px' }}>{komunikat}</p>}

      {czlonkowie.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zatwierdzonych członków w systemie.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Imię i nazwisko</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Aktualna sekcja</th>
                <th style={{ borderBottom: '2px solid #cbd5e1', padding: '10px', color: '#475569', fontSize: '14px' }}>Frekwencja (Deklaracje)</th>
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
                      {czlonek.imie_nazwisko}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '600', color: '#3182ce' }}>
                      {czlonek.sekcja}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155' }}>
                      🟢 Będzie: <strong>{stat.obecny}</strong> | 🔴 Nie będzie: <strong>{stat.nieobecny}</strong> ({procent}% gotowości)
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <select 
                        value={czlonek.sekcja}
                        onChange={(e) => zmienSekcje(czlonek.id, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', fontSize: '13px' }}
                      >
                        <option value="balet">Balet</option>
                        <option value="chór">Chór</option>
                        <option value="kapela">Kapela</option>
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