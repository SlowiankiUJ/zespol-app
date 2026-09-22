import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function PodgladCzlonka({ profile }) {
  const [imieNazwisko, setImieNazwisko] = useState(profile?.imie_nazwisko || '');
  const [glos, setGlos] = useState(profile?.glos || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  const [dodatkowaSekcjaWybor, setDodatkowaSekcjaWybor] = useState('balet');
  const [mojeDodatkoweSekcje, setMojeDodatkoweSekcje] = useState([]);

  const [komunikat, setKomunikat] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setImieNazwisko(profile.imie_nazwisko || '');
      setGlos(profile.glos || '');
      setAvatarUrl(profile.avatar_url || '');
      pobierzDodatkoweSekcje();
    }
  }, [profile]);

  const pobierzDodatkoweSekcje = async () => {
    const { data, error } = await supabase
      .from('dodatkowe_sekcje')
      .select('*')
      .eq('id_uzytkownika', profile.id);
    if (!error && data) setMojeDodatkoweSekcje(data);
  };

  const zaktualizujProfil = async (e) => {
    e.preventDefault();
    setLoading(true);

    const daneDoAktualizacji = { imie_nazwisko: imieNazwisko };
    if (profile.sekcja === 'chór' || profile.sekcja === 'balet') {
      daneDoAktualizacji.glos = glos;
    }

    const { error } = await supabase
      .from('profiles')
      .update(daneDoAktualizacji)
      .eq('id', profile.id);
      
    setLoading(false);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Profil zaktualizowany pomyślnie! ✅');
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const wgrajZdjecie = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Musisz wybrać zdjęcie.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', profile.id);
        
      if (updateError) throw updateError;

      setAvatarUrl(data.publicUrl);
      setKomunikat('Zdjęcie profilowe zostało zaktualizowane! 📸');
      setTimeout(() => setKomunikat(''), 3000);
    } catch (error) {
      alert('Błąd podczas wgrywania zdjęcia: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const wyslijProsbeDoSekcji = async (e) => {
    e.preventDefault();
    const sekcjaWybranaClean = (dodatkowaSekcjaWybor || '').trim().toLowerCase();
    const sekcjaGlownaClean = (profile.sekcja || '').trim().toLowerCase();

    if (sekcjaWybranaClean === sekcjaGlownaClean) { 
      alert('To jest Twoja główna sekcja! Nie musisz prosić o dostęp gościnny.'); 
      return; 
    }
    
    const juzIstnieje = mojeDodatkoweSekcje.some(ds => (ds.sekcja || '').trim().toLowerCase() === sekcjaWybranaClean);
    if (juzIstnieje) { 
      alert('Masz już wysłaną prośbę lub dostęp do tej sekcji.'); 
      return; 
    }

    const { error } = await supabase
      .from('dodatkowe_sekcje')
      .insert([{ id_uzytkownika: profile.id, sekcja: dodatkowaSekcjaWybor, status: 'oczekujacy' }]);
      
    if (error) {
      alert('Błąd: ' + error.message);
    } else { 
      alert('Prośba o dostęp gościnny wysłana! ⏳ Pamiętaj, że udział w tych próbach nie wlicza się do oficjalnej frekwencji ani streaka.'); 
      pobierzDodatkoweSekcje(); 
    }
  };

  const usunDodatkowaSekcje = async (id) => {
    if (!window.confirm('Rezygnujesz z dodatkowej sekcji gościnnej?')) return;
    const { error } = await supabase.from('dodatkowe_sekcje').delete().eq('id', id);
    if (!error) pobierzDodatkoweSekcje();
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Mój Profil 👤</h2>
      
      {/* SEKCJA ZDJĘCIA PROFILOWEGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '2px solid #8b5cf6' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '30px' }}>👤</span>
          )}
        </div>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#1e293b' }}>Zdjęcie profilowe</h3>
          <label style={{ display: 'inline-block', padding: '8px 14px', backgroundColor: '#3182ce', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            {uploading ? 'Wgrywanie...' : 'Wybierz i wgraj zdjęcie 🖼️'}
            <input type="file" accept="image/*" onChange={wgrajZdjecie} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Status i dane */}
      <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#334155' }}>
          <strong>Rola:</strong> <span style={{ textTransform: 'capitalize', color: '#8b5cf6', fontWeight: 'bold' }}>{profile.rola}</span>
        </p>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#334155' }}>
          <strong>Główna sekcja macierzysta:</strong> <span style={{ textTransform: 'uppercase', color: '#3182ce', fontWeight: 'bold' }}>{profile.sekcja}</span>
        </p>
        {profile.sekcja === 'chór' && (
          <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
            <strong>Głos:</strong> <span style={{ color: '#d97706', fontWeight: 'bold' }}>{profile.glos || 'Nie wybrano'}</span>
          </p>
        )}
        {profile.sekcja === 'balet' && (
          <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
            <strong>Grupa:</strong> <span style={{ color: '#d97706', fontWeight: 'bold' }}>{profile.glos || 'Nie wybrano'}</span>
          </p>
        )}
      </div>

      <form onSubmit={zaktualizujProfil} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Imię i nazwisko:</label>
          <input type="text" value={imieNazwisko} onChange={(e) => setImieNazwisko(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }} />
        </div>
        {profile.sekcja === 'chór' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Wybierz głos:</label>
            <select value={glos} onChange={(e) => setGlos(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }}>
              <option value="">-- Wybierz głos --</option>
              <option value="Sopran">Sopran</option>
              <option value="Alt">Alt</option>
              <option value="Tenor">Tenor</option>
              <option value="Bas">Bas</option>
            </select>
          </div>
        )}
        {profile.sekcja === 'balet' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Wybierz grupę:</label>
            <select value={glos} onChange={(e) => setGlos(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box' }}>
              <option value="">-- Wybierz opcję --</option>
              <option value="Pani">Pani</option>
              <option value="Pan">Pan</option>
            </select>
          </div>
        )}
        <button type="submit" disabled={loading} style={{ padding: '10px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          {loading ? 'Zapisywanie...' : 'Zapisz zmiany w profilu 💾'}
        </button>
      </form>
      {komunikat && <p style={{ color: '#10b981', textAlign: 'center', fontWeight: '500' }}>{komunikat}</p>}

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '25px 0' }} />
      
      {/* SEKCJE GOŚCINNE */}
      <h3 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '5px' }}>Dodatkowe sekcje (Udział gościnny)</h3>
      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 15px 0' }}>
        Dostęp do prób innych sekcji pozwala Ci brać w nich udział i zaznaczać obecność, jednak <strong>nie wpływa na Twoją oficjalną frekwencję ani streak</strong>.
      </p>

      {mojeDodatkoweSekcje.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mojeDodatkoweSekcje.map(ds => (
            <li key={ds.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '14px', textTransform: 'uppercase', fontWeight: '600', color: '#334155' }}>
                {ds.sekcja} {ds.status === 'zatwierdzony' ? '🟢 (Aktywny podgląd)' : '⏳ (Oczekuje na zgodę)'}
              </span>
              <button onClick={() => usunDodatkowaSekcje(ds.id)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Rezygnuj ❌</button>
            </li>
          ))}
        </ul>
      )}
      
      <form onSubmit={wyslijProsbeDoSekcji} style={{ display: 'flex', gap: '10px' }}>
        <select value={dodatkowaSekcjaWybor} onChange={(e) => setDodatkowaSekcjaWybor(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}>
          <option value="balet">Balet</option>
          <option value="chór">Chór</option>
          <option value="kapela">Kapela</option>
        </select>
        <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Poproś o dostęp gościnny ➕</button>
      </form>
    </div>
  );
}