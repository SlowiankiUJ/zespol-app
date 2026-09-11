import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [dodatkoweProśby, setDodatkoweProśby] = useState([]);
  const [message, setMessage] = useState('');
  const [rozwinPanel, setRozwinPanel] = useState(true);

  useEffect(() => {
    fetchPendingUsers();
    fetchDodatkoweSekcje();
  }, []);

  const fetchPendingUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'oczekujący');
    
    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchDodatkoweSekcje = async () => {
    // Pobieramy dodatkowe sekcje oraz profile oddzielnie, aby uniknąć błędów łączenia kluczy obcych w Supabase
    const { data: sekcjeData, error: sekcjeErr } = await supabase
      .from('dodatkowe_sekcje')
      .select('*')
      .order('id', { ascending: false });

    const { data: profData } = await supabase
      .from('profiles')
      .select('id, imie_nazwisko');

    if (!sekcjeErr && sekcjeData) {
      const profMap = {};
      if (profData) {
        profData.forEach(p => {
          profMap[p.id] = p.imie_nazwisko;
        });
      }

      const połączone = sekcjeData.map(s => ({
        ...s,
        imie_nazwisko: profMap[s.id_uzytkownika] || 'Nieznany użytkownik'
      }));

      setDodatkoweProśby(połączone);
    }
  };

  const approveUser = async (id) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'zatwierdzony' })
      .eq('id', id);

    if (error) {
      setMessage('Błąd: ' + error.message);
    } else {
      setMessage('Użytkownik zatwierdzony pomyślnie!');
      fetchPendingUsers();
    }
  };

  const zatwierdzDodatkowaSekcje = async (id, status) => {
    const { error } = await supabase
      .from('dodatkowe_sekcje')
      .update({ status })
      .eq('id', id);

    if (error) {
      setMessage('Błąd: ' + error.message);
    } else {
      setMessage(`Prośba o dodatkową sekcję została ${status === 'zatwierdzony' ? 'zaakceptowana' : 'odrzucona'}!`);
      fetchDodatkoweSekcje();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const usunDodatkowaSekcjeKadra = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę dodatkową sekcję użytkownikowi?')) return;

    const { error } = await supabase
      .from('dodatkowe_sekcje')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchDodatkoweSekcje();
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #cbd5e1', borderRadius: '12px', marginBottom: '20px', backgroundColor: '#fdfdfe', boxShadow: '0 4px 6px rgba(0,0,0,0.01)' }}>
      <div 
        onClick={() => setRozwinPanel(!rozwinPanel)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>Panel Kierownika / Akceptacja Kont i Sekcji</h2>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>{rozwinPanel ? '▲ Zwiń' : '▼ Rozwiń'}</span>
      </div>

      {message && <p style={{ color: 'green', fontWeight: '600', marginTop: '10px' }}>{message}</p>}
      
      <div style={{
        maxHeight: rozwinPanel ? '800px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out',
        opacity: rozwinPanel ? 1 : 0
      }}>
        {/* Nowe konta */}
        <div style={{ marginTop: '15px' }}>
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', color: '#334155', fontSize: '15px' }}>Nowe konta oczekujące ({users.length})</h3>
          {users.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px' }}>Brak nowych zgłoszeń oczekujących na zatwierdzenie.</p>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Imię i nazwisko</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Rola</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Sekcja</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Akcja</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>{user.imie_nazwisko}</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>{user.rola}</td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>
                      {user.sekcja === 'brak' ? '-' : user.sekcja}
                    </td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>
                      <button 
                        onClick={() => approveUser(user.id)}
                        style={{ padding: '5px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                      >
                        Zatwierdź
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Prośby o dodatkowe sekcje */}
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', color: '#334155', fontSize: '15px' }}>
            Prośby o dodatkowe sekcje (gościnne) ({dodatkoweProśby.length})
          </h3>
          {dodatkoweProśby.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px' }}>Brak oczekujących próśb o dodatkowe sekcje.</p>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Imię i nazwisko</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Wnioskowana sekcja</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Status</th>
                  <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {dodatkoweProśby.map(dp => (
                  <tr key={dp.id}>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>
                      {dp.imie_nazwisko}
                    </td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px', textTransform: 'uppercase', fontWeight: '600' }}>
                      {dp.sekcja}
                    </td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>
                      {dp.status === 'zatwierdzony' ? (
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>Zatwierdzony 🟢</span>
                      ) : (
                        <span style={{ color: '#d97706', fontWeight: 'bold' }}>Oczekujący ⏳</span>
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px', display: 'flex', gap: '8px' }}>
                      {dp.status !== 'zatwierdzony' && (
                        <button 
                          onClick={() => zatwierdzDodatkowaSekcje(dp.id, 'zatwierdzony')}
                          style={{ padding: '5px 10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          Akceptuj ✔️
                        </button>
                      )}
                      <button 
                        onClick={() => usunDodatkowaSekcjeKadra(dp.id)}
                        style={{ padding: '5px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        Usuń/Odrzuć ❌
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}