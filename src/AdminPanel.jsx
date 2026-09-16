import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [dodatkoweProsby, setDodatkoweProsby] = useState([]);
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
      .in('status', ['oczekujacy', 'oczekujący']);
    
    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchDodatkoweSekcje = async () => {
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

      const polaczone = sekcjeData.map(s => ({
        ...s,
        imie_nazwisko: profMap[s.id_uzytkownika] || 'Nieznany użytkownik'
      }));

      setDodatkoweProsby(polaczone);
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
      setMessage('Użytkownik zatwierdzony pomyślnie! ✅');
      fetchPendingUsers();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // CAŁKOWITE USUNIĘCIE KONTA Z SYSTEMU
  const usunKontoCalkowicie = async (userId, imieNazwisko) => {
    if (!window.confirm(`Czy na pewno chcesz całkowicie i bezpowrotnie usunąć konto użytkownika ${imieNazwisko}? Osoba ta straci dostęp do logowania.`)) {
      return;
    }

    setMessage('Usuwanie konta...');
    try {
      const { error } = await supabase.rpc('usun_konto_uzytkownika', { user_id: userId });

      if (error) {
        // Fallback: jeśli funkcja RPC nie została utworzona, usuwamy z tabeli profiles
        const { error: deleteProfError } = await supabase.from('profiles').delete().eq('id', userId);
        if (deleteProfError) throw deleteProfError;
      }

      setMessage(`Konto użytkownika ${imieNazwisko} zostało trwale usunięte! 🗑️`);
      fetchPendingUsers();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Błąd usuwania konta: ' + err.message);
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
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>Panel Kierownika / Akceptacja Kont i Sekcji 🛠️</h2>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>{rozwinPanel ? '▲ Zwiń' : '▼ Rozwiń'}</span>
      </div>

      {message && (
        <p style={{ color: message.includes('Błąd') ? '#dc2626' : '#16a34a', fontWeight: '600', marginTop: '10px' }}>
          {message}
        </p>
      )}
      
      <div style={{
        maxHeight: rozwinPanel ? '1200px' : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out',
        opacity: rozwinPanel ? 1 : 0
      }}>
        {/* Nowe konta oczekujące */}
        <div style={{ marginTop: '15px' }}>
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', color: '#334155', fontSize: '15px' }}>
            Nowe konta oczekujące na akceptację ({users.length})
          </h3>
          {users.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px' }}>Brak nowych zgłoszeń oczekujących na zatwierdzenie.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Imię i nazwisko</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Rola</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Sekcja</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px', textAlign: 'right' }}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px', fontWeight: '500' }}>{user.imie_nazwisko}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>{user.rola}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px' }}>
                        {user.sekcja === 'brak' ? '-' : user.sekcja}
                      </td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => approveUser(user.id)}
                            style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                          >
                            Zatwierdź ✔️
                          </button>
                          <button 
                            onClick={() => usunKontoCalkowicie(user.id, user.imie_nazwisko)}
                            style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                          >
                            Odrzuć i usuń 🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Prośby o dodatkowe sekcje */}
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', color: '#334155', fontSize: '15px' }}>
            Prośby o dodatkowe sekcje (gościnne) ({dodatkoweProsby.length})
          </h3>
          {dodatkoweProsby.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '14px' }}>Brak oczekujących próśb o dodatkowe sekcje.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Imię i nazwisko</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Wnioskowana sekcja</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px' }}>Status</th>
                    <th style={{ borderBottom: '2px solid #cbd5e1', padding: '8px', color: '#475569', fontSize: '14px', textAlign: 'right' }}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {dodatkoweProsby.map(dp => (
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
                      <td style={{ borderBottom: '1px solid #f1f5f9', padding: '8px', fontSize: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}