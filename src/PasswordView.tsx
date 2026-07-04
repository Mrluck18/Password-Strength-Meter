import React, { useId } from "react";
import "./PasswordInput.css";
import { usePasswordController } from "./PasswordController";
import { ModificationSuggestion, PatternMatch, PatternType } from "./strengthModel";

const PATTERN_SHORT: Record<PatternType, string> = {
  [PatternType.KEYBOARD_WALK]: "Tastiera",
  [PatternType.DATE]: "Data",
  [PatternType.YEAR]: "Anno",
  [PatternType.LEET]: "Leet",
  [PatternType.REPEATED]: "Ripetuto",
  [PatternType.SEQUENCE_ALPHA]: "Seq. lettere",
  [PatternType.SEQUENCE_NUM]: "Seq. numeri",
  [PatternType.DICTIONARY]: "Dizionario",
  [PatternType.STRUCTURAL]: "Strutturale",
};

const PATTERN_TAG_CLASS: Record<PatternType, string> = {
  [PatternType.KEYBOARD_WALK]: "patternTag patternTag--keyboard",
  [PatternType.DATE]: "patternTag patternTag--date",
  [PatternType.YEAR]: "patternTag patternTag--date",
  [PatternType.LEET]: "patternTag patternTag--leet",
  [PatternType.REPEATED]: "patternTag patternTag--repeated",
  [PatternType.SEQUENCE_ALPHA]: "patternTag patternTag--sequence",
  [PatternType.SEQUENCE_NUM]: "patternTag patternTag--sequence",
  [PatternType.DICTIONARY]: "patternTag patternTag--dictionary",
  [PatternType.STRUCTURAL]: "patternTag patternTag--structural",
};

interface PatternTagListProps {
  patterns: PatternMatch[];
}

function PatternTagList({ patterns }: PatternTagListProps) {
  if (patterns.length === 0) return null;

  return (
    <ul
      className="patternTagList"
      aria-label="Pattern rilevati nella password"
    >
      {patterns.map((match, idx) => (
        <li key={idx} className={PATTERN_TAG_CLASS[match.type]}>
          {PATTERN_SHORT[match.type]}{" "}
          <span className="patternTag__segment">«{match.segment}»</span>
        </li>
      ))}
    </ul>
  );
}

interface PasswordPreviewProps {
  password: string;
  patterns: PatternMatch[];
}

function PasswordPreview({ password, patterns }: PasswordPreviewProps) {
  if (!password || patterns.length === 0) return null;

  // Il primo pattern è già il più grave
  const worst = patterns[0];

  const before = password.slice(0, worst.start);
  const segment = password.slice(worst.start, worst.end);
  const after = password.slice(worst.end);

  return (
    <p className="passwordPreview">
      <span className="passwordPreview__text">
        {before}
        <mark className="segmentHighlight">{segment}</mark>
        {after}
      </span>
    </p>
  );
}

interface SuggestionBoxProps {
  modification: ModificationSuggestion;
}

function SuggestionBox({ modification }: SuggestionBoxProps) {
  const before = modification.original.slice(0, modification.weakStart);
  const segment = modification.original.slice(
    modification.weakStart,
    modification.weakEnd
  );
  const after = modification.original.slice(modification.weakEnd);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(modification.modified);
    } catch (err) {
      console.error("Copia non riuscita:", err);
    }
  };

  return (
    <div
      className="suggestionBox"
      aria-label="Suggerimento di modifica minima"
    >
      <p className="suggestionBox__title">Modifica minima suggerita</p>

      <div className="suggestionBox__row">
        <span className="suggestionBox__label">Originale</span>
        <code className="suggestionBox__value">
          {before}
          <mark className="segmentHighlight">{segment}</mark>
          {after}
        </code>
      </div>

      <div className="suggestionBox__arrow" aria-hidden="true">
        →
      </div>

      <div className="suggestionBox__row">
        <span className="suggestionBox__label">Suggerita</span>
        <code className="suggestionBox__value">{modification.modified}</code>
      </div>

      <p className="suggestionBox__explanation">{modification.explanation}</p>

      <button
        type="button"
        className="suggestionBox__copyButton"
        onClick={handleCopy}
      >
        Copia
      </button>
    </div>
  );
}

function NistBadge() {
  const tooltipId = useId();

  return (
    <span
      className="nist-badge"
      tabIndex={0}
      aria-describedby={tooltipId}
      aria-label="Conforme a NIST SP 800-63-4"
    >
      <span aria-hidden="true">✓</span>
      <span>NIST SP 800-63-4</span>
      <span id={tooltipId} role="tooltip" className="nist-tooltip">
        Password forte secondo la soglia adottata dal meter.
      </span>
    </span>
  );
}

export default function PasswordView() {
  // Riceve stato e azioni dal Controller
  const {
    password,
    showPassword,
    strength,
    isCheckingLocal,
    isCheckingOnline,
    validationError,
    richiestaAnalisiPassword,
    onToggleVisibility,
    patterns,
    modification,
  } = usePasswordController();

  const isChecking = isCheckingLocal || isCheckingOnline;

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
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => richiestaAnalisiPassword(e.target.value)}
            placeholder="Inserisci password..."
            autoComplete="new-password"
            aria-label="Campo password"
          />
          <button
            className="toggle"
            type="button"
            onClick={onToggleVisibility}
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
          >
            {showPassword ? "Nascondi" : "Mostra"}
          </button>
        </div>

        {validationError && (
          <p style={{ color: '#ff3b3b', fontSize: '14px', marginTop: '8px' }}>
            Sono ammessi solo caratteri alfanumerici e simboli speciali
          </p>
        )}

        <div className="barBg" aria-hidden="true">
          <div
            className="barFill"
            style={{
              width: `${strength.score}%`,
              background: strength.color,
              opacity: isChecking ? 0.5 : 1,
            }}
          />
        </div>

        <p className="status" role="status" aria-live="polite">
          {isChecking ? "Controllo database..." : strength.label}
        </p>
        
        {!isChecking && strength.label === "Forte" && <NistBadge />}
        
        {!isChecking && strength.suggestions?.length > 0 && (
          <ul
            style={{
              marginTop: "16px",
              paddingLeft: "20px",
              fontSize: "15px",
              opacity: 0.85,
              textAlign: "left",
              lineHeight: "1.6",
            }}
            aria-label="Suggerimenti per migliorare la password"
          >
            {strength.suggestions.map((msg, idx) => (
              <li key={idx}>{msg}</li>
            ))}
          </ul>
        )}

        {!isChecking && patterns.length > 0 && (
          <PatternTagList patterns={patterns} />
        )}

        {!isChecking && patterns.length > 0 && (
          <PasswordPreview password={password} patterns={patterns} />
        )}

        {!isChecking && modification && (
          <SuggestionBox modification={modification} />
        )}
      </section>
    </main>
  );
}