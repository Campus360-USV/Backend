# Campus360 – Backend

API REST pentru aplicația **Campus360**, care gestionează laboratoarele și echipamentele facultății și rezervarea lor.

**Tehnologii:** Node.js, Express 5, MySQL (`mysql2`), autentificare JWT (`jsonwebtoken`, `bcrypt`).

---

## Cerințe

- **Node.js 20.12 sau mai nou** (`node -v`). Fișierul `.env` se citește cu `process.loadEnvFile()`, inclus în Node.js.
- **MySQL** pornit local (de exemplu din XAMPP → Start la MySQL).

## Instalare și pornire

```powershell
npm install
Copy-Item .env.example .env      # pe Linux/macOS: cp .env.example .env
npm run dev
```

La pornire, serverul:

1. creează baza de date `campus360_db` (dacă nu există);
2. creează tabelele `laboratoare`, `echipamente`, `users`, `rezervari` (și actualizează automat structura tabelei `rezervari` dacă e varianta veche, cu `interval_orar`);
3. adaugă date de test (3 laboratoare, 7 echipamente, 3 conturi), doar dacă tabelele sunt goale.

Mesajul `Serverul backend rulează pe http://localhost:3000` arată că totul a pornit.

| Script | Ce face |
|---|---|
| `npm run dev` | pornește serverul și îl repornește automat când se salvează un fișier |
| `npm start` | pornește serverul o singură dată |

## Configurare (`.env`)

Fișierul `.env` **nu se urcă pe GitHub** (este în `.gitignore`). Fiecare membru își creează propriul `.env` din `.env.example`.

| Variabilă | Implicit | Descriere |
|---|---|---|
| `PORT` | `3000` | portul serverului |
| `DB_HOST` | `localhost` | adresa serverului MySQL |
| `DB_PORT` | `3306` | portul MySQL |
| `DB_USER` | `root` | utilizator MySQL |
| `DB_PASSWORD` | *(gol)* | parola MySQL (goală în XAMPP) |
| `DB_NAME` | `campus360_db` | numele bazei de date |
| `JWT_SECRET` | – | **obligatoriu**: cheia pentru semnarea token-urilor |
| `JWT_EXPIRES_IN` | `2h` | durata de valabilitate a unui token |

## Conturi de test

| Email | Parolă | Rol |
|---|---|---|
| `admin@usv.ro` | `admin123` | admin |
| `profesor@usv.ro` | `profesor123` | profesor |
| `student@usv.ro` | `student123` | student |

## Structura proiectului

```
server.js                 → pornește serverul după inițializarea bazei de date
src/
├── app.js                → configurează Express și leagă rutele
├── config/
│   ├── db.js             → conexiunea MySQL (pool)
│   └── schema.js         → crearea tabelelor și datele de test
├── routes/               → URL + metodă HTTP → funcție din controller
├── controllers/          → validează cererea și trimite răspunsul
├── models/               → interogările SQL
└── middleware/
    ├── auth.js           → verificarea token-ului JWT și a rolului
    └── errorHandler.js   → răspuns 404 și tratarea erorilor neprevăzute
```

## Endpoint-uri

🔓 = public · 🔓⁺ = public, dar cu token de profesor/admin se văd și echipamentele speciale · 🔒 admin = necesită `Authorization: Bearer <token>` al unui cont cu rol `admin`

### General și autentificare

| Metodă | Rută | Acces | Descriere |
|---|---|---|---|
| GET | `/api/health` | 🔓 | verifică dacă serverul răspunde |
| POST | `/api/login` | 🔓 | autentificare; body: `{ "email", "parola" }` → `{ token, rol }` |

### Laboratoare

| Metodă | Rută | Acces | Descriere |
|---|---|---|---|
| GET | `/api/laboratoare` | 🔓 | lista laboratoarelor |
| GET | `/api/laboratoare/:id` | 🔓⁺ | detaliile laboratorului + lista `echipamente` |
| POST | `/api/laboratoare` | 🔒 admin | adaugă un laborator |
| PUT | `/api/laboratoare/:id` | 🔒 admin | modifică un laborator |
| DELETE | `/api/laboratoare/:id` | 🔒 admin | șterge laboratorul și echipamentele lui |

Body pentru POST/PUT:

```json
{
  "nume": "D101",
  "locatie": "Corp D, etaj 1",
  "capacitate": 20,
  "responsabil": "Prof. Popescu",
  "reguli": "Accesul doar cu cadru didactic."
}
```

`nume`, `locatie` și `capacitate` sunt obligatorii. `nume` trebuie să fie unic.

### Echipamente

| Metodă | Rută | Acces | Descriere |
|---|---|---|---|
| GET | `/api/echipamente` | 🔓⁺ | lista echipamentelor |
| GET | `/api/echipamente?laborator_id=2` | 🔓⁺ | echipamentele unui laborator |
| GET | `/api/echipamente/:id` | 🔓⁺ | un echipament |
| POST | `/api/echipamente` | 🔒 admin | adaugă un echipament |
| PUT | `/api/echipamente/:id` | 🔒 admin | modifică un echipament |
| DELETE | `/api/echipamente/:id` | 🔒 admin | șterge un echipament |

Body pentru POST/PUT:

```json
{
  "laborator_id": 1,
  "nume": "Osciloscop",
  "tip": "Electronică",
  "cantitate": 8,
  "este_special": true
}
```

`laborator_id` și `nume` sunt obligatorii. `este_special: true` marchează un echipament special. **Echipamentele speciale sunt vizibile doar pentru profesori și admini** (KAN-13): în `GET /api/echipamente`, `GET /api/echipamente/:id` și `GET /api/laboratoare/:id` ele apar doar dacă cererea are token-ul unui cont `profesor` sau `admin`. Pentru vizitatori și studenți, un echipament special răspunde cu 404.

### Rezervări

🔑 = necesită token (orice rol) · 🔒 admin = doar rolul `admin`

| Metodă | Rută | Acces | Descriere |
|---|---|---|---|
| GET | `/api/rezervari/ocupate?laborator_id=2&de_la=2026-11-16&pana_la=2026-11-22` | 🔓 | intervalele ocupate ale unui laborator, pentru calendar (KAN-17); `pana_la` implicit = `de_la` + 6 zile |
| GET | `/api/rezervari` | 🔑 | rezervările proprii; adminul le vede pe toate (opțional `?stare=în așteptare`) |
| GET | `/api/rezervari/:id` | 🔑 | o rezervare (proprie sau, pentru admin, oricare) |
| POST | `/api/rezervari` | 🔑 | cerere nouă, creată cu starea `în așteptare` |
| DELETE | `/api/rezervari/:id` | 🔑 | anularea unei rezervări proprii (nu și a celor din trecut) |
| PUT | `/api/rezervari/:id/aproba` | 🔒 admin | aprobarea unei cereri în așteptare |
| PUT | `/api/rezervari/:id/respinge` | 🔒 admin | respingerea cu motiv; body: `{ "motiv": "..." }` (obligatoriu) |

Body pentru POST:

```json
{
  "laborator_id": 2,
  "data_rezervare": "2026-11-20",
  "interval_orar": "10:00-12:00",
  "scop": "Laborator de rețele",
  "participanti": 20,
  "tip": "Proiect"
}
```

În loc de `interval_orar` se pot trimite `ora_inceput` și `ora_sfarsit`. Se acceptă și `laborator` în loc de `laborator_id`.

Reguli (KAN-17):

- data nu poate fi în trecut, iar ora de început trebuie să fie înaintea celei de sfârșit;
- numărul de participanți nu poate depăși capacitatea laboratorului;
- **un interval nu poate fi rezervat dacă se suprapune** cu o rezervare în așteptare sau aprobată a aceluiași laborator → `409`. Intervalele „lipite” (10:00–12:00 și 12:00–14:00) sunt permise;
- la aprobare se verifică din nou să nu existe o rezervare aprobată suprapusă;
- doar cererile `în așteptare` pot fi aprobate sau respinse; altfel → `409`;
- motivul respingerii este obligatoriu și se salvează în `motiv_respingere`, vizibil utilizatorului (KAN-25).

### Coduri de răspuns

| Cod | Când apare |
|---|---|
| 200 / 201 | operație reușită / resursă creată |
| 400 | date lipsă sau invalide (mesajul spune ce câmp) |
| 401 | lipsește token-ul, token invalid/expirat sau email/parolă greșite |
| 403 | utilizatorul nu are rolul necesar |
| 404 | resursa sau ruta nu există |
| 409 | conflict (laborator cu același nume, interval deja ocupat, cerere deja procesată, laborator cu rezervări active la ștergere) |
| 500 | eroare internă (detaliile apar doar în consola serverului) |

Toate erorile au forma `{ "error": "mesaj" }`.

## Testare rapidă (PowerShell)

```powershell
# date publice
Invoke-RestMethod http://localhost:3000/api/laboratoare | Format-Table
Invoke-RestMethod http://localhost:3000/api/laboratoare/2 | ConvertTo-Json

# login ca admin și salvarea token-ului
$admin = (Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/login -ContentType "application/json" -Body '{"email":"admin@usv.ro","parola":"admin123"}').token

# operație de admin
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/laboratoare -Headers @{Authorization="Bearer $admin"} -ContentType "application/json" -Body '{"nume":"D101","locatie":"Corp D, etaj 1","capacitate":20}'
```

## Reguli de lucru în echipă

- **O sarcină din Jira = un branch nou**, pornit din `main` actualizat:
  ```powershell
  git checkout main
  git pull
  git checkout -b nume-functionalitate
  ```
- După testare: commit, push și **Pull Request** spre `main`, cu `Rezolvă KAN-xx` în descriere.
- Un coleg face **code review**; comentariile se rezolvă cu commit-uri pe același branch.
- Codul nou respectă structura `routes → controllers → models`. Nu se adaugă logică direct în `server.js`.
- Datele sensibile (parole, chei) stau doar în `.env`.
