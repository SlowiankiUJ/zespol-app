import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function PodgladCzlonka({ profile }) {
  const [imieNazwisko, setImieNazwisko] = useState(profile?.imie_nazwisko || '');
  
  // Dodatkowe sekcje
  const [dodatkowaSekcjaWybór, setDodatkowaSekcjaWybór] = useState('balet');
  const [mojeDodatkoweSekcje, setMojeDodatkoweSekcje] = useState([]);

  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setImieNazwisko(profile.imie_nazwisko || '');
      pobierzDodatkoweSekcje();
    }
  }, [profile]);

  const pobierzDodatkoweSekcje = async () => {
    const { data, error } = await supabase
      .from('dodatkowe_sekcje')
      .select('*')
      .eq('id_uzytkownika', profile.id);

    if (!error && data) {
      setMojeDodatkoweSekcje(data);
    }
  };

  const zaktualizujProfil = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ imie_nazwisko: imieNazwisko })
      .eq('id', profile.id);

    setLoading(false);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Profil zaktualizowany pomyślnie! ✅');
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const wyslijProsteDoSekcji = async (e) => {
    e.preventDefault();
    if (dodatkowaSekcjaWybór === profile.sekcja) {
      alert('To jest Twoja główna sekcja!');
      return;
    }

    // Sprawdzamy najpierw czy wpis już istnieje lokalnie
    const juzIstnieje = mojeDodatkoweSekcje.some(ds => ds.sekcja === dodatkowaSekcjaWybór);
    if (juzIstnieje) {
      alert('Masz już wysłaną prośbę lub dostęp do tej sekcji.');
      return;
    }

    const { error } = await supabase
      .from('dodatkowe_sekcje')
      .insert([
        { 
          id_uzytkownika: profile.id, 
          sekcja: dodatkowaSekcjaWybór, 
          status: 'oczekujacy' 
        }
      ]);

    if (error) {
      alert('Błąd bazy danych: ' + error.message);
    } else {
      alert('Prośba o dodanie do sekcji została wysłana do kierownictwa! ⏳');
      pobierzDodatkoweSekcje(); // natychmiastowe odświeżenie listy
    }
  };

  const usunDodatkowaSekcje = async (id) => {
    if (!window.confirm('Czy na pewno chcesz rezygnować z tej dodatkowej sekcji?')) return;

    const { error } = await supabase.from('dodatkowe_sekcje').delete().eq('id', id);
    if (!error) {
      pobierzDodatkoweSekcje();
    } else {
      alert('Błąd usuwania: ' + error.message);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Mój Profil</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Zarządzaj swoimi danymi oraz prośbami o dostęp do dodatkowych sekcji w zespole.
      </p>

      {/* Status i dane */}
      <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#334155' }}>
          <strong>Rola w systemie:</strong> <span style={{ textTransform: 'capitalize', color: '#8b5cf6', fontWeight: 'bold' }}>{profile.rola}</span>
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
          <strong>Główna sekcja:</strong> <span style={{ textTransform: 'uppercase', color: '#3182ce', fontWeight: 'bold' }}>{profile.sekcja}</span>
        </p>
      </div>

      {/* Formularz edycji imienia */}
      <form onSubmit={zaktualizujProfil} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Imię i nazwisko:</label>
          <input 
            type="text" 
            value={imieNazwisko} 
            onChange={(e) => setImieNazwisko(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          {loading ? 'Zapisywanie...' : 'Zapisz zmiany w profilu 💾'}
        </button>
      </form>

      {komunikat && <p style={{ color: '#10b981', textAlign: 'center', fontWeight: '500' }}>{komunikat}</p>}

      {/* Sekcja dodatkowych sekcji */}
      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '25px 0' }} />
      <h3 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '10px' }}>Dodatkowe sekcje (gościnne próby)</h3>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>
        Chcesz chodzić na próby innej sekcji? Wyślij prośbę do kierownika.
      </p>

      {mojeDodatkoweSekcje.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mojeDodatkoweSekcje.map(ds => (
            <li key={ds.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '14px', textTransform: 'uppercase', fontWeight: '600', color: '#334155' }}>
                {ds.sekcja} {ds.status === 'zatwierdzony' ? '🟢 (Zatwierdzono)' : '⏳ (Oczekuje na akceptację)'}
              </span>
              <button onClick={() => usunDodatkowaSekcje(ds.id)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                Rezygnuj ❌
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={wyslijProsteDoSekcji} style={{ display: 'flex', gap: '10px' }}>
        <select 
          value={dodatkowaSekcjaWybór} 
          onChange={(e) => setDodatkowaSekcjaWybór(e.target.value)} 
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
        >
          <option value="balet">Balet</option>
          <option value="chór">Chór</option>
          <option value="kapela">Kapela</option>
        </select>
        <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          Poproś o dostęp ➕
        </button>
      </form>
    </div>
  );
}