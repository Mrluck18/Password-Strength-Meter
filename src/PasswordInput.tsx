import React, { useEffect, useState } from "react";
import "./PasswordInput.css";
import { evaluatePasswordAsync, Strength } from "./strengthModel";

//Stato iniziale vuoto
const INITIAL_STRENGTH: Strength = {
  entropyBits: 0,
  score: 0,
  label: "Inizia a digitare…",
  color: "#2d7dff",
  suggestions: [], 
};

export default function PasswordInput() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  
  // Stato per il risultato
  const [strength, setStrength] = useState<Strength>(INITIAL_STRENGTH);
  // Stato per il caricamento (check API in corso)
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Debounce: non chiamare API ad ogni tasto, aspetta che l'utente si fermi un attimo (es. 300ms)
    
    const timer = setTimeout(async () => {
      if (!password) {
        setStrength(INITIAL_STRENGTH);
        return;
      }

      setIsChecking(true);  // Inizia loading
      try {
        const result = await evaluatePasswordAsync(password);
        setStrength(result);
      } catch (error) {
        console.error(error);
      } finally {
        setIsChecking(false);  // Fine loading
      }
    }, 500); // 500 ms di ritardo

    return () => clearTimeout(timer); // Cleanup se l'utente digita ancora
  }, [password]);

  return (
    <main className="page">
      <section className="card">
        <header className="header">
          <div className="icon" aria-hidden="true">🛡️</div>
          <h1 className="title">Password Strength Meter</h1>
          <p className="subtitle">Verifica la sicurezza della tua password</p>
        </header>

        <div className="inputRow">
          <input
            className="input"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Inserisci password..."
            autoComplete="new-password"
          />
          <button
            className="toggle"
            type="button"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Nascondi" : "Mostra"}
          </button>
        </div>

        <div className="barBg" aria-hidden="true">
          <div
            className="barFill"
            style={{ 
              width: `${strength.score}%`, 
              background: strength.color,
              opacity: isChecking ? 0.5 : 1 
            }}
          />
        </div>

        <p className="status">
          {isChecking ? "Controllo database..." : strength.label}
        </p>

        {!isChecking && strength.suggestions?.length > 0 && (
          <ul style={{ 
            marginTop: "16px", 
            paddingLeft: "20px", 
            fontSize: "15px", 
            opacity: 0.85, 
            textAlign: "left",
            lineHeight: "1.6"
          }}>
            {strength.suggestions.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        )}

      </section>
    </main>
  );
}

