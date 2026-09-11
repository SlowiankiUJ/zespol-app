// Globalny słownik kolorów dla sekcji
export const sekcjaKolory = {
  chór: {
    glowny: '#0d6efd',
    jasny: '#e7f1ff',
    border: '#b6d4fe',
    tekst: '#084298'
  },
  balet: {
    glowny: '#dc3545',
    jasny: '#f8d7da',
    border: '#f5c2c7',
    tekst: '#842029'
  },
  kapela: {
    glowny: '#198754',
    jasny: '#d1e7dd',
    border: '#badbcc',
    tekst: '#0f5132'
  },
  ogólny: {
    glowny: '#6c757d',
    jasny: '#f8f9fa',
    border: '#ced4da',
    tekst: '#495057'
  }
};

// Funkcja zwracająca styl motywu na podstawie nazwy sekcji
export const pobierzStylSekcji = (sekcjaNazwa) => {
  return sekcjaKolory[sekcjaNazwa?.toLowerCase()] || sekcjaKolory.ogólny;
};