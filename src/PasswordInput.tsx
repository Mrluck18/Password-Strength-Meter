import React, { useMemo, useState } from "react";
import "./PasswordInput.css";
import { evaluatePasswordLocal } from "./strengthModel";

export default function PasswordInput() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const strength = useMemo(() => evaluatePasswordLocal(password), [password]);

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
            style={{ width: `${strength.score}%`, background: strength.color }}
          />
        </div>

        <p className="status">{strength.label}</p>
      </section>
    </main>
  );
}

